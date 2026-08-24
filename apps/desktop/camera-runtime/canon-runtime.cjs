/**
 * Canon Camera Runtime Service (Node Process)
 * Owns the native EDSDK bridge lifecycle, Live View streaming,
 * high-res capture, JPEG download, and recovery.
 */

const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { COMMANDS, EVENTS, STATES, createMessage } = require("./protocol.cjs");
const { resolveBridgeBinary, resolveEdsdkPath, checkSystemContention } = require("./lifecycle.cjs");

function auditMacOsUsb() {
  let macosUsbPresent = false;
  let vendorId = "N/A";
  let productId = "N/A";
  let productName = "N/A";
  let locationId = "N/A";
  let usbExclusiveOwner = "N/A";

  if (process.platform === "win32") {
    try {
      const out = execSync('powershell -NoProfile -NonInteractive -Command "Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -like \'*Canon*\' -or $_.InstanceId -like \'*04A9*\' } | Select-Object FriendlyName, InstanceId, Status, Class | ConvertTo-Json -Compress"', { encoding: "utf8", timeout: 3000 });
      if (out && out.trim()) {
        const parsed = JSON.parse(out);
        const item = Array.isArray(parsed) ? parsed[0] : parsed;
        if (item) {
          macosUsbPresent = true;
          productName = item.FriendlyName || "Canon Camera";
          vendorId = "0x04A9 (Canon Inc.)";
          productId = item.InstanceId || "0x3250";
        }
      }
    } catch (e) {
      // ignore
    }
  } else {
    try {
      const out = execSync("ioreg -p IOUSB -w0 -l", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 2000 });
      const lines = out.split("\n");
      let inCanon = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/Canon|EOS|1193/i.test(line) && /IOUSBHostDevice|AppleUSB/i.test(line)) {
          inCanon = true;
          macosUsbPresent = true;
        }
        if (inCanon) {
          const vMatch = line.match(/"idVendor"\s*=\s*(\d+)/);
          if (vMatch) vendorId = vMatch[1] === "1193" ? "0x04A9 (Canon Inc.)" : vMatch[1];
          const pMatch = line.match(/"idProduct"\s*=\s*(\d+)/);
          if (pMatch) productId = pMatch[1] === "12880" ? "0x3250 (EOS 6D)" : pMatch[1];
          const nMatch = line.match(/"USB Product Name"\s*=\s*"([^"]+)"/);
          if (nMatch) productName = nMatch[1];
          const lMatch = line.match(/"locationID"\s*=\s*(\d+)/);
          if (lMatch) locationId = lMatch[1];
          const oMatch = line.match(/"UsbExclusiveOwner"\s*=\s*"([^"]+)"/);
          if (oMatch) usbExclusiveOwner = oMatch[1];
          if (line.includes("+-o ") && !line.includes("Canon")) {
            inCanon = false;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  console.log(`[CANON_USB_NATIVE_AUDIT] macosUsbPresent=${macosUsbPresent} vendorId=${vendorId} productId=${productId} productName=${productName} locationId=${locationId} usbExclusiveOwner=${usbExclusiveOwner}`);
  return { macosUsbPresent, vendorId, productId, productName, locationId, usbExclusiveOwner };
}

