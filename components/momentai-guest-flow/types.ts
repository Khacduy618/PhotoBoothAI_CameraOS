import type { GuestProductConfig } from "@/types/guest-product";

export type LayoutType = '1x1' | '1x2' | '1x3' | '2x2' | '1x4' | '2x3';

export type PaperSize = '4x6' | '6x8' | '2x6-double';

export interface FrameSlot {
  id: number;
  x: number; // percentage (0-100) or pixel coordinate relative to canvas
  y: number; // percentage (0-100)
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
  rotation?: number; // degrees
  borderRadius?: number;
}

export interface FrameTemplate {
  id: string;
  name: string;
  thumbnail: string;
  category: string;
  shotCount?: number; // 1, 2, 4, 6
  orientation?: 'portrait' | 'landscape';
  allowTyping?: boolean;
  allowDraw?: boolean;
  textPlaceholder?: string;
  layout: {
    type: LayoutType;
    slotCount: number;
  };
  slots: FrameSlot[];
  assets: {
    background: string; // color or image URL
    overlay?: string; // transparent PNG frame overlay URL or svg pattern
    overlayColor?: string; // fallback frame border color
    textColor?: string;
    borderWidth?: number;
  };
  supportedPapers: PaperSize[];
  preferredPaper: PaperSize;
  renderMode?: 'standard' | 'double-strip';
  eventBranding?: {
    text: string;
    subtext?: string;
    logoUrl?: string;
    showDate?: boolean;
  };
}

export interface PhotoItem {
  id: string;
  index: number;
  dataUrl: string;
  timestamp: string;
  isRetaken?: boolean;
}

export interface SessionData {
  sessionId: string;
  createdAt: string;
  product?: GuestProductConfig;
  captureCount: number;
  photos: PhotoItem[];
  selectedPhotoIndex?: number;
  selectedFrame?: FrameTemplate;
  slotAssignments: (PhotoItem | null)[]; // length matches selectedFrame.layout.slotCount
  paperSize?: PaperSize;
  customText?: string;
  drawDataUrl?: string;
  outputs?: {
    master?: string; // dataUrl
    share?: string; // dataUrl
    print?: string; // dataUrl
  };
  qr?: {
    url?: string;
    status: 'pending' | 'ready' | 'failed' | 'unavailable';
  };
  selectedPrintQuantity?: number;
  printStatus: 'idle' | 'queued' | 'rendering' | 'sending' | 'printing' | 'completed' | 'failed';
  copiesPrinted: number;
}

export interface CameraSettings {
  iso: number;
  shutterSpeed: string;
  aperture: string;
  focusMode: 'AI SERVO' | 'ONE SHOT' | 'MANUAL';
  connected: boolean;
  model: string;
  batteryLevel: number;
  temperature: number;
  shutterCount: number;
  mode: 'simulator' | 'webcam';
  liveViewRunning: boolean;
}

export interface PrinterSettings {
  connected: boolean;
  model: string;
  currentPaper: PaperSize;
  paperRemaining: number;
  paperTotal: number;
  autoPrint: boolean;
  copiesDefault: number;
  status: 'READY' | 'PRINTING' | 'OFFLINE' | 'PAPER_OUT' | 'ERROR';
}

export interface EventConfig {
  eventName: string;
  eventDate: string;
  hostName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  theme: 'dark' | 'light';
  customTagline: string;
}

export interface CaptureConfig {
  availableCounts: number[]; // e.g. [4, 6, 8]
  defaultCount: number;
  countdownSeconds: number;
  intervalSeconds: number;
  allowRetake: boolean;
}

export interface PrintJob {
  jobId: string;
  sessionId: string;
  frameId: string;
  paper: PaperSize;
  copies: number;
  fileDataUrl: string;
  createdAt: string;
  status: 'queued' | 'rendering' | 'sending' | 'printing' | 'completed' | 'failed';
  idempotencyKey: string;
}

export type GuestScreenState =
  | 'G01_START'
  | 'G01_ATTRACT'
  | 'G02_SELECT_PRODUCT'
  | 'G02_SELECT_SHOTS'
  | 'G02B_SELECT_PRINT_QTY'
  | 'G03_CAPTURE'
  | 'G04_SELECT_FRAME'
  | 'G04_SELECT_TEMPLATE'
  | 'G05_PREMIUM_CUSTOMIZE'
  | 'G05_DRAW'
  | 'G05_CUSTOMIZE'
  | 'G06_RESULT'
  | 'G06_FINAL_PREVIEW'
  | 'G07_PRINTING'
  | 'G07_PRINT_QR'
  | 'G08_PRINT_SUCCESS'
  | 'G08_DONE';
