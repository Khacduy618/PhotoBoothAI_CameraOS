import React, { useState, useEffect } from 'react';
import { SessionData, PrinterSettings } from '../../types';
import { QRCodeSVG } from '../UI/QRCodeSVG';
import { Printer, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { FramePreviewCard, isStripTemplate } from '../UI/frame-previews/FramePreviewCard';
import { GuestBottomNavigation } from '../UI/GuestBottomNavigation';

interface PrintQRScreenProps {
  session: SessionData;
  printerSettings: PrinterSettings;
  onConfirmPrint: () => void;
  onFinishSession: () => void;
}

export const PrintQRScreen: React.FC<PrintQRScreenProps> = ({
  session,
  printerSettings,
  onConfirmPrint,
  onFinishSession,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);

  const isPrintPending = session.printStatus === 'queued' || session.printStatus === 'sending' || session.printStatus === 'printing';
  const isPrintCompleted = session.printStatus === 'completed';
  const isPrintFailed = session.printStatus === 'failed';
  const canRequestPrint = Boolean(session.outputs?.print && session.selectedFrame && !isPrintPending && !isPrintCompleted);
  const qrReady = session.qr?.status === 'ready' && Boolean(session.qr.url);
  const product = session.product;

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

  const getPrintHeadline = () => {
    if (isPrintCompleted) return 'IN THÀNH CÔNG! VUI LÒNG NHẬN ẢNH';
    if (isPrintPending) return 'ĐANG IN... VUI LÒNG CHỜ TRONG GIÂY LÁT';
    if (isPrintFailed) return 'MÁY IN ĐANG CẦN HỖ TRỢ';
    return 'KẾT QUẢ VÀ MÃ QR TẢI ẢNH';
  };

  const getPrintStatusLabel = () => {
    switch (session.printStatus) {
      case 'sending':
        return 'Đang khởi tạo lệnh in...';
      case 'queued':
        return 'Đang in lượt 1/1';
      case 'printing':
        return 'Đang in lượt 1/1';
      case 'completed':
        return 'In hoàn tất! Vui lòng lấy ảnh ở khay máy in.';
      case 'failed':
        return 'Gặp sự cố khi in. Hãy thử bấm lại nút bên dưới.';
      case 'rendering':
        return 'Đang chuẩn bị bản in...';
      case 'idle':
      default:
        return 'Bấm nút "IN ẢNH NGAY" để bắt đầu in.';
    }
  };

  const formatVnd = (amount?: number) => amount ? `${amount.toLocaleString('vi-VN')} VNĐ` : '70.000 VNĐ';

  return (
    <div className="w-full h-screen flex flex-col justify-between px-4 py-4 sm:px-8 sm:py-6 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-[98%] mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1A1A]/5 border border-[#1A1A1A]/20 text-[#1A1A1A] font-mono text-xs font-bold uppercase tracking-widest mb-1">
          {product ? `${product.name} • ${formatVnd(product.price)}` : 'GÓI ẢNH PHOTOBOOTH'}
        </div>
        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-serif tracking-tight text-[#1A1A1A]">
          {getPrintHeadline()}
        </h2>
        <p className="text-xs sm:text-base opacity-75 mt-1 font-sans">
          Quét mã QR bên dưới để lưu ảnh số về điện thoại & xác nhận để in ảnh cầm tay.
        </p>
      </div>

      {/* Main Content Layout */}
      <div className="w-full max-w-[98%] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-2 items-center">
        {/* Left: QR Code & Print Status (4/12 = 33.3%) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* QR Code Card */}
          <div className="bg-[#F4F2EE] p-4 sm:p-5 border border-[#1A1A1A]/15 flex flex-col items-center text-center shadow-sm rounded-xl">
            {qrReady ? (
              <>
                <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]/15 mb-2.5 shadow-xs rounded-lg">
                  <QRCodeSVG value={session.qr!.url!} size={160} />
                </div>
                <h3 className="font-serif italic text-lg font-bold text-[#1A1A1A] mb-0.5">Quét mã QR để tải ảnh số</h3>
                <span className="text-[11px] font-mono opacity-75 font-medium">Lưu toàn bộ ảnh số về điện thoại ngay lập tức</span>
              </>
            ) : (
              <>
                <div className="w-[170px] h-[170px] bg-[#FDFCFB] border border-dashed border-[#1A1A1A]/25 mb-2.5 flex items-center justify-center rounded-lg">
                  <AlertCircle className="w-9 h-9 text-[#1A1A1A]/45" />
                </div>
                <h3 className="font-serif italic text-lg font-bold text-[#1A1A1A] mb-0.5">Mã QR đang chuẩn bị</h3>
                <span className="text-[11px] font-mono opacity-75 font-medium">Ảnh đã được lưu an toàn tại máy photobooth local.</span>
              </>
            )}
          </div>

          {/* Print Status Banner */}
          <div className="bg-[#F4F2EE] p-4 border border-[#1A1A1A]/15 flex flex-col gap-3 rounded-xl shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-lg ${
                  isPrintCompleted ? 'bg-emerald-600 text-white' : isPrintPending ? 'bg-[#f59e0b] text-white animate-pulse' : 'bg-[#1A1A1A] text-[#FDFCFB]'
                }`}>
                  {isPrintCompleted ? <CheckCircle2 className="w-5 h-5" /> : isPrintFailed ? <AlertCircle className="w-5 h-5 text-amber-300" /> : isPrintPending ? <Clock className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
                </div>
                <div>
                  <span className="block text-[9px] font-mono uppercase tracking-widest opacity-60">Trạng thái in</span>
                  <span className="font-serif italic text-sm font-bold text-[#1A1A1A]">{getPrintStatusLabel()}</span>
                </div>
              </div>
            </div>

            {/* CONFIRM PRINT BUTTON */}
            <button
              type="button"
              onClick={onConfirmPrint}
              disabled={!canRequestPrint}
              className={`w-full h-12 font-bold text-xs tracking-[0.18em] uppercase flex items-center justify-center gap-2.5 transition-all cursor-pointer rounded-lg shadow-md ${
                isPrintCompleted
                  ? 'bg-emerald-700 text-white opacity-90'
                  : isPrintPending
                  ? 'bg-[#f59e0b] text-white cursor-not-allowed opacity-90'
                  : 'bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#1A1A1A]/90 disabled:bg-[#1A1A1A]/20 disabled:text-[#1A1A1A]/40'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>
                {isPrintCompleted
                  ? '✓ ĐÃ HOÀN TẤT IN'
                  : isPrintPending
                  ? 'ĐANG XỬ LÝ IN...'
                  : session.printStatus === 'failed'
                  ? 'THỬ IN LẠI'
                  : `XÁC NHẬN IN ẢNH (${formatVnd(product?.price)})`}
              </span>
            </button>

            <p className="text-[10px] font-mono opacity-70">
              Sản phẩm: {product?.description || '1 × Bản in 10×15cm'}.
            </p>
          </div>

          {/* Timeout Banner */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#E8E6E1] border border-[#1A1A1A]/10 text-xs font-mono rounded-lg shadow-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1A1A1A]" />
              <span className="font-bold">TỰ ĐỘNG KẾT THÚC SAU:</span>
            </div>
            <span className="font-extrabold text-sm text-[#1A1A1A]">{formatTimer(secondsRemaining)}</span>
          </div>
        </div>

        {/* Right: Final Photo Preview (8/12 = 66.7% ~ 70%) */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center h-full p-2">
          {(() => {
            const isLandscape = session.selectedFrame?.orientation === 'landscape';
            const isStrip = session.selectedFrame
              ? isStripTemplate(session.selectedFrame)
              : false;

            const containerClass = isLandscape
              ? 'aspect-[3/2] h-[48vh] xl:h-[52vh] w-auto'
              : isStrip
              ? 'aspect-[1/3] h-[64vh] xl:h-[70vh] w-auto'
              : 'aspect-[2/3] h-[64vh] xl:h-[70vh] w-auto';

            return (
              <div className={`${containerClass} mx-auto relative border border-[#1A1A1A]/15 shadow-2xl overflow-hidden rounded-sm flex items-center justify-center bg-[#FDFCFB]`}>
                {session.outputs?.share ? (
                  <img
                    src={session.outputs.share}
                    alt="Final Print Composition"
                    className="w-full h-full object-contain object-center"
                  />
                ) : session.selectedFrame ? (
                  <FramePreviewCard
                    template={session.selectedFrame}
                    session={session}
                    drawDataUrl={session.drawDataUrl}
                  />
                ) : (
                  <div className="text-xs font-mono opacity-50">FINAL PHOTO PREVIEW</div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Shared Done Button */}
      <GuestBottomNavigation
        onNext={onFinishSession}
        nextLabel="HOÀN THÀNH PHIÊN CHỤP"
      />
    </div>
  );
};



