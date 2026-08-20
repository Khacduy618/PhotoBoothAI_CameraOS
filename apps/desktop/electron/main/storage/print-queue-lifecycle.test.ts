import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type DatabaseType = InstanceType<typeof Database>;

const TEST_DIR = path.join(process.cwd(), 'artifacts', 'test-print-queue-storage');
const TEST_DB_PATH = path.join(TEST_DIR, 'test-storage.sqlite');

interface PrintJobRecord {
  id: string;
  session_id: string;
  print_master_path: string;
  paper_id: string;
  copies: number;
  status: 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  idempotency_key: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

class TestMockPrinterAdapter {
  public printCallCount = 0;
  public shouldFail = false;

  async print(job: PrintJobRecord): Promise<{ ok: boolean; value?: { jobId: string; status: string }; error?: { message: string } }> {
    this.printCallCount++;
    if (this.shouldFail) {
      return { ok: false, error: { message: 'Simulated paper jam' } };
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { ok: true, value: { jobId: job.id, status: 'COMPLETED' } };
  }
}

class TestPrintQueueManager {
  public db: DatabaseType;
  public queue: string[] = [];
  public isProcessing = false;
  public adapter: TestMockPrinterAdapter;
  public onJobCompleted?: (sessionId: string, jobId: string) => void;

  constructor(db: DatabaseType, adapter: TestMockPrinterAdapter) {
    this.db = db;
    this.adapter = adapter;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        print_master_path TEXT NOT NULL,
        paper_id TEXT NOT NULL,
        copies INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL,
        idempotency_key TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    const rows = this.db.prepare("SELECT * FROM print_jobs WHERE status IN ('QUEUED', 'PRINTING') ORDER BY created_at ASC").all() as PrintJobRecord[];
    for (const row of rows) {
      if (row.status === 'PRINTING') {
        const now = new Date().toISOString();
        this.db.prepare("UPDATE print_jobs SET status = 'QUEUED', updated_at = ? WHERE id = ?").run(now, row.id);
      }
      this.queue.push(row.id);
    }
  }

  enqueue(sessionId: string, options: { printMasterPath?: string; paperId?: string; copies?: number; idempotencyKey?: string } = {}) {
    const idempotencyKey = options.idempotencyKey || `${sessionId}_print_default`;
    const existing = this.db.prepare("SELECT * FROM print_jobs WHERE idempotency_key = ?").get(idempotencyKey) as PrintJobRecord | undefined;
    if (existing) {
      return { ok: true, value: existing, idempotent: true };
    }

    const now = new Date().toISOString();
    const jobId = `print_${sessionId}_${Date.now().toString(36)}`;
    const job: PrintJobRecord = {
      id: jobId,
      session_id: sessionId,
      print_master_path: options.printMasterPath || `/outputs/${sessionId}/final-print.jpg`,
      paper_id: options.paperId || '4x6',
      copies: options.copies || 1,
      status: 'QUEUED',
      idempotency_key: idempotencyKey,
      attempt_count: 0,
      last_error: null,
      created_at: now,
      started_at: null,
      completed_at: null,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO print_jobs (
        id, session_id, print_master_path, paper_id, copies, status, idempotency_key, attempt_count, last_error, created_at, started_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id, job.session_id, job.print_master_path, job.paper_id, job.copies, job.status,
      job.idempotency_key, job.attempt_count, job.last_error, job.created_at, job.started_at, job.completed_at, job.updated_at
    );

    this.queue.push(job.id);
    return { ok: true, value: job, idempotent: false };
  }

  async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const jobId = this.queue.shift();
    if (!jobId) {
      this.isProcessing = false;
      return;
    }

    const jobRow = this.db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(jobId) as PrintJobRecord | undefined;
    if (!jobRow || jobRow.status !== 'QUEUED') {
      this.isProcessing = false;
      return this.processNext();
    }

    const now = new Date().toISOString();
    this.db.prepare("UPDATE print_jobs SET status = 'PRINTING', started_at = ?, updated_at = ? WHERE id = ?").run(now, now, jobId);

    const printResult = await this.adapter.print(jobRow);

    if (printResult.ok) {
      const completedNow = new Date().toISOString();
      this.db.prepare("UPDATE print_jobs SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?").run(completedNow, completedNow, jobId);
      this.onJobCompleted?.(jobRow.session_id, jobId);
    } else {
      const nextAttempts = (jobRow.attempt_count || 0) + 1;
      const errNow = new Date().toISOString();
      const errMsg = printResult.error?.message || 'Print error';

      if (nextAttempts < 2) {
        this.db.prepare("UPDATE print_jobs SET status = 'QUEUED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, errMsg, errNow, jobId);
        this.queue.push(jobId);
      } else {
        this.db.prepare("UPDATE print_jobs SET status = 'FAILED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, errMsg, errNow, jobId);
      }
    }

    this.isProcessing = false;
    if (this.queue.length > 0) {
      await this.processNext();
    }
  }
}

describe('Background Print Queue & Lifecycle Specification', () => {
  let db: DatabaseType;
  let adapter: TestMockPrinterAdapter;

  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = new Database(TEST_DB_PATH);
    adapter = new TestMockPrinterAdapter();
  });

  afterEach(() => {
    (db as any).close();
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch {}
    }
  });

