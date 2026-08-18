import type { Result } from '@momentai/shared-types';

export type PrinterProvider = 'fake' | 'windows_print';
export type PrinterConnectionStatus = 'unknown' | 'ready' | 'printing' | 'offline' | 'paper_out' | 'error';
export type PrintJobStatus = 'queued' | 'validating' | 'printing' | 'completed' | 'failed';

export interface PrinterInfo {
  printerId: string;
  name: string;
  provider: PrinterProvider;
  status: PrinterConnectionStatus;
}

export interface PrinterCapabilities {
  paperIds: string[];
  borderless: boolean;
  copies: { min: number; max: number };
}

export interface PrintJob {
  id: string;
  sessionId: string;
  printerId: string;
  imagePath: string;
  paperId: '4x6';
  copies: number;
  orientation: 'portrait' | 'landscape';
  borderless: boolean;
  status: PrintJobStatus;
}

export interface PrintResult {
  jobId: string;
  status: PrintJobStatus;
  message?: string;
}

export interface PrinterAdapter {
  initialize(): Promise<Result<void>>;
  getPrinters(): Promise<PrinterInfo[]>;
  getCapabilities(printerId: string): Promise<Result<PrinterCapabilities>>;
  print(job: PrintJob): Promise<Result<PrintResult>>;
  getStatus(printerId: string): Promise<PrinterConnectionStatus>;
}
