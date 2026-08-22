import confetti from 'canvas-confetti';
import { PhotoboothSession } from '../types';

export function triggerConfetti() {
  try {
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.65 },
      colors: ['#ff758c', '#ff7eb3', '#6ee7b7', '#fcd34d', '#93c5fd', '#c084fc']
    });
  } catch (e) {
    console.error('Confetti error', e);
  }
}

/**
 * Downloads a single media file directly (.jpg, .mp4) to device storage
 */
export async function downloadMediaFile(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'photobooth_media';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
    triggerConfetti();
    return true;
  } catch (err) {
    console.warn('Direct blob download failed, falling back to direct link open:', err);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return false;
  }
}

/**
 * Save single photo/video straight to phone Album/Gallery via Web Share Files API
 * If on Mobile Safari/Chrome: invokes native "Save to Photos/Album" prompt
 * Fallback: direct raw file download (.jpg / .mp4)
 */
export async function saveToAlbumDirect(
  url: string, 
  filename: string, 
  mimeType: string = 'image/jpeg'
): Promise<'shared' | 'downloaded' | 'failed'> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    const file = new File([blob], filename, { type: mimeType });

    // Check if browser supports sharing files directly to native photo album
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'Lưu vào Album ảnh'
        });
        triggerConfetti();
        return 'shared';
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          // User closed share sheet without saving, still trigger fallback download
          return 'shared';
        }
      }
    }

    // Fallback: Direct file download
    await downloadMediaFile(url, filename);
    return 'downloaded';
  } catch (err) {
    console.warn('saveToAlbumDirect fallback triggered:', err);
    await downloadMediaFile(url, filename);
    return 'downloaded';
  }
}

/**
 * Save BOTH 1 photo and 1 video directly to Album/Gallery (NO ZIP!)
 * On mobile: sends both files to native share sheet -> prompts "Save 2 Items to Photos"
 * Fallback: sequentially downloads 1 .jpg file and 1 .mp4 file directly to device
 */
export async function saveBothDirectToAlbum(
  photoUrl: string,
  videoUrl?: string,
  sessionCode: string = 'HD'
): Promise<{ photoStatus: boolean; videoStatus: boolean; method: 'native-share' | 'direct-files' }> {
  try {
    const photoFilename = `Photobooth_Photo_${sessionCode}.jpg`;
    const videoFilename = `Photobooth_Video_${sessionCode}.mp4`;

    // Fetch photo blob
    const photoRes = await fetch(photoUrl, { mode: 'cors' });
    const photoBlob = await photoRes.blob();
    const photoFile = new File([photoBlob], photoFilename, { type: 'image/jpeg' });

    let videoFile: File | null = null;
    if (videoUrl) {
      try {
        const videoRes = await fetch(videoUrl, { mode: 'cors' });
        const videoBlob = await videoRes.blob();
        videoFile = new File([videoBlob], videoFilename, { type: 'video/mp4' });
      } catch (e) {
        console.warn('Could not fetch video file for combined share:', e);
      }
    }

    const filesToShare = videoFile ? [photoFile, videoFile] : [photoFile];

    // Attempt Native Share API to Album
    if (navigator.canShare && navigator.canShare({ files: filesToShare })) {
      try {
        await navigator.share({
          files: filesToShare,
          title: `Photobooth Media #${sessionCode}`,
          text: 'Lưu trọn bộ ảnh & video vào Album điện thoại'
        });
        triggerConfetti();
        return { photoStatus: true, videoStatus: !!videoFile, method: 'native-share' };
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          return { photoStatus: true, videoStatus: !!videoFile, method: 'native-share' };
        }
      }
    }

    // Direct sequential file downloads without ZIP!
    const p1 = downloadMediaFile(photoUrl, photoFilename);
    
    if (videoUrl) {
      setTimeout(() => {
        downloadMediaFile(videoUrl, videoFilename);
      }, 400);
    }

    await p1;
    triggerConfetti();
    return { photoStatus: true, videoStatus: !!videoUrl, method: 'direct-files' };
  } catch (err) {
    console.error('Error saving both to album:', err);
    // Direct fallbacks
    downloadMediaFile(photoUrl, `Photobooth_Photo_${sessionCode}.jpg`);
    if (videoUrl) {
      setTimeout(() => downloadMediaFile(videoUrl, `Photobooth_Video_${sessionCode}.mp4`), 400);
    }
    return { photoStatus: true, videoStatus: !!videoUrl, method: 'direct-files' };
  }
}
