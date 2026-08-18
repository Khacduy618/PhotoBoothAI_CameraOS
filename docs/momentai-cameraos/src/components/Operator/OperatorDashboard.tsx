import React, { useState } from 'react';
import {
  CameraSettings,
  PrinterSettings,
  EventConfig,
  CaptureConfig,
  FrameTemplate,
  SessionData,
} from '../../types';
import { cameraService } from '../../services/cameraService';
import { printerService } from '../../services/printerService';
import {
  Settings,
  Camera,
  Printer,
  Layout,
  Sliders,
  History,
  Activity,
  X,
  Trash2,
} from 'lucide-react';

interface OperatorDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  eventConfig: EventConfig;
  onUpdateEventConfig: (updated: EventConfig) => void;
  cameraSettings: CameraSettings;
  onUpdateCameraSettings: (updated: Partial<CameraSettings>) => void;
  printerSettings: PrinterSettings;
  onUpdatePrinterSettings: (updated: Partial<PrinterSettings>) => void;
  captureConfig: CaptureConfig;
  onUpdateCaptureConfig: (updated: CaptureConfig) => void;
  frameTemplates: FrameTemplate[];
  onAddFrameTemplate: (newTemplate: FrameTemplate) => void;
  onDeleteFrameTemplate: (templateId: string) => void;
  sessionHistory: SessionData[];
  onReprintSession: (session: SessionData) => void;
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  isOpen,
  onClose,
  eventConfig,
  onUpdateEventConfig,
  cameraSettings,
  onUpdateCameraSettings,
  printerSettings,
  onUpdatePrinterSettings,
  captureConfig,
  onUpdateCaptureConfig,
  frameTemplates,
  onDeleteFrameTemplate,
  sessionHistory,
  onReprintSession,
}) => {
  const [activeTab, setActiveTab] = useState<
    'event' | 'camera' | 'capture' | 'frames' | 'printer' | 'history' | 'health'
  >('event');

  const [testStatus, setTestStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestCapture = async () => {
    setTestStatus('Đang kích hoạt shutter Canon 6D...');
    const dataUrl = await cameraService.capturePhoto(0);
    if (dataUrl) {
      setTestStatus('✓ Test capture thành công!');
    }
  };

  const handleTestPrint = async () => {
    setTestStatus('Đang gửi lệnh in thử nghiệm...');
    const success = await printerService.runTestPrint();
    if (success) {
      setTestStatus('✓ Test print thành công!');
    } else {
      setTestStatus('✕ Test print thất bại. Kiểm tra kết nối máy in.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1A1A]/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none overflow-hidden text-[#1A1A1A]">
      <div className="bg-[#FDFCFB] border border-[#1A1A1A] w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#F4F2EE] border-b border-[#1A1A1A]/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1A1A1A] text-[#FDFCFB] flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif italic text-xl text-[#1A1A1A]">Momentai CameraOS Operator</h2>
              <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">System Administration & Hardware Control</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-transparent hover:text-[#1A1A1A] border border-[#1A1A1A] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2 bg-[#F4F2EE]/50 border-b border-[#1A1A1A]/15 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'event', label: 'Sự kiện (Event)', icon: Sliders },
            { id: 'camera', label: 'Camera Canon 6D', icon: Camera },
            { id: 'capture', label: 'Cấu hình Chụp', icon: Sliders },
            { id: 'frames', label: 'Khung mẫu (Frames)', icon: Layout },
            { id: 'printer', label: 'Máy in (Printer)', icon: Printer },
            { id: 'history', label: 'Lịch sử Sessions', icon: History },
            { id: 'health', label: 'Nhật ký & Health', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]'
                    : 'bg-[#FDFCFB] hover:bg-[#E8E6E1] text-[#1A1A1A] border-[#1A1A1A]/15'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#FDFCFB]">
          {testStatus && (
            <div className="mb-4 p-3 bg-[#F4F2EE] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-mono flex items-center justify-between">
              <span>{testStatus}</span>
              <button onClick={() => setTestStatus(null)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          {/* TAB 1: EVENT SETUP */}
          {activeTab === 'event' && (
            <div className="space-y-6 max-w-3xl">
              <h3 className="font-serif italic text-2xl text-[#1A1A1A]">Cấu Hình Thông Tin Sự Kiện</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#1A1A1A] mb-1 uppercase tracking-widest">TÊN SỰ KIỆN</label>
                  <input
                    type="text"
                    value={eventConfig.eventName}
                    onChange={(e) => onUpdateEventConfig({ ...eventConfig, eventName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F2EE] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#1A1A1A] mb-1 uppercase tracking-widest">SLOGAN / TAGLINE</label>
                  <input
                    type="text"
                    value={eventConfig.customTagline}
                    onChange={(e) => onUpdateEventConfig({ ...eventConfig, customTagline: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F2EE] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#1A1A1A] mb-1 uppercase tracking-widest">ĐƠN VỊ TỔ CHỨC / HOST</label>
                  <input
                    type="text"
                    value={eventConfig.hostName}
                    onChange={(e) => onUpdateEventConfig({ ...eventConfig, hostName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F2EE] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#1A1A1A] mb-1 uppercase tracking-widest">NGÀY TỔ CHỨC</label>
                  <input
                    type="text"
                    value={eventConfig.eventDate}
                    onChange={(e) => onUpdateEventConfig({ ...eventConfig, eventDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F2EE] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CAMERA CANON 6D */}
          {activeTab === 'camera' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center justify-between">
                <h3 className="font-serif italic text-2xl text-[#1A1A1A]">Điều Khiển Camera Canon EOS 6D</h3>
                <button
                  onClick={handleTestCapture}
                  className="px-4 py-2 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#FDFCFB] hover:text-[#1A1A1A] border border-[#1A1A1A] font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>TEST CAPTURE</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15">
                  <span className="text-[9px] opacity-60 font-mono uppercase tracking-widest">MODEL CAMERA</span>
                  <p className="text-sm font-serif italic text-[#1A1A1A] mt-1">{cameraSettings.model}</p>
                </div>
                <div className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15">
                  <span className="text-[9px] opacity-60 font-mono uppercase tracking-widest">PIN / BATTERY</span>
                  <p className="text-sm font-bold text-[#1A1A1A] mt-1">{cameraSettings.batteryLevel}%</p>
                </div>
                <div className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15">
                  <span className="text-[9px] opacity-60 font-mono uppercase tracking-widest">SHUTTER COUNT</span>
                  <p className="text-sm font-bold text-[#1A1A1A] mt-1">{cameraSettings.shutterCount} shots</p>
                </div>
                <div className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15">
                  <span className="text-[9px] opacity-60 font-mono uppercase tracking-widest">NHIỆT ĐỘ</span>
                  <p className="text-sm font-bold text-[#1A1A1A] mt-1">{cameraSettings.temperature}°C</p>
                </div>
              </div>

              {/* Exposure Controls */}
              <div className="p-5 bg-[#F4F2EE] border border-[#1A1A1A]/15 space-y-4">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">THÔNG SỐ PHÂN GIẢI & EXPOSURE</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono opacity-70 mb-1 uppercase">ISO</label>
                    <select
                      value={cameraSettings.iso}
                      onChange={(e) => onUpdateCameraSettings({ iso: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A]"
                    >
                      {[100, 200, 400, 800, 1600, 3200, 6400].map((v) => (
                        <option key={v} value={v}>ISO {v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono opacity-70 mb-1 uppercase">SHUTTER SPEED</label>
                    <select
                      value={cameraSettings.shutterSpeed}
                      onChange={(e) => onUpdateCameraSettings({ shutterSpeed: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A]"
                    >
                      {['1/60', '1/125', '1/200', '1/250', '1/500'].map((v) => (
                        <option key={v} value={v}>{v}s</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono opacity-70 mb-1 uppercase">APERTURE (KHẨU ĐỘ)</label>
                    <select
                      value={cameraSettings.aperture}
                      onChange={(e) => onUpdateCameraSettings({ aperture: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A]"
                    >
                      {['f/2.8', 'f/4.0', 'f/5.6', 'f/8.0', 'f/11'].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="pt-3 border-t border-[#1A1A1A]/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono opacity-70 uppercase tracking-widest">INPUT SOURCE:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await cameraService.startWebcam();
                        onUpdateCameraSettings({ mode: 'webcam' });
                      }}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                        cameraSettings.mode === 'webcam' ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]' : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20'
                      }`}
                    >
                      Real Webcam (USB)
                    </button>
                    <button
                      onClick={() => {
                        cameraService.stopWebcam();
                        onUpdateCameraSettings({ mode: 'simulator' });
                      }}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                        cameraSettings.mode === 'simulator' ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]' : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20'
                      }`}
                    >
                      Canon EDSDK Simulator
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CAPTURE SETTINGS */}
          {activeTab === 'capture' && (
            <div className="space-y-6 max-w-3xl">
              <h3 className="font-serif italic text-2xl text-[#1A1A1A]">Cấu Hình Quy Trình Chụp</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#1A1A1A] mb-1 uppercase tracking-widest">ĐẾM NGƯỢC COUNTDOWN (GIÂY)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={captureConfig.countdownSeconds}
                    onChange={(e) => onUpdateCaptureConfig({ ...captureConfig, countdownSeconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F4F2EE] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#1A1A1A] mb-1 uppercase tracking-widest">KHOẢNG CÁCH GIỮA CÁC SHOT (GIÂY)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={captureConfig.intervalSeconds}
                    onChange={(e) => onUpdateCaptureConfig({ ...captureConfig, intervalSeconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F4F2EE] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FRAME MANAGER */}
          {activeTab === 'frames' && (
            <div className="space-y-6">
              <h3 className="font-serif italic text-2xl text-[#1A1A1A]">Quản Lý Khung Mẫu</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {frameTemplates.map((template) => (
                  <div key={template.id} className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15 flex flex-col justify-between">
                    <div>
                      <div className="aspect-[4/3] overflow-hidden bg-[#E8E6E1] border border-[#1A1A1A]/10 mb-3">
                        <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                      </div>
                      <h4 className="font-serif italic text-lg text-[#1A1A1A]">{template.name}</h4>
                      <p className="text-[10px] font-mono opacity-60 uppercase mt-0.5">{template.layout.type} • {template.layout.slotCount} slots</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1A1A1A]/10 flex items-center justify-between text-[10px] font-mono opacity-60 uppercase">
                      <span>Giấy: {template.preferredPaper}</span>
                      <button
                        onClick={() => onDeleteFrameTemplate(template.id)}
                        className="text-[#1A1A1A] hover:text-rose-700 p-1 cursor-pointer"
                        title="Xóa template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: PRINTER & PAPER */}
          {activeTab === 'printer' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center justify-between">
                <h3 className="font-serif italic text-2xl text-[#1A1A1A]">Quản Lý Máy In Ảnh</h3>
                <button
                  onClick={handleTestPrint}
                  className="px-4 py-2 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#FDFCFB] hover:text-[#1A1A1A] border border-[#1A1A1A] font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>TEST PRINT PATTERN</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15">
                  <span className="text-[9px] opacity-60 font-mono uppercase tracking-widest">MODEL MÁY IN</span>
                  <p className="text-sm font-serif italic text-[#1A1A1A] mt-1">{printerSettings.model}</p>
                </div>
                <div className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15">
                  <span className="text-[9px] opacity-60 font-mono uppercase tracking-widest">GIẤY CÒN LẠI</span>
                  <p className="text-sm font-bold text-[#1A1A1A] mt-1">{printerSettings.paperRemaining} / {printerSettings.paperTotal} prints</p>
                </div>
                <div className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15">
                  <span className="text-[9px] opacity-60 font-mono uppercase tracking-widest">KHỔ GIẤY</span>
                  <p className="text-sm font-bold text-[#1A1A1A] mt-1">{printerSettings.currentPaper}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SESSION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <h3 className="font-serif italic text-2xl text-[#1A1A1A]">Lịch Sử Phiên Chụp</h3>

              <div className="space-y-3">
                {sessionHistory.length === 0 ? (
                  <p className="text-xs font-mono opacity-60 uppercase">Chưa có phiên chụp nào được thực hiện.</p>
                ) : (
                  sessionHistory.map((s) => (
                    <div key={s.sessionId} className="p-4 bg-[#F4F2EE] border border-[#1A1A1A]/15 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#E8E6E1] border border-[#1A1A1A]/10 overflow-hidden flex items-center justify-center">
                          {s.photos[0] ? (
                            <img src={s.photos[0].dataUrl} alt="Session" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-5 h-5 text-[#1A1A1A]/40" />
                          )}
                        </div>
                        <div>
                          <p className="font-mono text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">{s.sessionId}</p>
                          <p className="text-[10px] font-mono opacity-60 uppercase mt-0.5">{s.createdAt} • {s.photos.length} photos • {s.selectedFrame?.name || 'Chưa chọn frame'}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => onReprintSession(s)}
                        className="px-3 py-1.5 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-transparent hover:text-[#1A1A1A] border border-[#1A1A1A] text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors"
                      >
                        Reprint
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: DEVICE HEALTH LOGS */}
          {activeTab === 'health' && (
            <div className="space-y-6 max-w-4xl">
              <h3 className="font-serif italic text-2xl text-[#1A1A1A]">Nhật Ký System Log</h3>
              <div className="p-4 bg-[#1A1A1A] font-mono text-[11px] text-[#FDFCFB]/80 h-64 overflow-y-auto border border-[#1A1A1A] space-y-1.5">
                <p>[{new Date().toLocaleTimeString()}] MOMENTAI CAMERAOS Core Engine Bootstrapped.</p>
                <p>[{new Date().toLocaleTimeString()}] EDSDK Canon EOS 6D Driver Connected via USB Bus 001.</p>
                <p>[{new Date().toLocaleTimeString()}] DNP DS620 Photo Printer Spooler Ready.</p>
                <p>[{new Date().toLocaleTimeString()}] Storage Space: 412.8 GB free on host system.</p>
                <p>[{new Date().toLocaleTimeString()}] Live View Frame Buffer running at 60 FPS.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

