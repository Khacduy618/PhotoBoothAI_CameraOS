import { PhotoboothSession } from '../types';

export const SAMPLE_SESSIONS: PhotoboothSession[] = [
  {
    id: 'PB-KOREA-8821',
    code: '8821',
    boothName: 'K-STUDIO 4-CUTS',
    location: 'Chi nhánh Sài Gòn Centre, Quận 1',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 47.5).toISOString(), // ~48 hours expiry
    frameStyle: 'pastel_pink',
    themeColor: '#ff758c',
    stripMedia: {
      id: 'strip-1',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=80',
      name: 'Photostrip_KStudio_8821.jpg',
      type: 'image',
      width: 1200,
      height: 3600,
      aspectRatio: '1:3'
    },
    videoMedia: {
      id: 'video-1',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      name: 'LiveBoomerang_8821.mp4',
      type: 'video',
      width: 1080,
      height: 1920,
      sizeBytes: 4200000
    },
    rawPhotos: [
      {
        id: 'raw-1',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
        name: 'Shot_01_KStudio_8821.jpg',
        type: 'image',
        width: 2400,
        height: 1600
      },
      {
        id: 'raw-2',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
        name: 'Shot_02_KStudio_8821.jpg',
        type: 'image',
        width: 2400,
        height: 1600
      },
      {
        id: 'raw-3',
        url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
        name: 'Shot_03_KStudio_8821.jpg',
        type: 'image',
        width: 2400,
        height: 1600
      },
      {
        id: 'raw-4',
        url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80',
        name: 'Shot_04_KStudio_8821.jpg',
        type: 'image',
        width: 2400,
        height: 1600
      }
    ],
    metadata: {
      photographer: 'Auto Kiosk #04',
      filterApplied: 'Seoul Glow & Soft Peach',
      totalTakes: 8,
      printCopies: 2,
      kioskId: 'KIOSK-VN-HCM-04'
    }
  },
  {
    id: 'PB-WEDDING-9902',
    code: '9902',
    boothName: '💍 MINH & THẢO WEDDING PHOTOBOOTH',
    location: 'Trung tâm Tiệc cưới GEM Center, TP.HCM',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 70).toISOString(),
    frameStyle: 'classic_white',
    themeColor: '#d4af37',
    stripMedia: {
      id: 'strip-2',
      url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1080&q=80',
      name: 'Wedding_Strip_MinhThao_9902.jpg',
      type: 'image',
      width: 1200,
      height: 3600,
      aspectRatio: '1:3'
    },
    videoMedia: {
      id: 'video-2',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80',
      name: 'Wedding_BehindTheScenes_9902.mp4',
      type: 'video',
      width: 1080,
      height: 1920,
      sizeBytes: 5800000
    },
    rawPhotos: [
      {
        id: 'raw-w1',
        url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
        name: 'Wedding_Shot_01.jpg',
        type: 'image'
      },
      {
        id: 'raw-w2',
        url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
        name: 'Wedding_Shot_02.jpg',
        type: 'image'
      },
      {
        id: 'raw-w3',
        url: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
        name: 'Wedding_Shot_03.jpg',
        type: 'image'
      },
      {
        id: 'raw-w4',
        url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
        name: 'Wedding_Shot_04.jpg',
        type: 'image'
      }
    ],
    metadata: {
      photographer: 'Wedding Photobooth Kiosk #1',
      filterApplied: 'Golden Champagne Radiance',
      totalTakes: 6,
      printCopies: 4,
      kioskId: 'WEDDING-GEM-01'
    }
  },
  {
    id: 'PB-NEON-5541',
    code: '5541',
    boothName: '⚡ CYBER NEON PARTY BOOTH',
    location: '1900 Le Théâtre, Hà Nội',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    frameStyle: 'cyber_neon',
    themeColor: '#00f2fe',
    stripMedia: {
      id: 'strip-3',
      url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1080&q=80',
      name: 'Cyber_Neon_Strip_5541.jpg',
      type: 'image',
      width: 1200,
      height: 3600,
      aspectRatio: '1:3'
    },
    videoMedia: {
      id: 'video-3',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=800&q=80',
      name: 'Cyber_Glitch_Video_5541.mp4',
      type: 'video',
      width: 1080,
      height: 1920,
      sizeBytes: 6100000
    },
    rawPhotos: [
      {
        id: 'raw-n1',
        url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
        name: 'Neon_Shot_01.jpg',
        type: 'image'
      },
      {
        id: 'raw-n2',
        url: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80',
        name: 'Neon_Shot_02.jpg',
        type: 'image'
      },
      {
        id: 'raw-n3',
        url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        name: 'Neon_Shot_03.jpg',
        type: 'image'
      },
      {
        id: 'raw-n4',
        url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
        name: 'Neon_Shot_04.jpg',
        type: 'image'
      }
    ],
    metadata: {
      photographer: 'Neon Night Club Booth',
      filterApplied: 'Tokyo Cyberpunk Glow',
      totalTakes: 10,
      printCopies: 2,
      kioskId: 'CLUB-1900-02'
    }
  }
];