  it('1. Enqueues PrintJob durably into SQLite with status QUEUED', () => {
    const queue = new TestPrintQueueManager(db, adapter);
    queue.init();

    const res = queue.enqueue('session_001', { copies: 2 });
    expect(res.ok).toBe(true);
    expect(res.value?.status).toBe('QUEUED');
    expect(res.value?.copies).toBe(2);

    const row = db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(res.value!.id) as PrintJobRecord;
    expect(row).toBeDefined();
    expect(row.session_id).toBe('session_001');
    expect(row.status).toBe('QUEUED');
  });

  it('2. Enforces idempotency on duplicate print requests', () => {
    const queue = new TestPrintQueueManager(db, adapter);
    queue.init();

    const first = queue.enqueue('session_001', { idempotencyKey: 'idemp_key_1', copies: 1 });
    const second = queue.enqueue('session_001', { idempotencyKey: 'idemp_key_1', copies: 1 });

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.value?.id).toBe(first.value?.id);

    const count = db.prepare("SELECT COUNT(*) as count FROM print_jobs").get() as { count: number };
    expect(count.count).toBe(1);
  });

  it('3. Processes print jobs in FIFO order in the background', async () => {
    const queue = new TestPrintQueueManager(db, adapter);
    queue.init();

    const j1 = queue.enqueue('session_001', { copies: 1 });
    const j2 = queue.enqueue('session_002', { copies: 2 });

    expect(queue.queue).toHaveLength(2);

    await queue.processNext();

    expect(adapter.printCallCount).toBe(2);

    const row1 = db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(j1.value!.id) as PrintJobRecord;
    const row2 = db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(j2.value!.id) as PrintJobRecord;

    expect(row1.status).toBe('COMPLETED');
    expect(row1.completed_at).toBeDefined();
    expect(row2.status).toBe('COMPLETED');
    expect(row2.completed_at).toBeDefined();
  });

  it('4. Recovers pending and stale PRINTING jobs on restart', () => {
    const queue1 = new TestPrintQueueManager(db, adapter);
    queue1.init();

    const j1 = queue1.enqueue('session_001', { copies: 1 });
    const j2 = queue1.enqueue('session_002', { copies: 1 });

    // Simulate crash while j1 was PRINTING
    db.prepare("UPDATE print_jobs SET status = 'PRINTING' WHERE id = ?").run(j1.value!.id);

    // New instance boots up
    const queue2 = new TestPrintQueueManager(db, adapter);
    queue2.init();

    expect(queue2.queue).toContain(j1.value!.id);
    expect(queue2.queue).toContain(j2.value!.id);

    const recoveredRow1 = db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(j1.value!.id) as PrintJobRecord;
    expect(recoveredRow1.status).toBe('QUEUED');
  });

  it('5. Handles bounded retry and records failure on maximum attempts', async () => {
    adapter.shouldFail = true;
    const queue = new TestPrintQueueManager(db, adapter);
    queue.init();

    const j = queue.enqueue('session_fail', { copies: 1 });
    await queue.processNext();

    const row = db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(j.value!.id) as PrintJobRecord;
    expect(row.status).toBe('FAILED');
    expect(row.attempt_count).toBe(2);
    expect(row.last_error).toBe('Simulated paper jam');
  });

  it('6. Fires onJobCompleted callback to trigger backend session completion', async () => {
    const queue = new TestPrintQueueManager(db, adapter);
    queue.init();

    let completedSessionId = '';
    queue.onJobCompleted = (sessionId) => {
      completedSessionId = sessionId;
    };

    queue.enqueue('session_complete_test', { copies: 1 });
    await queue.processNext();

    expect(completedSessionId).toBe('session_complete_test');
  });
});