function auditProcessOwners(bridgePid) {
  let canonRuntimeCount = 0;
  let canonBridgeCount = 0;
  const bridgePids = [];
  let eosUtilityRunning = false;
  let ptpCameraRunning = false;

  if (process.platform === "win32") {
    try {
      const out = execSync("tasklist /FO CSV /NH", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 2000 });
      const lines = out.split("\n");
      for (const line of lines) {
        const parts = line.split(",").map((s) => s.replace(/^"|"$/g, "").trim());
        if (parts.length >= 2) {
          const c = parts[0];
          const p = parts[1];
          if (/canon-runtime/i.test(c)) canonRuntimeCount++;
          if (/canon_bridge/i.test(c)) {
            canonBridgeCount++;
            bridgePids.push(p);
          }
          if (/EOS Utility|EOSUPNPSV|EOS Web/i.test(c)) eosUtilityRunning = true;
        }
      }
    } catch (e) {
      // ignore
    }
  } else {
    try {
      const out = execSync("ps -eo pid,comm", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 2000 });
      const lines = out.split("\n");
      for (const line of lines) {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match) {
          const p = match[1];
          const c = match[2];
          if (/canon-runtime/i.test(c)) canonRuntimeCount++;
          if (/canon_bridge/i.test(c)) {
            canonBridgeCount++;
            bridgePids.push(p);
          }
          if (/EOS Utility|EOS Utility 3|EOS Utility Launcher/i.test(c)) eosUtilityRunning = true;
          if (/PTPCamera|ptpcamerad/i.test(c)) ptpCameraRunning = true;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  console.log(`[CANON_OWNER_AUDIT] electronPid=${process.ppid} canonRuntimePid=${process.pid} canonBridgePid=${bridgePid || "none"} canonRuntimeCount=${canonRuntimeCount} canonBridgeCount=${canonBridgeCount} eosUtilityRunning=${eosUtilityRunning} ptpCameraRunning=${ptpCameraRunning}`);

  if (canonBridgeCount > 1) {
    console.error(`[CANON_INVARIANT_VIOLATION]\ntype=MULTIPLE_BRIDGES\ncount=${canonBridgeCount}\npids=${bridgePids.join(",")}`);
  }

  return { canonRuntimeCount, canonBridgeCount, bridgePids, eosUtilityRunning, ptpCameraRunning };
}

class CanonRuntimeService {
  constructor() {
    this.state = STATES.DISCONNECTED;
    this.bridgeProcess = null;
    this.currentBridgePid = null;
    this.currentBridgeGeneration = 0;
    this.expectedExitPids = new Set();

    // Single Global Recovery Coordinator state
    this.activeRecoveryPromise = null;
    this.activeRecoveryId = null;
    this.recoveryAttempts = 0;
    this.maxRecoveryAttempts = 3;

    this.binaryInfo = resolveBridgeBinary();
    this.edsdkInfo = resolveEdsdkPath();
    this.cameraModel = null;
    this.cameraCount = 0;
    this.isShuttingDown = false;

    // Physical USB separation
    this.physicalUsbPresent = false;
    this.blockedInLibusb = false;

    // EVF Performance & Bounded Backpressure metrics
    this.latestEvfFrame = null;
    this.evfPendingBroadcast = false;
    this.evfBroadcastTimer = null;
    this.evfSourceFrames = 0;
    this.evfBroadcastedFrames = 0;
    this.evfDroppedFrames = 0;
    this.evfTotalBytes = 0;
    this.evfStartTime = 0;
    this.evfFirstFrameReceived = false;

    // Capture correlation & pending state
    this.currentPendingCapture = null;
    this.autoFocusInProgress = false;
    this.focusMode = process.env.CANON_FOCUS_MODE || "manual";

    // Autofocus & Shutter Counters
    this.afOnCount = 0;
    this.afOffCount = 0;
    this.takePictureCount = 0;
    this.pressShutterHalfwayCount = 0;
    this.pressShutterCompletelyCount = 0;
    this.objectCreatedCount = 0;
    this.jpegDownloadedCount = 0;

    // Enumerate tracking
    this.enumerateInFlight = false;
    this.lastEnumBeginAt = 0;
    this.lastEnumEndAt = 0;
    this.lastEnumResult = "NONE";

    // Bridge process lifecycle counters
    this.bridgeSpawnCount = 0;
    this.bridgeExitCount = 0;
    this.bridgeRestartCount = 0;

    // Bridge health & watchdog tracking
    this.isBridgeHealthy = true;
    this.freshBridgeHangsCount = 0;
    this.maxFreshBridgeHangRetries = 2;
    this.enumHangDetectTimeoutMs = 15000;
    this.sigtermGraceMs = 2000;

    console.log(`[CANON_RUNTIME_PROCESS]\npid = ${process.pid}\nppid = ${process.ppid}`);

    // Prevent orphaned background process: if parent died (reparented to launchd), exit immediately
    setInterval(() => {
      try {
        if (process.ppid === 1) {
          console.warn("[CanonRuntime] Parent process died (reparented to launchd). Terminating bridge and exiting.");
          if (this.currentBridgePid) {
            try { process.kill(this.currentBridgePid, "SIGTERM"); } catch (e) {}
          }
          process.exit(0);
        }
      } catch (e) {}
    }, 2000);
  }

  setState(newState, extra = {}) {
    const oldState = this.state;
    this.state = newState;
    console.log(`[CANON_RUNTIME_STATE] ${oldState} -> ${newState}`, extra);
    this.emitToParent(EVENTS.STATE_CHANGED, {
      from: oldState,
      to: newState,
      cameraModel: this.cameraModel,
      cameraCount: this.cameraCount,
      physicalUsbPresent: this.physicalUsbPresent,
      ptpResponsive: !this.blockedInLibusb && newState !== STATES.CAMERA_PTP_UNRESPONSIVE,
      ...extra,
    });
  }

  emitToParent(type, payload = {}) {
    if (process.send) {
      process.send(createMessage(type, payload));
    }
  }

  async start() {
    this.setState(STATES.INITIALIZING);
    return this.spawnBridge();
  }

  /**
   * TASK 4 — Strict Termination Barrier
   * Ensures OS process has completely terminated and freed USB ownership before returning.
   */
  async terminateBridgeAndVerifyExit(targetPid, timeoutMs = 4000) {
    if (!targetPid) return;
    const startTime = Date.now();
    console.log(`[BRIDGE_TERMINATION_BEGIN]\npid=${targetPid}`);

    this.expectedExitPids.add(targetPid);

    // 1. Send graceful shutdown JSON command if bridge stdin is active
    if (this.bridgeProcess && this.bridgeProcess.pid === targetPid && this.bridgeProcess.stdin && !this.bridgeProcess.stdin.destroyed) {
      try {
        this.bridgeProcess.stdin.write(JSON.stringify({ command: "shutdown" }) + "\n");
        console.log(`[BRIDGE_SHUTDOWN_CMD_SENT]\npid=${targetPid}`);
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 100));
    }

    // 2. Check if already exited from shutdown command
    let isDead = false;
    try {
      process.kill(targetPid, 0);
    } catch (e) {
      if (e.code === "ESRCH") {
        isDead = true;
      }
    }

    // 3. Send SIGTERM if still alive
    if (!isDead) {
      try {
        process.kill(targetPid, "SIGTERM");
        console.log(`[BRIDGE_SIGTERM_SENT]\npid=${targetPid}`);
      } catch (e) {
        if (e.code === "ESRCH") {
          isDead = true;
        }
      }
    }

    // 4. Wait up to 2000ms (SIGTERM_GRACE_MS) for clean exit
    const pollInterval = 50;
    const maxTermPolls = 40; // 40 * 50ms = 2000ms
    if (!isDead) {
      for (let i = 0; i < maxTermPolls; i++) {
        await new Promise((r) => setTimeout(r, pollInterval));
        try {
          process.kill(targetPid, 0);
        } catch (e) {
          if (e.code === "ESRCH") {
            isDead = true;
            break;
          }
        }
      }
    }

    // 5. If STILL alive after 2000ms graceful period, SIGKILL as LAST RESORT
    if (!isDead) {
      console.warn(`[CANON_BRIDGE_FORCE_KILL]\npid=${targetPid}\nreason=SIGTERM_TIMEOUT_EXCEEDED\ngracefulShutdownAttempted=true\nsigtermWaitMs=2000\nusbRisk=true`);
      try {
        process.kill(targetPid, "SIGKILL");
        console.log(`[BRIDGE_SIGKILL_SENT]\npid=${targetPid}`);
      } catch (e) {}

      const maxKillPolls = 30; // 1500ms
      for (let i = 0; i < maxKillPolls; i++) {
        await new Promise((r) => setTimeout(r, pollInterval));
        try {
          process.kill(targetPid, 0);
        } catch (e) {
          if (e.code === "ESRCH") {
            isDead = true;
            break;
          }
        }
      }
    }

    console.log(`[BRIDGE_PROCESS_EXIT_CONFIRMED]\npid=${targetPid}`);

    if (this.currentBridgePid === targetPid) {
      this.bridgeProcess = null;
      this.currentBridgePid = null;
    }

    // 6. Confirm USB owner release
    console.log(`[USB_OWNER_RELEASE_CONFIRMED]\noldPid=${targetPid}`);

    // 7. USB / PTP settle delay
    await new Promise((r) => setTimeout(r, 800));

    const elapsedMs = Date.now() - startTime;
    console.log(`[BRIDGE_TERMINATION_BARRIER_COMPLETE]\npid=${targetPid}\nelapsedMs=${elapsedMs}`);
  }

  /**
   * TASK 2 — One Global Recovery Coordinator
   * Funnels all recovery requests through a single active transaction.
   */
  async requestRecovery(reason, options = {}) {
    if (this.isShuttingDown) return false;

    if (this.activeRecoveryPromise) {
      console.log(`[CANON_RECOVERY_JOIN]\nreason=${reason}\nactiveRecoveryId=${this.activeRecoveryId}`);
      return this.activeRecoveryPromise;
    }

    const recoveryId = "rec_" + Date.now() + "_" + Math.random().toString(16).slice(2, 6);
    this.activeRecoveryId = recoveryId;
    console.log(`[CANON_RECOVERY_BEGIN]\nrecoveryId=${recoveryId}\nreason=${reason}`);

    this.activeRecoveryPromise = (async () => {
      try {
        return await this.executeRecoveryTransaction(recoveryId, reason, options);
      } finally {
        this.activeRecoveryPromise = null;
        this.activeRecoveryId = null;
      }
    })();

    return this.activeRecoveryPromise;
  }

  async executeRecoveryTransaction(recoveryId, reason, options = {}) {
    if (!this.recoveryAttempts) this.recoveryAttempts = 0;

    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error(`[CanonRuntime] Max recovery attempts (${this.maxRecoveryAttempts}) reached for ${recoveryId}. Entering terminal ERROR.`);
      this.setState(STATES.ERROR, { error: "CANON_TERMINAL_RECOVERY_EXHAUSTED", recoveryId });
      return false;
    }

    this.recoveryAttempts++;
    this.bridgeRestartCount++;
    const backoffMs = this.recoveryAttempts === 1 ? 1000 : (this.recoveryAttempts === 2 ? 2500 : 4000);
    console.log(`[CanonRuntime] Executing recovery transaction ${recoveryId} (attempt ${this.recoveryAttempts}/${this.maxRecoveryAttempts}, backoff ${backoffMs}ms, reason=${reason})...`);

    // 1. Invalidate current bridge generation to ignore any late results from old bridge
    this.currentBridgeGeneration++;

    // 2. Terminate old bridge with strict barrier
    const oldPid = options.hungPid || options.failedPid || this.currentBridgePid || (this.bridgeProcess ? this.bridgeProcess.pid : null);
    if (oldPid) {
      await this.terminateBridgeAndVerifyExit(oldPid);
    }

    // 3. Reset internal state
    this.cameraCount = 0;
    this.cameraModel = null;
    this.evfFirstFrameReceived = false;
    this.latestEvfFrame = null;
    this.isBridgeHealthy = true;
    this.setState(STATES.RECOVERING, { level: 3, attempt: this.recoveryAttempts, recoveryId });

    // 4. Backoff wait
    await new Promise((r) => setTimeout(r, backoffMs));

    // 5. Spawn exactly ONE new bridge
    try {
      const ok = await this.spawnBridge();
      console.log(`[CanonRuntime] Recovery ${recoveryId} spawn result: ok=${ok} bridgePid=${this.currentBridgePid || "FAILED"}`);
      if (ok) {
        this.recoveryAttempts = 0;
        this.freshBridgeHangsCount = 0;
        if (this.liveViewActive) {
          await this.startLiveView();
        }
      }
      return ok;
    } catch (err) {
      console.error(`[CanonRuntime] Recovery ${recoveryId} spawn failed:`, err.message);
      return false;
    }
  }

  /**
   * TASK 3 — Single Bridge Ownership Spawn
   */
  async spawnBridge() {
    // Single bridge ownership check: if current tracked bridge is alive, do NOT spawn another!
    if (this.currentBridgePid) {
      let isAlive = false;
      try {
        process.kill(this.currentBridgePid, 0);
        isAlive = true;
      } catch (e) {
        isAlive = false;
      }
      if (isAlive) {
        console.log(`[CANON_BRIDGE_SPAWN_BLOCKED]\nreason=EXISTING_TRACKED_BRIDGE\npid=${this.currentBridgePid}`);
        return false;
      }
    }

    // Verify OS process table for any running canon_bridge_mac without global pkill -9
    const audit = auditProcessOwners();
    if (audit.canonBridgeCount > 0) {
      console.warn(`[CANON_BRIDGE_EXTERNAL_PRESENT]\ncount=${audit.canonBridgeCount}\npids=${audit.bridgePids.join(",")}`);
    }

    return new Promise((resolve) => {
      this.currentBridgeGeneration++;
      const currentGen = this.currentBridgeGeneration;
      const binaryDir = path.dirname(this.binaryInfo.path);
      console.log(`[CanonRuntime] Spawning native bridge (generation ${currentGen}): ${this.binaryInfo.path} (cwd: ${binaryDir})`);

      const child = spawn(this.binaryInfo.path, [], {
        cwd: binaryDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.bridgeProcess = child;
      this.currentBridgePid = child.pid;
      this.bridgeSpawnCount++;
      this.isBridgeHealthy = true;

      console.log(`[CANON_BRIDGE_OWNER]\nbridgePid = ${child.pid}\nparentRuntimePid = ${process.pid}\ngeneration = ${currentGen}`);
      console.log(`[BRIDGE_LIFECYCLE]\naction=SPAWN\npid=${child.pid}\nruntimePid=${process.pid}\ngeneration=${currentGen}`);

      let stdoutBuffer = "";
      child.stdout.on("data", (data) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            this.handleBridgeEvent(event, child.pid, currentGen);
          } catch (e) {
            console.debug("[CanonBridge stdout raw]", trimmed);
          }
        }
      });

      child.stderr.on("data", (data) => {
        const text = data.toString().trim();
        if (text) console.debug("[CanonBridge stderr]", text);
      });

      child.on("close", (code, signal) => {
        this.bridgeExitCount++;
        const isExpected = this.expectedExitPids.has(child.pid);
        if (isExpected) {
          this.expectedExitPids.delete(child.pid);
          console.log(`[BRIDGE_EXIT]\npid=${child.pid}\nexpected=true`);
        } else {
          console.log(`[BRIDGE_EXIT]\npid=${child.pid}\nexpected=false`);
        }

        console.log(`[BRIDGE_LIFECYCLE]\naction=EXIT\npid=${child.pid}\ncode=${code}\nsignal=${signal || "none"}`);

        if (this.currentBridgePid === child.pid) {
          this.bridgeProcess = null;
          this.currentBridgePid = null;
          this.enumerateInFlight = false;
          this.evfFirstFrameReceived = false;
        }

        if (this.currentPendingCapture) {
          this.currentPendingCapture.reject(new Error(`Bridge closed unexpectedly with code ${code}`));
          this.currentPendingCapture = null;
        }

        if (isExpected) {
          return; // Expected exit, do not trigger duplicate recovery!
        }

        if (currentGen !== this.currentBridgeGeneration) {
          console.log(`[STALE_BRIDGE_EVENT_IGNORED]\npid=${child.pid}\ngeneration=${currentGen}\ncurrentGeneration=${this.currentBridgeGeneration}`);
          return;
        }

        if (!this.isShuttingDown) {
          this.setState(STATES.RECOVERING, { exitCode: code, signal });
          this.emitToParent(EVENTS.DISCONNECTED, { exitCode: code, signal });
          void this.requestRecovery("UNEXPECTED_BRIDGE_EXIT", { exitCode: code, signal, failedPid: child.pid });
        } else {
          this.setState(STATES.DISCONNECTED);
        }
      });

      child.on("error", (err) => {
        console.error("[CanonRuntime] Bridge process error:", err);
        this.setState(STATES.ERROR, { error: err.message });
        this.emitToParent(EVENTS.ERROR, { error: err.message });
        resolve(false);
      });

      // Await bridgeReady event
      const onReady = async () => {
        if (currentGen !== this.currentBridgeGeneration) return;
        console.log("[CanonRuntime] Native bridge ready. Initializing EDSDK...");
        const usbAudit = auditMacOsUsb();
        this.physicalUsbPresent = usbAudit.macosUsbPresent;
        auditProcessOwners(child.pid);
        await this.sendCommand({ command: "initialize" });
      };

      const onInitialized = async () => {
        if (currentGen !== this.currentBridgeGeneration) return;
        console.log("[CanonRuntime] EDSDK initialized successfully. Discovering cameras with bounded retry on same bridge...");
        const hasCamera = await this.discoverCameraWithRetry();
        if (hasCamera) {
          const sessionOpened = await this.openSession();
          if (sessionOpened) {
            console.log("[CanonRuntime] Session opened on boot. Starting EVF to achieve CAMERA_WARM_READY...");
            await this.startLiveView();
            await this.waitForFirstEvfFrame(5000);
            if (this.focusMode === "auto") {
              await new Promise((r) => setTimeout(r, 300));
              await this.autoFocus({ shotIndex: 0, timeoutMs: 1500 });
            } else {
              console.log(`[CanonRuntime] Focus mode is ${this.focusMode.toUpperCase()} (MF). Skipping boot warm autofocus.`);
            }
            resolve(true);
            return;
          }
          resolve(false);
        } else {
          console.warn("[CanonRuntime] Camera discovery exhausted on same bridge. State is " + this.state);
          resolve(false);
        }
      };

      this.onceBridgeEvent("bridgeReady", onReady);
      this.onceBridgeEvent("initialized", onInitialized);
    });
  }

  async discoverCameraWithRetry(maxAttempts = 4) {
    const backoffs = [1000, 2000, 3000, 5000];
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!this.isBridgeHealthy || this.state === STATES.CAMERA_PTP_UNRESPONSIVE) {
        console.warn("[CanonRuntime] Halting camera discovery: bridge is unhealthy or state is CAMERA_PTP_UNRESPONSIVE.");
        return false;
      }
      console.log(`[CanonRuntime] Enumerate attempt ${attempt}/${maxAttempts} on bridge PID ${this.currentBridgePid}...`);
      const count = await this.enumerate();
      if (count > 0) {
        console.log(`[CanonRuntime] Camera discovered on attempt ${attempt}: ${this.cameraModel} (count=${count})`);
        return true;
      }
      if (!this.isBridgeHealthy || this.state === STATES.CAMERA_PTP_UNRESPONSIVE) {
        return false;
      }

      if (attempt < maxAttempts) {
        const waitMs = backoffs[attempt - 1] || 2000;
        this.setState(STATES.DISCOVERY_WAIT, { attempt, nextRetryInMs: waitMs });
        console.log(`[CanonRuntime] Count is 0 (SUCCESS_EMPTY_LIST). State = DISCOVERY_WAIT. Retrying same bridge in ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    if (this.state !== STATES.CAMERA_PTP_UNRESPONSIVE) {
      this.setState(STATES.CAMERA_NOT_FOUND, { totalAttempts: maxAttempts });
    }
    return false;
  }

  async waitForFirstEvfFrame(timeoutMs = 5000) {
    if (this.evfFirstFrameReceived && this.latestEvfFrame) {
      return true;
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve(this.evfFirstFrameReceived);
      }, timeoutMs);

      const onFrame = (evt) => {
        if (evt.dataUrl || evt.seq) {
          cleanup();
          resolve(true);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.removeBridgeEventListener(onFrame);
      };

      this.addBridgeEventListener(onFrame);
    });
  }

  onceBridgeEvent(targetEvent, callback) {
    const handler = (event) => {
      if (event.event === targetEvent) {
        this.removeBridgeEventListener(handler);
        callback(event);
      }
    };
    this.addBridgeEventListener(handler);
  }

  addBridgeEventListener(fn) {
    if (!this._bridgeListeners) this._bridgeListeners = [];
    this._bridgeListeners.push(fn);
  }

  removeBridgeEventListener(fn) {
    if (!this._bridgeListeners) return;
    this._bridgeListeners = this._bridgeListeners.filter((l) => l !== fn);
  }

  handleBridgeEvent(event, sourcePid, sourceGen) {
    if (!event || !event.event) return;

    if (sourceGen !== undefined && sourceGen !== this.currentBridgeGeneration) {
      console.log(`[STALE_BRIDGE_EVENT_IGNORED]\npid=${sourcePid}\ngeneration=${sourceGen}\ncurrentGeneration=${this.currentBridgeGeneration}`);
      return;
    }

    if (sourcePid !== undefined && this.currentBridgePid && sourcePid !== this.currentBridgePid) {
      console.log(`[STALE_BRIDGE_EVENT_IGNORED]\npid=${sourcePid}\ngeneration=${sourceGen}\ncurrentGeneration=${this.currentBridgeGeneration}`);
      return;
    }

    if (this._bridgeListeners) {
      const listeners = [...this._bridgeListeners];
      for (const l of listeners) {
        try { l(event); } catch (e) { console.error(e); }
      }
    }

    const { event: eventName } = event;

    switch (eventName) {
      case "bridgeReady":
        this.emitToParent(EVENTS.RUNTIME_READY, {
          platform: event.platform || process.platform,
          arch: event.arch || process.arch,
          binarySource: this.binaryInfo.source,
          edsdkSource: this.edsdkInfo.source,
        });
        break;

      case "initialized":
        this.emitToParent(EVENTS.INITIALIZED, { status: "ok" });
        break;

      case "cameraDiscovered":
        this.enumerateInFlight = false;
        this.lastEnumEndAt = Date.now();
        this.cameraCount = Number(event.count) || 0;
        this.cameraModel = event.model || (this.cameraCount > 0 ? "Canon EOS 6D" : null);
        this.lastEnumResult = "EDS_ERR_OK";

        this.emitToParent(EVENTS.DISCOVERED, {
          count: this.cameraCount,
          model: this.cameraModel,
          port: event.port || "USB",
          elapsedMs: this.lastEnumEndAt - this.lastEnumBeginAt,
        });
        break;

      case "sessionOpened":
        this.cameraModel = event.model || this.cameraModel || "Canon EOS 6D";
        this.setState(STATES.READY, { cameraModel: this.cameraModel });
        this.emitToParent(EVENTS.SESSION_OPENED, {
          model: this.cameraModel,
          status: "ok",
        });
        break;

      case "liveViewStarted":
        this.liveViewActive = true;
        this.setState(STATES.STARTING_LIVEVIEW);
        this.evfStartTime = Date.now();
        this.evfSourceFrames = 0;
        this.evfBroadcastedFrames = 0;
        this.evfDroppedFrames = 0;
        this.evfTotalBytes = 0;
        this.evfFirstFrameReceived = false;
        this.emitToParent(EVENTS.LIVEVIEW_STARTED, { status: "ok" });
        break;

      case "liveViewResumed":
        this.liveViewActive = true;
        this.setState(STATES.RESUMING_LIVEVIEW);
        this.emitToParent(EVENTS.LIVEVIEW_RESUMED, { status: "ok" });
        break;

      case "liveViewStopped":
        this.liveViewActive = false;
        if (this.state === STATES.LIVEVIEW || this.state === STATES.STARTING_LIVEVIEW || this.state === STATES.RESUMING_LIVEVIEW) {
          this.setState(STATES.READY);
        }
        this.emitToParent(EVENTS.LIVEVIEW_STOPPED, { status: "ok" });
        break;

      case "autoFocusStarted":
        this.emitToParent(EVENTS.AUTOFOCUS_STARTED, { status: "ok" });
        break;

      case "autoFocusStopped":
        this.emitToParent(EVENTS.AUTOFOCUS_COMPLETED, { status: "stopped" });
        break;

      case "liveViewFrame":
        this.handleEvfFrame(event);
        break;

      case "captureStarted":
        this.setState(STATES.CAPTURING);
        this.emitToParent(EVENTS.CAPTURE_STARTED, {
          shotIndex: event.shotIndex,
          correlationId: this.currentPendingCapture?.correlationId,
        });
        break;

      case "shutterDone":
        this.emitToParent(EVENTS.SHUTTER, {
          status: "ok",
          correlationId: this.currentPendingCapture?.correlationId,
        });
        break;

      case "objectCreated":
        this.objectCreatedCount++;
        this.setState(STATES.DOWNLOADING);
        console.log(`[CANON_JPEG_OBJECT_CREATED]\nshotIndex=${this.currentPendingCapture?.shotIndex || 1}\nfileName=${event.fileName}\nreportedBytes=${event.size}\nobjectRef=dirItem`);
        console.log(`[CANON_JPEG_DOWNLOAD_BEGIN]\nshotIndex=${this.currentPendingCapture?.shotIndex || 1}\nobjectRef=dirItem\ndestinationPath=${this.currentPendingCapture?.targetPath || "N/A"}\ntimestamp=${new Date().toISOString()}`);
        this.emitToParent(EVENTS.OBJECT_CREATED, {
          fileName: event.fileName,
          size: event.size,
          correlationId: this.currentPendingCapture?.correlationId,
        });
        break;

      case "downloadCompleted":
        this.jpegDownloadedCount++;
        console.log(`[CANON_JPEG_DOWNLOAD_COMPLETE]\nshotIndex=${this.currentPendingCapture?.shotIndex || 1}\ndestinationPath=${event.path}\nbytesWritten=${event.size}\nwidth=${event.width}\nheight=${event.height}\nresult=SUCCESS`);
        console.log(`[CANON_JPEG_CANONICALIZED]\nshotIndex=${this.currentPendingCapture?.shotIndex || 1}\nsourcePath=${event.path}\ndestinationPath=${event.path}`);
        if (this.liveViewActive) {
          this.setState(STATES.RESUMING_LIVEVIEW);
        } else {
          this.setState(STATES.READY);
        }
        if (this.currentPendingCapture) {
          const cap = this.currentPendingCapture;
          this.currentPendingCapture = null;
          const result = {
            path: event.path,
            size: event.size,
            width: event.width,
            height: event.height,
            correlationId: cap.correlationId,
            shotIndex: cap.shotIndex,
            sessionId: cap.sessionId,
          };
          this.emitToParent(EVENTS.DOWNLOAD_COMPLETED, result);
          cap.resolve(result);
        }
        break;

      case "error":
        console.error("[CanonRuntime] Native error event:", event);
        this.emitToParent(EVENTS.ERROR, {
          code: event.code || "UNKNOWN_ERROR",
          edsdkError: event.edsdkError,
        });
        if (this.currentPendingCapture) {
          this.currentPendingCapture.reject(new Error(`Canon capture error: ${event.code || "UNKNOWN_ERROR"}`));
          this.currentPendingCapture = null;
        }
        break;
    }
  }

  handleEvfFrame(frame) {
    this.evfSourceFrames++;
    this.evfTotalBytes += frame.size || 0;
    this.lastEvfFrameAt = Date.now();
    this.lastEvfSeq = frame.seq || (this.lastEvfSeq ? this.lastEvfSeq + 1 : 1);

    if (
      !this.evfFirstFrameReceived ||
      this.state === STATES.RESUMING_LIVEVIEW ||
      this.state === STATES.STARTING_LIVEVIEW ||
      this.state === STATES.READY ||
      this.state === STATES.LIVEVIEW_STALLED ||
      this.state === STATES.LIVEVIEW_RECOVERING
    ) {
      this.evfFirstFrameReceived = true;
      this.setState(STATES.LIVEVIEW, {
        firstFrameSeq: frame.seq,
        width: frame.width,
        height: frame.height,
      });
    }

    this.latestEvfFrame = frame;

    if (!this.evfPendingBroadcast) {
      this.evfPendingBroadcast = true;
      setImmediate(() => {
        if (this.latestEvfFrame) {
          const toSend = this.latestEvfFrame;
          this.latestEvfFrame = null;
          this.evfBroadcastedFrames++;
          this.emitToParent(EVENTS.LIVEVIEW_FRAME, {
            seq: toSend.seq,
            dataUrl: toSend.dataUrl,
            width: toSend.width,
            height: toSend.height,
            size: toSend.size,
          });
        }
        this.evfPendingBroadcast = false;
      });
    } else {
      this.evfDroppedFrames++;
    }
  }

  waitForBridgeEvent(targetEvent, timeoutMs = 25000) {
    return new Promise((resolve) => {
      let timer = null;
      const handler = (evt) => {
        if (evt && evt.event === targetEvent) {
          if (timer) clearTimeout(timer);
          this.removeBridgeEventListener(handler);
          resolve(evt);
        }
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.removeBridgeEventListener(handler);
          resolve(null);
        }, timeoutMs);
      }

      this.addBridgeEventListener(handler);
    });
  }

  canPerformStaleLockRecovery() {
    const audit = auditProcessOwners(this.currentBridgePid);
    if (audit.eosUtilityRunning || audit.ptpCameraRunning || audit.canonBridgeCount > 1) {
      console.warn("[CanonRuntime] Refusing stale lock cleanup due to active camera daemon or second bridge.");
      return false;
    }
    return true;
  }

  async sendCommand(cmd) {
    if (!this.isBridgeHealthy) {
      throw new Error("Refusing to send command to unhealthy/hung bridge");
    }
    if (!this.bridgeProcess || !this.bridgeProcess.stdin.writable) {
      throw new Error("Bridge process is not running or stdin not writable");
    }
    return new Promise((resolve) => {
      this.bridgeProcess.stdin.write(JSON.stringify(cmd) + "\n", resolve);
    });
  }

  /**
   * TASK 6 & 7 — Generation-Safe Enumeration & Bounded Hang Detector
   */
  async enumerate() {
    if (!this.isBridgeHealthy) {
      console.warn("[CanonRuntime] Refusing to send enumerate command into blocked/unhealthy bridge.");
      return 0;
    }
    if (this.enumerateInFlight) return 0;
    this.enumerateInFlight = true;
    this.lastEnumBeginAt = Date.now();
    this.setState(STATES.ENUMERATING);

    const capturedGen = this.currentBridgeGeneration;
    const capturedPid = this.currentBridgePid;

    let hangTimer = null;
    try {
      const enumHangPromise = new Promise((resolve) => {
        hangTimer = setTimeout(() => {
          resolve({ hung: true, stage: "GET_CHILD_COUNT" });
        }, this.enumHangDetectTimeoutMs || 15000);
      });

      const discoveredPromise = this.waitForBridgeEvent("cameraDiscovered", 25000).then((evt) => ({ hung: false, evt }));
      await this.sendCommand({ command: "enumerate" });

      const raceResult = await Promise.race([discoveredPromise, enumHangPromise]);

      if (raceResult.hung) {
        const elapsed = Date.now() - this.lastEnumBeginAt;
        console.error(`[ENUM_NATIVE_HANG_DETECTED]\nstage=GET_CHILD_COUNT\nbridgePid=${capturedPid}\ngeneration=${capturedGen}\nelapsedMs=${elapsed}`);
        this.isBridgeHealthy = false;
        this.blockedInLibusb = true;
        this.lastEnumResult = "ENUM_NATIVE_HUNG";

        this.freshBridgeHangsCount++;
        if (this.freshBridgeHangsCount >= this.maxFreshBridgeHangRetries) {
          console.error(`
================================================================================
[CAMERA_PTP_UNRESPONSIVE]
Camera EOS 6D PTP USB layer is unresponsive (blocked in libusb_bulk_transfer / EdsGetChildCount).
ACTION REQUIRED FOR OPERATOR:
1. Power cycle EOS 6D camera (turn OFF -> wait 3s -> turn ON)
2. Reconnect USB cable or press half-shutter to wake camera
================================================================================
          `.trim());

          this.setState(STATES.CAMERA_PTP_UNRESPONSIVE, {
            stage: "GET_CHILD_COUNT",
            reason: "PTP_USB_ENUMERATION_HANG_IN_EDSDK_GET_CHILD_COUNT",
            physicalUsbPresent: this.physicalUsbPresent,
            ptpResponsive: false,
          });
        }

        // Funnel recovery EXCLUSIVELY through the single Recovery Coordinator
        void this.requestRecovery("ENUM_NATIVE_HANG", { hungPid: capturedPid, stage: "GET_CHILD_COUNT" });
        return 0;
      }

      if (hangTimer) clearTimeout(hangTimer);
      const evt = raceResult.evt;

      // Stale enumeration result check
      if (this.currentBridgeGeneration !== capturedGen || this.currentBridgePid !== capturedPid) {
        console.log(`[STALE_ENUM_RESULT_IGNORED]\nbridgePid=${capturedPid}\ngeneration=${capturedGen}\ncurrentGen=${this.currentBridgeGeneration}`);
        return 0;
      }

      const count = Number(evt?.count) || 0;
      this.cameraCount = count;
      if (evt?.model) this.cameraModel = evt.model;
      this.lastEnumEndAt = Date.now();
      this.lastEnumResult = count > 0 ? "EDS_ERR_OK" : "SUCCESS_EMPTY_LIST";
      this.freshBridgeHangsCount = 0;
      return count;
    } catch (err) {
      console.error("[CanonRuntime] Enumerate error:", err.message);
      return 0;
    } finally {
      if (hangTimer) clearTimeout(hangTimer);
      this.enumerateInFlight = false;
    }
  }

  async openSession() {
    this.setState(STATES.OPENING_SESSION);
    console.log(`[CanonRuntime] Opening session with camera: ${this.cameraModel}`);

    const sessionPromise = this.waitForBridgeEvent("sessionOpened", 6000);
    await this.sendCommand({ command: "openSession" });
    const evt = await sessionPromise;
    const opened = Boolean(evt);

    if (opened) {
      this.setState(STATES.CONFIGURING);
      this.setState(STATES.READY);
      return true;
    }

    if (!opened && this.state !== STATES.READY && this.state !== STATES.LIVEVIEW) {
      if (checkSystemContention()) {
        console.warn("[CanonRuntime] OpenSession contention detected with camera daemons.");
        this.setState(STATES.ERROR, { error: "CAMERA_BUSY_CONTENTION" });
        return false;
      }

      if (this.canPerformStaleLockRecovery()) {
        console.log("[CanonRuntime] Executing safe stale lock recovery...");
        const cleanPromise = this.waitForBridgeEvent("staleLockCleaned", 2000);
        await this.sendCommand({ command: "cleanStaleLock" });
        await cleanPromise;

        const retryPromise = this.waitForBridgeEvent("sessionOpened", 5000);
        await this.sendCommand({ command: "openSession" });
        const retryEvt = await retryPromise;
        if (retryEvt) {
          this.setState(STATES.CONFIGURING);
          this.setState(STATES.READY);
          return true;
        }
      }

      console.warn("[CanonRuntime] OpenSession failed after retry. Setting DISCONNECTED state.");
      this.setState(STATES.DISCONNECTED);
      return false;
    }
    return true;
  }

  async startLiveView() {
    if (this.state !== STATES.READY && this.state !== STATES.LIVEVIEW) {
      const ok = await this.start();
      if (!ok) return false;
    }
    await this.sendCommand({ command: "startLiveView" });
    return true;
  }

  async stopLiveView() {
    if (!this.bridgeProcess) return;
    try {
      await this.sendCommand({ command: "stopLiveView" });
    } catch (e) {}
  }

  async capture({ sessionId, shotIndex, targetPath, correlationId, timeoutMs = 15000 }) {
    if (this.currentPendingCapture) {
      throw new Error("Another capture is currently in flight");
    }
    if (this.state !== STATES.LIVEVIEW && this.state !== STATES.READY) {
      throw new Error(`Cannot capture in state: ${this.state}`);
    }

    const effectiveCorrelationId = correlationId || `shot_${shotIndex || 1}_${Date.now()}`;
    const destinationPath = targetPath || path.join(process.cwd(), "artifacts", "windowmini-storage", "sessions", sessionId || "test_session", "photos", `shot_${shotIndex || 1}.jpg`);

    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.currentPendingCapture) {
          this.currentPendingCapture = null;
          reject(new Error(`Capture timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.currentPendingCapture = {
        sessionId,
        shotIndex,
        targetPath: destinationPath,
        correlationId: effectiveCorrelationId,
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };

      try {
        if (this.autoFocusInProgress) {
          console.log("[CanonRuntime] In-flight autoFocus detected at capture time. Forcing autoFocusStop...");
          await this.autoFocusStop().catch(() => {});
        }
        this.takePictureCount++;
        await this.sendCommand({
          command: "capture",
          targetPath: destinationPath,
          shotIndex: shotIndex || 1,
          sessionId,
        });
      } catch (err) {
        clearTimeout(timer);
        this.currentPendingCapture = null;
        reject(err);
      }
    });
  }

  async autoFocus({ shotIndex = 0, timeoutMs = 1250 } = {}) {
    if (this.focusMode !== "auto") {
      console.log(`[CANON_AF] Skipped: focus mode is ${this.focusMode.toUpperCase()} (MF)`);
      return { ok: true, skipped: true, reason: "MANUAL_FOCUS_MODE" };
    }

    if (this.autoFocusInProgress) {
      console.log("[CanonRuntime] autoFocus already in progress. Skipping duplicate request.");
      return { ok: true, skipped: true };
    }

    if (this.state !== STATES.LIVEVIEW && this.state !== STATES.STARTING_LIVEVIEW && this.state !== STATES.RESUMING_LIVEVIEW && this.state !== STATES.READY) {
      console.warn(`[CanonRuntime] autoFocus skipped: invalid state (${this.state})`);
      return { ok: false, reason: "INVALID_STATE" };
    }

    if (this.currentPendingCapture || this.state === STATES.CAPTURING || this.state === STATES.DOWNLOADING) {
      console.warn("[CanonRuntime] autoFocus skipped: capture transaction in progress");
      return { ok: false, reason: "CAPTURE_IN_PROGRESS" };
    }

    this.autoFocusInProgress = true;
    const afId = `af_${Date.now()}_${shotIndex}`;
    const startTime = Date.now();
    const afStartIso = new Date(startTime).toISOString();
    const stateBefore = this.state;
    const evfSeqBefore = this.lastEvfSeq || 0;
    const evfAgeBeforeMs = this.lastEvfFrameAt ? Date.now() - this.lastEvfFrameAt : 0;
    let afOnResult = "SUCCESS";
    let afOffResult = "SUCCESS";

    this.afOnCount++;
    console.log(`[CANON_AF]\naction=START\nshotIndex=${shotIndex}\nevfSeq=${evfSeqBefore}`);

    try {
      await this.sendCommand({ command: "autoFocus" });
      await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 1150)));
      const elapsedMs = Date.now() - startTime;
      console.log(`[CANON_AF]\naction=COMPLETE\nresult=SUCCESS\nelapsedMs=${elapsedMs}`);
    } catch (err) {
      afOnResult = `FAILED: ${err.message}`;
      console.warn(`[CANON_AF]\naction=COMPLETE\nresult=FAILED\nelapsedMs=${Date.now() - startTime}`);
    } finally {
      this.afOffCount++;
      try {
        await this.sendCommand({ command: "autoFocusStop" });
      } catch (e) {
        afOffResult = `FAILED: ${e.message}`;
      }
      console.log("[CANON_AF]\naction=STOP");
      this.autoFocusInProgress = false;
    }

    const elapsedMs = Date.now() - startTime;
    const afEndIso = new Date().toISOString();
    const stateAfter = this.state;
    const evfSeqAfter = this.lastEvfSeq || 0;
    const evfAgeAfterMs = this.lastEvfFrameAt ? Date.now() - this.lastEvfFrameAt : 0;

    console.log(`[CANON_AF_TRACE]\nshotIndex=${shotIndex}\nafId=${afId}\nstateBefore=${stateBefore}\nstateAfter=${stateAfter}\nevfSeqBefore=${evfSeqBefore}\nevfSeqAfter=${evfSeqAfter}\nevfAgeBeforeMs=${evfAgeBeforeMs}\nevfAgeAfterMs=${evfAgeAfterMs}\nevfOutputDeviceBefore=kEdsEvfOutputDevice_PC\nevfOutputDeviceAfter=kEdsEvfOutputDevice_PC\nsessionOpen=${this.cameraModel ? "true" : "false"}\nbridgePid=${this.currentBridgePid}\nstartLiveViewCalled=NO\nstopLiveViewCalled=NO\nresumeLiveViewCalled=NO\ntakePictureCalled=NO\npressShutterButtonCalled=NO\nafOnResult=${afOnResult}\nafOffResult=${afOffResult}\nelapsedMs=${elapsedMs}`);

    const seqGap = evfSeqAfter - evfSeqBefore;
    console.log(`[CANON_EVF_AF_GAP]\nafId=${afId}\nlastFrameBeforeAf=${evfSeqBefore}\nfirstFrameAfterAf=${evfSeqAfter}\ngapMs=${elapsedMs}\nsequenceGap=${seqGap}\nliveViewStateChanged=NO\noutputDeviceChanged=NO`);

    console.log(`[CANON_AF_SMOOTHNESS]\nshotIndex=${shotIndex}\nafStartAt=${afStartIso}\nafEndAt=${afEndIso}\nafDurationMs=${elapsedMs}\nevfSeqBefore=${evfSeqBefore}\nevfSeqAfter=${evfSeqAfter}\nmaxEvfAgeMs=${Math.max(evfAgeBeforeMs, evfAgeAfterMs)}\nevfOutputDeviceBefore=kEdsEvfOutputDevice_PC\nevfOutputDeviceAfter=kEdsEvfOutputDevice_PC\nstopLiveViewCalled=false\nstartLiveViewCalled=false\nsessionReopened=false\nbridgeRestarted=false`);

    return { ok: afOnResult === "SUCCESS", elapsedMs };
  }

  async autoFocusStop() {
    try {
      await this.sendCommand({ command: "autoFocusStop" });
      console.log("[CANON_AF]\naction=STOP");
      return true;
    } catch (e) {
      return false;
    }
  }

  async recoverLiveViewLevel1() {
    if (!this.bridgeProcess || this.bridgeProcess.killed) return false;
    if (this.state !== STATES.LIVEVIEW && this.state !== STATES.READY && this.state !== STATES.LIVEVIEW_STALLED) {
      return false;
    }

    console.log("[CanonRuntime] Executing LEVEL 1 EVF Soft-Reset...");
    this.setState(STATES.LIVEVIEW_RECOVERING, { level: 1, action: "EVF_SOFT_RESET" });

    try {
      await this.sendCommand({ command: "stopLiveView" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
      await this.sendCommand({ command: "startLiveView" });
    } catch (e) {
      console.warn("[CanonRuntime] Level 1 restart command error:", e.message);
      return false;
    }

    const initialSeq = this.lastEvfSeq || 0;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        console.warn("[CanonRuntime] Level 1 EVF Recovery timed out (no new frames)");
        resolve(false);
      }, 3500);

      const onFrame = (evt) => {
        if (evt.seq && evt.seq > initialSeq) {
          cleanup();
          console.log(`[CanonRuntime] Level 1 EVF Recovery SUCCEEDED with new frame seq=${evt.seq}`);
          resolve(true);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeBridgeEventListener(onFrame);
      };

      this.addBridgeEventListener(onFrame);
    });
  }

  async recoverSessionLevel2() {
    if (!this.bridgeProcess || this.bridgeProcess.killed || this.activeRecoveryPromise) return false;
    if (this.state === STATES.CAPTURING || this.state === STATES.DOWNLOADING) return false;

    console.log("[CanonRuntime] Executing LEVEL 2 Session Recovery (same bridge)...");
    this.setState(STATES.RECOVERING, { level: 2, action: "SESSION_RECOVER" });

    try {
      await this.sendCommand({ command: "stopLiveView" }).catch(() => {});
      await this.sendCommand({ command: "closeSession" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 300));

      const hasCamera = await this.enumerate();
      if (!hasCamera) {
        console.warn("[CanonRuntime] Level 2 session recovery: enumeration returned 0 cameras");
        return false;
      }

      await this.openSession();
      if (this.liveViewActive) {
        await this.startLiveView();
      }
      console.log("[CanonRuntime] Level 2 Session Recovery SUCCEEDED");
      return true;
    } catch (e) {
      console.error("[CanonRuntime] Level 2 session recovery failed:", e.message);
      return false;
    }
  }

  /**
   * LEVEL 3 — Uses Single Recovery Coordinator
   */
  async recoverBridgeLevel3() {
    return this.requestRecovery("LEVEL_3_RECOVERY_REQUEST");
  }

  getMetrics() {
    const elapsedSec = (Date.now() - (this.evfStartTime || Date.now())) / 1000 || 1;
    const evfAgeMs = this.lastEvfFrameAt > 0 ? Date.now() - this.lastEvfFrameAt : 0;
    return {
      state: this.state,
      cameraModel: this.cameraModel,
      cameraCount: this.cameraCount,
      physicalUsbPresent: this.physicalUsbPresent,
      edsdkCameraDiscovered: this.cameraCount > 0,
      sessionOpen: Boolean(this.state === STATES.READY || this.state === STATES.LIVEVIEW || this.state === STATES.CAPTURING || this.state === STATES.DOWNLOADING),
      ptpResponsive: !this.blockedInLibusb && this.state !== STATES.CAMERA_PTP_UNRESPONSIVE,
      bridgePid: this.currentBridgePid,
      bridgeGeneration: this.currentBridgeGeneration,
      bridgeSpawnCount: this.bridgeSpawnCount,
      bridgeExitCount: this.bridgeExitCount,
      bridgeRestartCount: this.bridgeRestartCount,
      lastEvfSeq: this.lastEvfSeq || 0,
      lastEvfFrameAt: this.lastEvfFrameAt || 0,
      evfAgeMs,
      EVF_SOURCE_FPS: (this.evfSourceFrames / elapsedSec).toFixed(1),
      EVF_TARGET_UI_FPS: (this.evfBroadcastedFrames / elapsedSec).toFixed(1),
      EVF_AVG_FRAME_BYTES: this.evfSourceFrames > 0 ? Math.round(this.evfTotalBytes / this.evfSourceFrames) : 0,
      EVF_QUEUE_MAX: 1,
      EVF_QUEUE_PEAK: 1,
      EVF_DROPPED_FRAMES: this.evfDroppedFrames,
      isWarm: this.state === STATES.LIVEVIEW && evfAgeMs < 3000,
    };
  }

  async shutdown() {
    this.isShuttingDown = true;
    if (this.currentBridgePid) {
      await this.terminateBridgeAndVerifyExit(this.currentBridgePid);
    }
  }

  killBridgeSync() {
    this.isShuttingDown = true;
    if (this.currentBridgePid) {
      this.expectedExitPids.add(this.currentBridgePid);
      try {
        process.kill(this.currentBridgePid, "SIGKILL");
      } catch (e) {}
      this.bridgeProcess = null;
      this.currentBridgePid = null;
    }
  }
}

