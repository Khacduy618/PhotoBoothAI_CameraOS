export interface PhotoboothMedia {
  id: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
  sizeBytes?: number;
  aspectRatio?: string;
}

export interface PhotoboothSession {
  id: string;
  code: string;
  boothName: string;
  location?: string;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  themeColor?: string;
  frameStyle?: 'classic_white' | 'dark_film' | 'pastel_pink' | 'retro_vintage' | 'cyber_neon' | 'custom';
  stripMedia: PhotoboothMedia;
  videoMedia?: PhotoboothMedia;
  rawPhotos: PhotoboothMedia[];
  gifMedia?: PhotoboothMedia;
  metadata?: {
    photographer?: string;
    filterApplied?: string;
    totalTakes?: number;
    printCopies?: number;
    kioskId?: string;
  };
}

export interface UploadSessionPayload {
  sessionId?: string;
  boothName: string;
  location?: string;
  frameStyle?: string;
  stripUrl: string;
  videoUrl?: string;
  rawPhotoUrls: string[];
  gifUrl?: string;
  expiryHours?: number;
  metadata?: Record<string, unknown>;
}
