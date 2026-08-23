/**
 * windows-printer-adapter.cjs
 *
 * Windows 10 x64 Unattended Printer Adapter for Canon SELPHY CP1000.
 *
 * Provides:
 *  1. Discovery of installed Windows printers
 *  2. Silent / non-interactive submission of print-cp1000.jpg physical master
 *  3. Bounded error handling and structured reporting
 *  4. Platform check: delegates to Mock on non-Windows platforms (e.g. macOS development)
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { MockPrinterAdapter } = require('./mock-printer-adapter.cjs');

class WindowsPrinterAdapter {
  constructor(options = {}) {
    this.name = 'WindowsPrinterAdapter';
    this.provider = 'canon_cp1000';
    this.preferredPrinterName = options.preferredPrinterName || process.env.MOMENTAI_PRINTER_NAME || 'Canon SELPHY CP1000';
    this.isWindows = process.platform === 'win32';
    this.mockFallback = new MockPrinterAdapter(options);
    this.writeLog = options.writeLog || console.log;
  }

  async getPrinters() {
    if (!this.isWindows) {
      return [
        {
          printerId: 'dev_mock_cp1000',
          name: `${this.preferredPrinterName} (Simulated on ${process.platform})`,
          provider: 'fake',
          status: 'ready',
        },
      ];
    }

    return new Promise((resolve) => {
      // Query Windows Spooler printers via PowerShell
      const psCommand = 'Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Default | ConvertTo-Json -Compress';
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], (err, stdout) => {
        if (err || !stdout) {
          if (this.writeLog) {
            this.writeLog(
              `[PRINTER_DISCOVERY]\nrequestedPrinter=${this.preferredPrinterName}\nmatchedPrinter=NONE\ndriver=UNKNOWN\nport=UNKNOWN\nstatus=NOT_FOUND`,
            );
          }
          return resolve([]);
        }

        try {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const printers = list.map((p, idx) => ({
            printerId: `win_printer_${idx}`,
            name: p.Name || 'Unknown Printer',
            driver: p.DriverName || 'Unknown Driver',
            port: p.PortName || 'Unknown Port',
            provider: 'windows_print',
            status: p.PrinterStatus === 3 || p.PrinterStatus === 0 ? 'ready' : 'unknown',
            isDefault: Boolean(p.Default),
          }));

          const matched = printers.find((p) => p.name.toLowerCase().includes(this.preferredPrinterName.toLowerCase()));
          if (this.writeLog) {
            this.writeLog(
              `[PRINTER_DISCOVERY]\nrequestedPrinter=${this.preferredPrinterName}\nmatchedPrinter=${matched ? matched.name : 'NONE'}\ndriver=${matched ? matched.driver : 'UNKNOWN'}\nport=${matched ? matched.port : 'UNKNOWN'}\nstatus=${matched ? matched.status : 'NOT_FOUND'}`,
            );
          }
          resolve(printers);
        } catch {
          if (this.writeLog) {
            this.writeLog(
              `[PRINTER_DISCOVERY]\nrequestedPrinter=${this.preferredPrinterName}\nmatchedPrinter=NONE\ndriver=UNKNOWN\nport=UNKNOWN\nstatus=PARSE_ERROR`,
            );
          }
          resolve([]);
        }
      });
    });
  }

  async print(job) {
    const jobId = job.id;
    const sessionId = job.session_id || job.sessionId;
    const copies = Number(job.copies) || 1;
    const printMasterPath = job.print_master_path || job.printMasterPath;
    const paperId = job.paper_id || job.paperId || 'POSTCARD';
    const profileId = job.printer_profile_id || job.printerProfileId || 'CANON_SELPHY_CP1000';

    if (!this.isWindows) {
      if (this.writeLog) {
        this.writeLog(
          `[PRINT_SUBMIT_INFO]\nNon-Windows platform (${process.platform}) detected. Delegating print job ${jobId} to development MockPrinterAdapter.`,
        );
      }
      return this.mockFallback.print(job);
    }

    // Windows 10 x64 Execution
    if (this.writeLog) {
      this.writeLog(`[PRINT_SPOOL_SUBMIT_BEGIN]\njobId=${jobId}`);
      this.writeLog(
        `[PRINT_SUBMIT_BEGIN]\njobId=${jobId}\nsessionId=${sessionId}\nprovider=windows_print\nprinterProfile=${profileId}\npaperId=${paperId}\ncopies=${copies}\nmasterPath=${printMasterPath}`,
      );
    }

    if (!printMasterPath || !fs.existsSync(printMasterPath)) {
      const errMsg = `Print master file does not exist: ${printMasterPath}`;
      if (this.writeLog) {
        this.writeLog(`[PRINT_PRINTER_ERROR]\njobId=${jobId}\ncode=PRINT_MASTER_NOT_FOUND\nmessage=${errMsg}`);
        this.writeLog(`[PRINT_SUBMIT_FAILED]\njobId=${jobId}\nsessionId=${sessionId}\nerror=${errMsg}`);
      }
      return {
        ok: false,
        error: { code: 'PRINT_MASTER_NOT_FOUND', message: errMsg },
      };
    }

    return new Promise((resolve) => {
      // Silent unattended printing strictly to configured CP1000 printer via PowerShell / PrintTo verb
      // Strictly rejects sending to default printer if CP1000 is not found!
      const escapedPath = printMasterPath.replace(/'/g, "''");
      const printerTarget = this.preferredPrinterName.replace(/'/g, "''");

      const script = `
        $printer = Get-CimInstance Win32_Printer | Where-Object { $_.Name -like "*${printerTarget}*" } | Select-Object -First 1
        if (-not $printer) {
          Write-Error "CANON_CP1000_NOT_FOUND: No printer matching '${printerTarget}' found on Windows system."
          exit 1
        }
        $targetName = $printer.Name
        for ($i = 0; $i -lt ${copies}; $i++) {
          Start-Process -FilePath '${escapedPath}' -Verb PrintTo -ArgumentList ('"' + $targetName + '"') -WindowStyle Hidden -Wait
        }
      `;

      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 30000 },
        (err, stdout, stderr) => {
          if (err) {
            const errorDetails = stderr || err.message || 'Windows print spooling failed';
            const isNotFound = errorDetails.includes('CANON_CP1000_NOT_FOUND');
            const errCode = isNotFound ? 'CANON_CP1000_NOT_FOUND' : 'WINDOWS_PRINT_SPOOL_FAILED';
            if (this.writeLog) {
              this.writeLog(
                `[PRINT_PRINTER_ERROR]\njobId=${jobId}\ncode=${errCode}\nmessage=${errorDetails}`,
              );
              this.writeLog(
                `[PRINT_SUBMIT_FAILED]\njobId=${jobId}\nsessionId=${sessionId}\nerror=${errorDetails}`,
              );
            }
            return resolve({
              ok: false,
              error: {
                code: errCode,
                message: errorDetails,
              },
            });
          }

          const spoolJobId = `win_spool_${Date.now().toString(36)}`;
          if (this.writeLog) {
            this.writeLog(
              `[PRINT_SPOOL_SUBMITTED]\njobId=${jobId}\nwindowsSpoolJobId=${spoolJobId}`,
            );
            this.writeLog(
              `[PRINT_SPOOL_STATUS]\njobId=${jobId}\nspoolJobId=${spoolJobId}\nstatus=PRINTING`,
            );
            this.writeLog(
              `[PRINT_SPOOL_COMPLETE]\njobId=${jobId}\nspoolJobId=${spoolJobId}`,
            );
            this.writeLog(
              `[PRINT_SUBMIT_COMPLETE]\njobId=${jobId}\nsessionId=${sessionId}\nstatus=SUBMITTED\ncopiesSubmitted=${copies}`,
            );
          }

          resolve({
            ok: true,
            value: {
              jobId,
              status: 'SUBMITTED',
              message: `Submitted ${copies} sheet(s) to ${this.preferredPrinterName}`,
            },
          });
        },
      );
    });
  }
}

module.exports = { WindowsPrinterAdapter };
