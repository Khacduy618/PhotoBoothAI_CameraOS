import type { PrintJob, PrinterAdapter, PrinterCapabilities, PrinterConnectionStatus, PrinterInfo, PrintResult } from '@momentai/printer-contract';
import type { Result } from '@momentai/shared-types';

export class FakePrinterAdapter implements PrinterAdapter {
  private status: PrinterConnectionStatus = 'ready';

  async initialize(): Promise<Result<void>> {
    this.status = 'ready';
    return { ok: true, value: undefined };
  }

  async getPrinters(): Promise<PrinterInfo[]> {
    return [{ printerId: 'fake_cp1000', name: 'Fake Canon SELPHY CP1000', provider: 'fake', status: this.status }];
  }

  async getCapabilities(): Promise<Result<PrinterCapabilities>> {
    return { ok: true, value: { paperIds: ['4x6'], borderless: true, copies: { min: 1, max: 5 } } };
  }

  async print(job: PrintJob): Promise<Result<PrintResult>> {
    this.status = 'printing';
    this.status = 'ready';
    return { ok: true, value: { jobId: job.id, status: 'completed', message: 'Fake print completed.' } };
  }

  async getStatus(): Promise<PrinterConnectionStatus> {
    return this.status;
  }
}
