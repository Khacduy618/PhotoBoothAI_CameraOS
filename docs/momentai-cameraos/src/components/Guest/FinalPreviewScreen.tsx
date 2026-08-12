import React, { useEffect, useState } from 'react';
import { SessionData, EventConfig } from '../../types';
import { compositionEngine } from '../../services/compositionEngine';
import { Sparkles, ArrowLeft, Printer } from 'lucide-react';
import { motion } from 'motion/react';

interface FinalPreviewScreenProps {
  session: SessionData;
  eventConfig: EventConfig;
  onBackToEdit: () => void;
  onProceedToPrint: (outputs: { master: string; share: string; print: string }) => void;
}

export const FinalPreviewScreen: React.FC<FinalPreviewScreenProps> = ({
  session,
  eventConfig,
  onBackToEdit,
  onProceedToPrint,
}) => {
  const [outputs, setOutputs] = useState<{ master: string; share: string; print: string } | null>(
    session.outputs || null
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(!session.outputs);

  useEffect(() => {
    let isMounted = true;
    const generateFinalOutputs = async () => {
      if (session.selectedFrame && session.slotAssignments) {
        setIsGenerating(true);
        try {
          const res = await compositionEngine.renderComposition(
            session.selectedFrame,
            session.slotAssignments,
            eventConfig,
            session.customText,
            session.drawDataUrl,
            1800,
            2700
          );
          if (isMounted) {
            setOutputs(res);
          }
        } catch (e) {
          console.error('Final render error:', e);
        } finally {
          if (isMounted) setIsGenerating(false);
        }
      }
    };

    generateFinalOutputs();
    return () => {
      isMounted = false;
    };
  }, [session.selectedFrame, session.slotAssignments, eventConfig]);

  const handleFinish = () => {
    if (outputs) {
      onProceedToPrint(outputs);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-between p-6 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Header */}
      <div className="text-center z-10 mb-2">
        <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">
          THÀNH PHẨM IN HOÀN THIỆN
        </h2>
        <p className="text-xs sm:text-sm opacity-75 mt-1 font-sans">
          Kiểm tra tác phẩm trước khi gửi lệnh in và lấy mã QR nhận file digital.
        </p>
      </div>

      {/* Main High-Res Composition Card Preview */}
      <div className="my-auto w-full max-w-sm aspect-[2/3] max-h-[58vh] bg-[#F4F2EE] border border-[#1A1A1A]/20 p-3 shadow-2xl flex items-center justify-center relative overflow-hidden rounded-xs">
        {isGenerating || !outputs ? (
          <div className="flex flex-col items-center gap-3 text-[#1A1A1A]/60">
            <Sparkles className="w-8 h-8 animate-spin text-[#1A1A1A]" />
            <span className="text-xs font-mono uppercase tracking-widest font-medium">Đang xuất bản in 300 DPI...</span>
          </div>
        ) : (
          <motion.img
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={outputs.share}
            alt="Final Photobooth Print Preview"
            className="w-full h-full object-contain shadow-sm"
          />
        )}
      </div>

      {/* Details & Action Controls */}
      <div className="w-full max-w-xl flex flex-col items-center gap-4 mt-4">
        <div className="flex items-center justify-between w-full text-[10px] font-mono opacity-75 uppercase tracking-widest px-4 py-2 bg-[#F4F2EE] border border-[#1A1A1A]/15 font-medium">
          <span>Khổ: {session.selectedFrame?.preferredPaper || '4x6 Standard'}</span>
          <span>Độ phân giải: 1800 × 2700 PX</span>
          <span className="font-bold text-[#1A1A1A]">✓ SẴN SÀNG IN</span>
        </div>

        <div className="flex items-center justify-between gap-4 w-full">
          <button
            onClick={onBackToEdit}
            className="flex-1 h-[54px] bg-[#F4F2EE] hover:bg-[#1A1A1A] hover:text-[#FDFCFB] text-[#1A1A1A] font-bold text-xs uppercase tracking-[0.2em] border border-[#1A1A1A]/30 flex items-center justify-center gap-2 cursor-pointer transition-colors rounded-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>QUAY LẠI SỬA</span>
          </button>

          <button
            disabled={!outputs}
            onClick={handleFinish}
            className={`flex-1 h-[54px] font-bold text-xs tracking-[0.2em] uppercase border flex items-center justify-center gap-2 transition-colors cursor-pointer rounded-xs ${
              outputs
                ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A] hover:bg-[#333333] shadow-md'
                : 'bg-[#E8E6E1] text-[#1A1A1A]/40 border-[#1A1A1A]/10 cursor-not-allowed'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>IN ẢNH & LẤY MÃ QR</span>
          </button>
        </div>
      </div>
    </div>
  );
};

