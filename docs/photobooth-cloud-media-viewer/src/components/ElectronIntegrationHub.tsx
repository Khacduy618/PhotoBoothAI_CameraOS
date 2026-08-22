import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Terminal, Copy, Check, ExternalLink, Sparkles, Upload, ArrowRight, Laptop, Smartphone, Cloud, Code } from 'lucide-react';
import { PhotoboothSession } from '../types';

interface ElectronIntegrationHubProps {
  currentSession: PhotoboothSession | null;
  onSelectSession: (session: PhotoboothSession) => void;
  lang: 'vi' | 'en';
}

export const ElectronIntegrationHub: React.FC<ElectronIntegrationHubProps> = ({
  currentSession,
  onSelectSession,
  lang
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'flow' | 'kiosk_simulator' | 'api_docs'>('flow');

  // Custom Simulator state
  const [simBoothName, setSimBoothName] = useState('HARU FILM PHOTOBOOTH');
  const [simLocation, setSimLocation] = useState('Vincom Mega Mall, Hà Nội');
  const [simStripUrl, setSimStripUrl] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=80'
  );
  const [simVideoUrl, setSimVideoUrl] = useState(
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  );
  const [simPhotos, setSimPhotos] = useState([
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80'
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdSessionUrl, setCreatedSessionUrl] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSimulateElectronUpload = async () => {
    setIsCreating(true);
    try {
      const payload = {
        boothName: simBoothName,
        location: simLocation,
        stripUrl: simStripUrl,
        videoUrl: simVideoUrl,
        rawPhotoUrls: simPhotos,
        expiryHours: 48,
        metadata: {
          kioskId: 'ELECTRON-KIOSK-SIMULATOR-01',
          kioskAppVersion: '2.4.0'
        }
      };

      const res = await fetch('/api/photobooth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.session) {
        setCreatedSessionUrl(data.viewUrl || `${window.location.origin}?session=${data.session.id}`);
        setCreatedCode(data.session.code);
        onSelectSession(data.session);
      }
    } catch (e) {
      console.error('Error creating simulator session:', e);
    } finally {
      setIsCreating(false);
    }
  };

  const electronSampleCode = `// Trong ứng dụng Electron Photobooth (main.js / renderer.js)
const axios = require('axios');
const qrcode = require('qrcode');

async function handlePhotoboothFinished(sessionMedia) {
  const SERVER_URL = '${window.location.origin}'; // Địa chỉ Cloud Web này

  // 1. Gửi dữ liệu ảnh & video lên Cloud sau khi chụp xong
  const payload = {
    boothName: "K-STUDIO PHOTOBOOTH #01",
    location: "Sài Gòn Centre, Quận 1",
    stripUrl: sessionMedia.stripCloudUrl, // URL ảnh photostrip (đã upload S3/Cloudinary/Server)
    videoUrl: sessionMedia.boomerangVideoUrl, // URL video boomerang MP4
    rawPhotoUrls: [
      sessionMedia.shot1Url,
      sessionMedia.shot2Url,
      sessionMedia.shot3Url,
      sessionMedia.shot4Url
    ],
    expiryHours: 48 // Thời hạn lưu trữ Cloud (tự động xóa sau 48 tiếng)
  };

  try {
    const response = await axios.post(\`\${SERVER_URL}/api/photobooth/sessions\`, payload);
    const { viewUrl, session } = response.data;

    // 2. Tạo mã QR trực tiếp trên màn hình Kiosk Electron
    const qrDataUrl = await qrcode.toDataURL(viewUrl, { width: 320, margin: 2 });
    
    // 3. Hiển thị QR Code lên màn hình Photobooth cho khách quét
    document.getElementById('kiosk-qr-image').src = qrDataUrl;
    document.getElementById('kiosk-session-code').innerText = session.code;
    
    console.log('QR Code generated successfully:', viewUrl);
  } catch (error) {
    console.error('Upload to Cloud failed:', error);
  }
}`;

  const curlSampleCode = `curl -X POST "${window.location.origin}/api/photobooth/sessions" \\
  -H "Content-Type: application/json" \\
  -d '{
    "boothName": "K-STUDIO 4-CUTS",
    "location": "Sài Gòn Centre",
    "stripUrl": "https://example.com/photostrip.jpg",
    "videoUrl": "https://example.com/video.mp4",
    "rawPhotoUrls": [
      "https://example.com/shot1.jpg",
      "https://example.com/shot2.jpg",
      "https://example.com/shot3.jpg",
      "https://example.com/shot4.jpg"
    ],
    "expiryHours": 48
  }'`;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white border border-[#1A1A1A]/15 shadow-sm p-6 sm:p-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1A1A1A]/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#1A1A1A] text-white flex items-center justify-center">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[#1A1A1A] uppercase tracking-tight">
              {lang === 'vi' ? 'Kết nối App Photobooth Electron với Web' : 'Electron App & Kiosk Integration'}
            </h2>
            <p className="font-sans text-[11px] uppercase tracking-widest text-[#1A1A1A]/60 mt-1">
              {lang === 'vi'
                ? 'Quy trình đẩy media từ máy Kiosk chụp ảnh lên Cloud và tạo mã QR cho khách tải về'
                : 'Upload workflow from Kiosk to Cloud and generating QR codes for mobile users'
              }
            </p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center bg-[#E5E2DD] p-1 border border-[#1A1A1A]/10 font-sans text-[10px] uppercase tracking-wider font-bold text-[#1A1A1A]">
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'flow' ? 'bg-[#1A1A1A] text-white' : 'hover:text-[#1A1A1A]'
            }`}
          >
            {lang === 'vi' ? 'Quy trình' : 'Workflow'}
          </button>
          <button
            onClick={() => setActiveTab('kiosk_simulator')}
            className={`px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'kiosk_simulator' ? 'bg-[#1A1A1A] text-white' : 'hover:text-[#1A1A1A]'
            }`}
          >
            {lang === 'vi' ? 'Mô phỏng' : 'Simulator'}
          </button>
          <button
            onClick={() => setActiveTab('api_docs')}
            className={`px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'api_docs' ? 'bg-[#1A1A1A] text-white' : 'hover:text-[#1A1A1A]'
            }`}
          >
            {lang === 'vi' ? 'API Code' : 'API Specs'}
          </button>
        </div>
      </div>

      {/* Tab 1: Flow Architecture Visualizer */}
      {activeTab === 'flow' && (
        <div className="py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Step 1 */}
            <div className="p-5 bg-[#F9F8F6] border border-[#1A1A1A]/15 relative">
              <div className="w-8 h-8 bg-[#1A1A1A] text-white flex items-center justify-center mb-3">
                <Laptop className="w-4 h-4" />
              </div>
              <div className="font-sans text-[9px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-1">Bước 01</div>
              <h4 className="font-serif-display text-sm font-bold text-[#1A1A1A] mb-1.5">App Electron tại Kiosk</h4>
              <p className="font-sans text-xs text-[#1A1A1A]/70 leading-relaxed">
                Máy photobooth chụp ảnh 4-cut và quay clip boomerang. Sau khi render photostrip, ứng dụng Electron gửi tệp hoặc URL lên endpoint <code>/api/photobooth/sessions</code>.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-5 bg-[#E5E2DD]/50 border border-[#1A1A1A]/20 relative">
              <div className="w-8 h-8 bg-[#1A1A1A] text-white flex items-center justify-center mb-3">
                <Cloud className="w-4 h-4" />
              </div>
              <div className="font-sans text-[9px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-1">Bước 02</div>
              <h4 className="font-serif-display text-sm font-bold text-[#1A1A1A] mb-1.5">Cloud Storage & Mã QR</h4>
              <p className="font-sans text-xs text-[#1A1A1A]/70 leading-relaxed">
                Server lưu trữ thông tin phiên, cấp mã 4 số và link tải <code>?session=PB-xxxx</code>. App Electron render mã QR trực tiếp trên màn hình kết thúc.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 bg-[#F9F8F6] border border-[#1A1A1A]/15 relative">
              <div className="w-8 h-8 bg-[#1A1A1A] text-white flex items-center justify-center mb-3">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="font-sans text-[9px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-1">Bước 03</div>
              <h4 className="font-serif-display text-sm font-bold text-[#1A1A1A] mb-1.5">Khách quét mã trên Mobile</h4>
              <p className="font-sans text-xs text-[#1A1A1A]/70 leading-relaxed">
                Khách dùng camera iPhone / Android quét mã QR, trang web tự mở lên ngay lập tức cho phép xem toàn bộ ảnh strip HD, video boomerang và tải về 1-chạm hoặc ZIP!
              </p>
            </div>
          </div>

          {/* Quick Action to try simulator */}
          <div className="p-5 bg-[#1A1A1A] text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-serif-display text-base font-bold uppercase tracking-tight">Thử nghiệm gửi phiên chụp từ Kiosk ngay bây giờ</h4>
              <p className="font-sans text-[11px] uppercase tracking-wider text-stone-300 mt-1">
                Xem trực tiếp mã QR được tạo ra và quét bằng điện thoại của bạn!
              </p>
            </div>
            <button
              onClick={() => setActiveTab('kiosk_simulator')}
              className="px-5 py-2.5 bg-white text-[#1A1A1A] hover:bg-stone-100 font-sans text-xs font-bold uppercase tracking-widest shrink-0 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Mở Kiosk Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Live Kiosk Simulator */}
      {activeTab === 'kiosk_simulator' && (
        <div className="py-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form configuration */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-serif-display text-base font-bold text-[#1A1A1A] uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1A1A1A]" />
                Mô phỏng máy Kiosk Photobooth gửi dữ liệu
              </h3>

              <div>
                <label className="block font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-1">Tên thương hiệu Photobooth:</label>
                <input
                  type="text"
                  value={simBoothName}
                  onChange={(e) => setSimBoothName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#1A1A1A]/20 focus:outline-[#1A1A1A] bg-[#F9F8F6]"
                />
              </div>

              <div>
                <label className="block font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-1">Địa điểm Kiosk:</label>
                <input
                  type="text"
                  value={simLocation}
                  onChange={(e) => setSimLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#1A1A1A]/20 focus:outline-[#1A1A1A] bg-[#F9F8F6]"
                />
              </div>

              <div>
                <label className="block font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-1">URL Ảnh Photostrip hoàn chỉnh:</label>
                <input
                  type="text"
                  value={simStripUrl}
                  onChange={(e) => setSimStripUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#1A1A1A]/20 focus:outline-[#1A1A1A] bg-[#F9F8F6] font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-1">URL Video Boomerang (MP4):</label>
                <input
                  type="text"
                  value={simVideoUrl}
                  onChange={(e) => setSimVideoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#1A1A1A]/20 focus:outline-[#1A1A1A] bg-[#F9F8F6] font-mono text-[11px]"
                />
              </div>

              <button
                id="btn-simulate-upload"
                onClick={handleSimulateElectronUpload}
                disabled={isCreating}
                className="w-full py-3.5 px-4 font-sans font-bold text-xs uppercase tracking-widest bg-[#1A1A1A] hover:bg-black text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-rose-300" />
                <span>{isCreating ? 'Đang gửi từ Electron...' : 'Gửi dữ liệu & Tạo mã QR Kiosk'}</span>
              </button>
            </div>

            {/* Simulated Kiosk Screen Output with QR */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-[#1A1A1A] text-white border border-stone-800 text-center">
              <div className="font-mono text-[9px] text-[#E5E2DD] tracking-widest uppercase mb-1">
                MÀN HÌNH KIOSK PHOTOBOOTH
              </div>
              <h4 className="font-serif-display text-sm font-bold uppercase tracking-wider mb-4">{simBoothName}</h4>

              {/* QR Code */}
              <div className="p-3 bg-white border border-white/20 mb-3">
                <QRCodeSVG
                  value={createdSessionUrl || `${window.location.origin}?session=${currentSession?.id || 'PB-KOREA-8821'}`}
                  size={160}
                  level="M"
                />
              </div>

              <p className="font-sans text-xs text-stone-300 font-medium">
                {lang === 'vi' ? 'Quét mã để nhận ảnh & video về điện thoại' : 'Scan QR with phone to download media'}
              </p>
              <div className="mt-2 font-mono text-xs text-[#F9F8F6] bg-white/10 px-3 py-1 border border-white/15">
                Mã: #{createdCode || currentSession?.code || '8821'}
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 w-full flex items-center justify-center gap-2">
                <a
                  href={createdSessionUrl || `${window.location.origin}?session=${currentSession?.id || 'PB-KOREA-8821'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-sans text-[11px] uppercase tracking-wider text-rose-300 hover:text-white flex items-center gap-1 font-bold"
                >
                  <span>Mở thử trang tải</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: API Docs and Code Snippets */}
      {activeTab === 'api_docs' && (
        <div className="py-6 space-y-6">
          
          {/* Endpoint box */}
          <div className="p-4 bg-[#1A1A1A] text-white font-mono text-xs border border-stone-800">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
              <span className="px-2 py-0.5 bg-emerald-500/20">POST</span>
              <span>/api/photobooth/sessions</span>
            </div>
            <p className="text-stone-300 text-[11px] font-sans">
              Endpoint nhận thông tin phiên chụp từ Electron Kiosk và trả về URL xem media + QR code payload.
            </p>
          </div>

          {/* Code snippet: Electron JS */}
          <div className="relative">
            <div className="flex items-center justify-between pb-2">
              <span className="font-sans text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-4 h-4 text-[#1A1A1A]" />
                Code mẫu trong ứng dụng Electron (Node.js)
              </span>
              <button
                onClick={() => copyToClipboard(electronSampleCode, 'electron')}
                className="flex items-center gap-1 font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A] font-bold hover:underline cursor-pointer"
              >
                {copiedCode === 'electron' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode === 'electron' ? 'Đã sao chép' : 'Sao chép code'}</span>
              </button>
            </div>
            <pre className="p-4 bg-[#1A1A1A] text-stone-200 text-[11px] font-mono overflow-x-auto leading-relaxed border border-stone-800">
              <code>{electronSampleCode}</code>
            </pre>
          </div>

          {/* Code snippet: cURL */}
          <div className="relative">
            <div className="flex items-center justify-between pb-2">
              <span className="font-sans text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-[#1A1A1A]" />
                Lệnh test nhanh cURL
              </span>
              <button
                onClick={() => copyToClipboard(curlSampleCode, 'curl')}
                className="flex items-center gap-1 font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A] font-bold hover:underline cursor-pointer"
              >
                {copiedCode === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode === 'curl' ? 'Đã sao chép' : 'Sao chép cURL'}</span>
              </button>
            </div>
            <pre className="p-4 bg-[#1A1A1A] text-stone-200 text-[11px] font-mono overflow-x-auto leading-relaxed border border-stone-800">
              <code>{curlSampleCode}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
