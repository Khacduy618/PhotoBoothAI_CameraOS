import express, { Request, Response } from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface SessionStore {
  [key: string]: any;
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Upload directory setup for photobooth files uploaded directly from Electron
const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `pb-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// In-memory session store pre-populated with realistic initial photobooth sessions
const memorySessions: SessionStore = {
  "PB-KOREA-8821": {
    id: "PB-KOREA-8821",
    code: "8821",
    boothName: "K-STUDIO 4-CUTS",
    location: "Chi nhánh Sài Gòn Centre, Quận 1",
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 47.5).toISOString(),
    frameStyle: "pastel_pink",
    themeColor: "#ff758c",
    stripMedia: {
      id: "strip-1",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=80",
      name: "Photostrip_KStudio_8821.jpg",
      type: "image",
      width: 1200,
      height: 3600,
      aspectRatio: "1:3"
    },
    videoMedia: {
      id: "video-1",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
      name: "LiveBoomerang_8821.mp4",
      type: "video",
      width: 1080,
      height: 1920,
      sizeBytes: 4200000
    },
    rawPhotos: [
      {
        id: "raw-1",
        url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
        name: "Shot_01_KStudio_8821.jpg",
        type: "image"
      },
      {
        id: "raw-2",
        url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
        name: "Shot_02_KStudio_8821.jpg",
        type: "image"
      },
      {
        id: "raw-3",
        url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
        name: "Shot_03_KStudio_8821.jpg",
        type: "image"
      },
      {
        id: "raw-4",
        url: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80",
        name: "Shot_04_KStudio_8821.jpg",
        type: "image"
      }
    ],
    metadata: {
      photographer: "Auto Kiosk #04",
      filterApplied: "Seoul Glow & Soft Peach",
      totalTakes: 8,
      printCopies: 2,
      kioskId: "KIOSK-VN-HCM-04"
    }
  },
  "PB-WEDDING-9902": {
    id: "PB-WEDDING-9902",
    code: "9902",
    boothName: "💍 MINH & THẢO WEDDING PHOTOBOOTH",
    location: "Trung tâm Tiệc cưới GEM Center, TP.HCM",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 70).toISOString(),
    frameStyle: "classic_white",
    themeColor: "#d4af37",
    stripMedia: {
      id: "strip-2",
      url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1080&q=80",
      name: "Wedding_Strip_MinhThao_9902.jpg",
      type: "image",
      width: 1200,
      height: 3600,
      aspectRatio: "1:3"
    },
    videoMedia: {
      id: "video-2",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80",
      name: "Wedding_BehindTheScenes_9902.mp4",
      type: "video",
      width: 1080,
      height: 1920,
      sizeBytes: 5800000
    },
    rawPhotos: [
      {
        id: "raw-w1",
        url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
        name: "Wedding_Shot_01.jpg",
        type: "image"
      },
      {
        id: "raw-w2",
        url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80",
        name: "Wedding_Shot_02.jpg",
        type: "image"
      },
      {
        id: "raw-w3",
        url: "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80",
        name: "Wedding_Shot_03.jpg",
        type: "image"
      },
      {
        id: "raw-w4",
        url: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80",
        name: "Wedding_Shot_04.jpg",
        type: "image"
      }
    ],
    metadata: {
      photographer: "Wedding Photobooth Kiosk #1",
      filterApplied: "Golden Champagne Radiance",
      totalTakes: 6,
      printCopies: 4,
      kioskId: "WEDDING-GEM-01"
    }
  }
};

// API: Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API: Get all active sessions
app.get("/api/photobooth/sessions", (_req: Request, res: Response) => {
  const list = Object.values(memorySessions).sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ success: true, count: list.length, sessions: list });
});

// API: Get latest session from Cloud
app.get("/api/photobooth/latest", (_req: Request, res: Response) => {
  const list = Object.values(memorySessions).sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (list.length > 0) {
    res.json({ success: true, session: list[0] });
  } else {
    res.status(404).json({ success: false, message: "Chưa có phiên chụp nào trong hệ thống Cloud." });
  }
});

// API: Get session by ID or 4-digit code
app.get("/api/photobooth/sessions/:idOrCode", (req: Request, res: Response) => {
  const query = req.params.idOrCode.trim().toUpperCase();
  
  // Look up by direct ID
  let session = memorySessions[query];

  // If not found, look up by code or case-insensitive search
  if (!session) {
    session = Object.values(memorySessions).find(
      (s: any) => s.id?.toUpperCase() === query || s.code?.toUpperCase() === query
    );
  }

  if (!session) {
    return res.status(404).json({
      success: false,
      message: `Không tìm thấy phiên chụp ảnh photobooth với mã "${req.params.idOrCode}". Vui lòng kiểm tra lại mã hoặc quét lại mã QR trên màn hình Photobooth.`
    });
  }

  // Check expiration
  const isExpired = new Date(session.expiresAt).getTime() < Date.now();

  res.json({
    success: true,
    session,
    isExpired
  });
});

// API: Create new session from Electron App or Cloud Webhook
app.post("/api/photobooth/sessions", (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      code,
      boothName,
      location,
      frameStyle,
      stripUrl,
      videoUrl,
      rawPhotoUrls = [],
      themeColor,
      expiryHours = 48,
      metadata = {}
    } = req.body;

    if (!stripUrl && rawPhotoUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cần ít nhất một ảnh photostrip hoặc danh sách ảnh chụp gốc."
      });
    }

    const generatedCode = code || Math.floor(1000 + Math.random() * 9000).toString();
    const finalId = sessionId || `PB-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const newSession = {
      id: finalId,
      code: generatedCode,
      boothName: boothName || "PHOTOBOOTH STUDIO",
      location: location || "Kiosk Photobooth",
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      frameStyle: frameStyle || "classic_white",
      themeColor: themeColor || "#ff758c",
      stripMedia: {
        id: `strip-${Date.now()}`,
        url: stripUrl || rawPhotoUrls[0],
        name: `Photostrip_${generatedCode}.jpg`,
        type: "image",
        width: 1200,
        height: 3600,
        aspectRatio: "1:3"
      },
      videoMedia: videoUrl ? {
        id: `video-${Date.now()}`,
        url: videoUrl,
        name: `LiveClip_${generatedCode}.mp4`,
        type: "video",
        width: 1080,
        height: 1920
      } : undefined,
      rawPhotos: rawPhotoUrls.map((url: string, index: number) => ({
        id: `raw-${Date.now()}-${index}`,
        url,
        name: `Shot_${index + 1}_${generatedCode}.jpg`,
        type: "image"
      })),
      metadata: {
        kioskId: metadata.kioskId || "ELECTRON-KIOSK",
        ...metadata
      }
    };

    memorySessions[finalId] = newSession;

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const viewUrl = `${protocol}://${host}?session=${finalId}`;

    res.status(201).json({
      success: true,
      message: "Phiên chụp photobooth đã được khởi tạo thành công!",
      session: newSession,
      viewUrl,
      qrPayload: viewUrl
    });
  } catch (error: any) {
    console.error("Error creating session:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: File Upload Endpoint for Electron direct file upload
app.post("/api/photobooth/upload", upload.single("mediaFile"), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Không tìm thấy tệp tải lên." });
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  res.json({
    success: true,
    filename: req.file.filename,
    fileUrl,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});

// Serve uploaded files statically
app.use("/uploads", express.static(uploadsDir));

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Photobooth Server listening on port ${PORT}`);
  });
}

startServer();
