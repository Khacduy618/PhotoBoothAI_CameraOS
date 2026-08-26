import type { Result } from '@momentai/shared-types';

export * from './printer-profile';
export * from './cp1000-color-profile';

export type PrinterProvider = 'fake' | 'windows_print' | 'canon_cp1000';
export type PrinterConnectionStatus = 'unknown' | 'ready' | 'printing' | 'offline' | 'paper_out' | 'error';
export type PrintJobStatus =
  | 'queued'
  | 'validating'
  | 'preparing'
  | 'submitting'
  | 'submitted'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'requires_review'
  | 'cancelled';

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
  printerProfileId?: string;
  imagePath: string;
  paperId: string;
  copies: number;
  orientation: 'portrait' | 'landscape';
  borderless: boolean;
  status: PrintJobStatus;
  widthPx?: number;
  heightPx?: number;
  dpi?: number;
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

