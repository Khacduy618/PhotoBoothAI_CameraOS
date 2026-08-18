import React, { useState, useEffect } from 'react';
import { SessionData, PrinterSettings } from '../../types';
import { Printer, Clock, Check, AlertCircle } from 'lucide-react';

interface PrintQRScreenProps {
  session: SessionData;
  printerSettings: PrinterSettings;
  onFinishSession: () => void;
}

export const PrintQRScreen: React.FC<PrintQRScreenProps> = ({
  session,
  printerSettings,
  onFinishSession,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);
  const printStatus = 'Sẵn sàng in khi guest xác nhận trong app production';

  // 120 Seconds Auto Reset Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onFinishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onFinishSession]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? `0${m}` : m}:${s < 10 ? `0${s}` : s}`;
  };

  return (
    <div className="w-full h-[calc(100vh-68px)] flex flex-col justify-between p-6 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center">
        <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">
          ẢNH CỦA BẠN
        </h2>
        <p className="text-xs sm:text-sm opacity-70 mt-1 font-sans">
          Quét mã QR để lưu ảnh số về điện thoại & nhận bản in tại photobooth.
        </p>
      </div>

      {/* Main Content Layout */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 my-auto py-4 items-center">
        {/* Left: QR Code & Print Status */}
        <div className="md:col-span-6 flex flex-col gap-6">
          {/* QR Code Card */}
          <div className="bg-[#F4F2EE] p-6 border border-[#1A1A1A]/15 flex flex-col items-center text-center shadow-xs rounded-xs">
            <div className="w-[194px] h-[194px] bg-[#FDFCFB] border border-dashed border-[#1A1A1A]/25 mb-4 flex items-center justify-center rounded-2xs">
              <AlertCircle className="w-10 h-10 text-[#1A1A1A]/45" />
            </div>
            <h3 className="font-serif italic text-xl font-bold text-[#1A1A1A] mb-1">QR chưa khả dụng</h3>
            <span className="text-[10px] font-mono opacity-70 font-medium">Demo docs không tạo cloud QR hoặc tự động gửi lệnh in. Production dùng LocalShareService.</span>
          </div>

          {/* Print Status Banner */}
          <div className="bg-[#F4F2EE] p-5 border border-[#1A1A1A]/15 flex items-center justify-between rounded-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1A1A1A] text-[#FDFCFB] flex items-center justify-center flex-shrink-0 rounded-2xs">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] font-mono uppercase tracking-widest opacity-60">Trạng thái máy in</span>
                <span className="font-serif italic text-base font-bold text-[#1A1A1A]">{printStatus} ({printerSettings.currentPaper})</span>
              </div>
            </div>
          </div>

          {/* Timeout Banner */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#E8E6E1] border border-[#1A1A1A]/10 text-xs font-mono rounded-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1A1A1A]" />
              <span>TỰ ĐỘNG RESET SAU:</span>
            </div>
            <span className="font-bold text-base text-[#1A1A1A]">{formatTimer(secondsRemaining)}</span>
          </div>
        </div>

        {/* Right: Final Photo Preview (1:1 with print) */}
        <div className="md:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-xs aspect-[2/3] bg-[#F4F2EE] border border-[#1A1A1A]/20 p-3 shadow-xl overflow-hidden flex items-center justify-center rounded-xs">
            {session.outputs?.share ? (
              <img
                src={session.outputs.share}
                alt="Final Print Composition"
                className="w-full h-full object-contain shadow-xs"
              />
            ) : (
              <div className="text-[10px] font-mono opacity-50">FINAL PHOTO PREVIEW</div>
            )}
          </div>
        </div>
      </div>

      {/* Done Button */}
      <div className="w-full max-w-6xl mx-auto border-t border-[#1A1A1A]/10 pt-4 flex justify-center">
        <button
          onClick={onFinishSession}
          className="w-full sm:w-[320px] h-[52px] bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] font-bold text-xs tracking-[0.25em] uppercase border border-[#1A1A1A] flex items-center justify-center gap-3 transition-colors shadow-md cursor-pointer"
        >
          <span>HOÀN THÀNH</span>
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};


