import { PrinterSettings, PrintJob, PaperSize } from '../types';

export class PrinterService {
  private settings: PrinterSettings = {
    connected: true,
    model: 'DNP DS620 Dye-Sub Photo Printer',
    currentPaper: '4x6',
    paperRemaining: 382,
    paperTotal: 400,
    autoPrint: false,
    copiesDefault: 1,
    status: 'READY',
  };

  private queue: PrintJob[] = [];
  private processedKeys: Set<string> = new Set();

  public getSettings(): PrinterSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<PrinterSettings>) {
    this.settings = { ...this.settings, ...partial };
  }

  public getQueue(): PrintJob[] {
    return [...this.queue];
  }

  public async createPrintJob(
    sessionId: string,
    frameId: string,
    paper: PaperSize,
    copies: number,
    fileDataUrl: string
  ): Promise<{ success: boolean; job?: PrintJob; error?: string }> {
    if (!this.settings.connected) {
      return { success: false, error: 'Printer is disconnected or offline' };
    }

    if (this.settings.paperRemaining < copies) {
      this.settings.status = 'PAPER_OUT';
      return { success: false, error: 'Insufficient paper in photo printer' };
    }

    // Section 45: Duplicate Print Protection via Idempotency Key
    const idempotencyKey = `${sessionId}_${frameId}_${paper}_${copies}`;
    if (this.processedKeys.has(idempotencyKey)) {
      const existing = this.queue.find((j) => j.idempotencyKey === idempotencyKey);
      if (existing) {
        return { success: true, job: existing };
      }
    }

    const job: PrintJob = {
      jobId: `job_${Math.random().toString(36).substring(2, 9)}`,
      sessionId,
      frameId,
      paper,
      copies,
      fileDataUrl,
      createdAt: new Date().toISOString(),
      status: 'queued',
      idempotencyKey,
    };

    this.queue.push(job);
    this.processedKeys.add(idempotencyKey);

    // Process job async
    this.processQueue();

    return { success: true, job };
  }

  private async processQueue() {
    const pending = this.queue.find((j) => j.status === 'queued');
    if (!pending) return;

    pending.status = 'rendering';
    this.settings.status = 'PRINTING';

    await new Promise((r) => setTimeout(r, 800));
    pending.status = 'sending';

    await new Promise((r) => setTimeout(r, 1500));
    pending.status = 'printing';

    await new Promise((r) => setTimeout(r, 2000));
    pending.status = 'completed';

    this.settings.paperRemaining = Math.max(0, this.settings.paperRemaining - pending.copies);
    this.settings.status = 'READY';

    // Process next if any
    this.processQueue();
  }

  public async runTestPrint(): Promise<boolean> {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1200;
    testCanvas.height = 1800;
    const ctx = testCanvas.getContext('2d')!;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1200, 1800);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOMENTAI CAMERAOS', 600, 800);
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px sans-serif';
    ctx.fillText('PRINTER TEST PATTERN (PASSED)', 600, 900);

    const res = await this.createPrintJob(
      'TEST_SESSION',
      'TEST_FRAME',
      this.settings.currentPaper,
      1,
      testCanvas.toDataURL('image/jpeg')
    );

    return res.success;
  }
}

export const printerService = new PrinterService();