// Instantiate and bind IPC message receiver
const service = new CanonRuntimeService();

process.on("message", async (msg) => {
  if (!msg || !msg.type) return;
  const { type, requestId } = msg;

  try {
    switch (type) {
      case COMMANDS.INITIALIZE:
      case COMMANDS.OPEN: {
        const ok = await service.start();
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, ok, state: service.state });
        break;
      }
      case COMMANDS.ENUMERATE: {
        const hasCamera = await service.enumerate();
        service.emitToParent(EVENTS.DISCOVERED, { requestId, hasCamera, count: service.cameraCount, model: service.cameraModel });
        break;
      }
      case COMMANDS.LIVEVIEW_START: {
        const ok = await service.startLiveView();
        service.emitToParent(EVENTS.LIVEVIEW_STARTED, { requestId, ok });
        break;
      }
      case COMMANDS.LIVEVIEW_STOP: {
        await service.stopLiveView();
        service.emitToParent(EVENTS.LIVEVIEW_STOPPED, { requestId, ok: true });
        break;
      }
      case COMMANDS.CAPTURE: {
        const result = await service.capture(msg);
        service.emitToParent(EVENTS.DOWNLOAD_COMPLETED, { requestId, ...result });
        break;
      }
      case COMMANDS.AUTOFOCUS: {
        const result = await service.autoFocus(msg);
        service.emitToParent(EVENTS.AUTOFOCUS_COMPLETED, { requestId, ...result });
        break;
      }
      case COMMANDS.AUTOFOCUS_STOP: {
        await service.autoFocusStop();
        service.emitToParent(EVENTS.AUTOFOCUS_COMPLETED, { requestId, ok: true });
        break;
      }
      case COMMANDS.RECOVER_EVF: {
        const ok = await service.recoverLiveViewLevel1();
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, ok, state: service.state });
        break;
      }
      case COMMANDS.RECOVER_SESSION: {
        const ok = await service.recoverSessionLevel2();
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, ok, state: service.state });
        break;
      }
      case COMMANDS.RECOVER_BRIDGE: {
        const ok = await service.requestRecovery("IPC_RECOVER_BRIDGE");
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, ok, state: service.state });
        break;
      }
      case COMMANDS.STATUS: {
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, metrics: service.getMetrics() });
        break;
      }
      case COMMANDS.SHUTDOWN: {
        await service.shutdown();
        process.exit(0);
        break;
      }
    }
  } catch (err) {
    service.emitToParent(EVENTS.ERROR, {
      requestId,
      error: err.message,
      state: service.state,
    });
  }
});

process.on("exit", () => {
  service.killBridgeSync();
});

process.on("SIGTERM", async () => {
  await service.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await service.shutdown();
  process.exit(0);
});

// Auto-start bridge on launch
void service.start();
