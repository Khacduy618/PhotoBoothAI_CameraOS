/// <reference types="vite/client" />

/**
 * Firebase Web Client Configuration for Mobile Landing Page
 * Reads public environment variables with VITE_ prefix.
 * NEVER contains private service account keys or admin tokens.
 */

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseConfig: FirebaseClientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.projectId);
}

/**
 * Fetch a session directly via Firestore REST API (works in browser without heavy SDK overhead or with SDK)
 */
export async function fetchSessionViaRest(projectId: string, publicToken: string, apiKey?: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sessions/${publicToken}${apiKey ? `?key=${apiKey}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Firestore HTTP ${res.status}`);
  }
  const json = await res.json();
  return parseFirestoreDocument(json);
}

export function parseFirestoreDocument(doc: any) {
  if (!doc || !doc.fields) return null;
  const f = doc.fields;

  const getStr = (field: any) => field?.stringValue || '';
  const getNum = (field: any) => (field?.integerValue ? Number(field.integerValue) : field?.doubleValue ? Number(field.doubleValue) : undefined);

  const rawPhotos: Array<{ shotIndex: number; url: string; name: string }> = [];
  if (f.rawPhotos?.arrayValue?.values) {
    for (const item of f.rawPhotos.arrayValue.values) {
      if (item.mapValue?.fields) {
        const itemF = item.mapValue.fields;
        rawPhotos.push({
          shotIndex: getNum(itemF.shotIndex) || 1,
          url: getStr(itemF.url),
          name: getStr(itemF.name),
        });
      }
    }
  }

  const finalImage = f.finalImage?.mapValue?.fields ? {
    url: getStr(f.finalImage.mapValue.fields.url),
    name: getStr(f.finalImage.mapValue.fields.name) || 'final-image.jpg',
    width: getNum(f.finalImage.mapValue.fields.width) || 1800,
    height: getNum(f.finalImage.mapValue.fields.height) || 2700,
  } : undefined;

  const finalVideo = f.finalVideo?.mapValue?.fields ? {
    url: getStr(f.finalVideo.mapValue.fields.url),
    name: getStr(f.finalVideo.mapValue.fields.name) || 'final-video.mp4',
    duration: getNum(f.finalVideo.mapValue.fields.duration) || 4.0,
    width: getNum(f.finalVideo.mapValue.fields.width) || 1800,
    height: getNum(f.finalVideo.mapValue.fields.height) || 2700,
  } : undefined;

  return {
    publicToken: getStr(f.publicToken),
    status: getStr(f.status) || 'CREATED',
    productType: getStr(f.productType) || 'classic_4_shot',
    requiredShots: getNum(f.requiredShots) || 4,
    boothName: getStr(f.boothName) || 'TIỆM ẢNH DI SẢN • MOMENTAI',
    createdAt: getStr(f.createdAt) || new Date().toISOString(),
    updatedAt: getStr(f.updatedAt) || new Date().toISOString(),
    finalImage,
    finalVideo,
    rawPhotos,
  };
}
