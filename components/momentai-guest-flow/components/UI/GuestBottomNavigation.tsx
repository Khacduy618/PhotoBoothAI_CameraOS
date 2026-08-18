import React from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

export interface GuestBottomNavigationProps {
  onBack?: () => void;
  backText?: string;
  onNext?: () => void;
  nextText?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextIcon?: 'arrow' | 'check' | 'none';
  centerElement?: React.ReactNode;
  className?: string;
}

export const GuestBottomNavigation: React.FC<GuestBottomNavigationProps> = ({
  onBack,
  backText = 'QUAY LẠI',
  onNext,
  nextText,
  nextLabel,
  nextDisabled = false,
  nextIcon = 'arrow',
  centerElement,
  className = '',
}) => {
  const labelToUse = nextLabel || nextText || 'TIẾP TỤC';
  const isCenterOnly = !onBack && onNext;

  return (
    <div
      className={`w-full max-w-[98%] mx-auto border-t border-[#1A1A1A]/10 pt-3 pb-2 flex-shrink-0 mt-auto flex items-center justify-between z-30 ${className}`}
    >
      {/* Left Back Button */}
      <div className="flex-1 flex justify-start">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3.5 border border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-2 transition-colors cursor-pointer rounded-xs text-[#1A1A1A] bg-transparent"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backText}</span>
          </button>
        )}
      </div>

      {/* Center Optional Slot */}
      {centerElement && <div className="flex-1 flex justify-center">{centerElement}</div>}

      {/* Right Continue / Next Button */}
      <div className={`flex-1 flex ${isCenterOnly ? 'justify-center' : 'justify-end'}`}>
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`px-10 py-4 text-xs font-bold tracking-[0.25em] uppercase flex items-center gap-3 transition-colors shadow-md rounded-xs ${
              nextDisabled
                ? 'bg-[#1A1A1A]/20 text-[#1A1A1A]/40 cursor-not-allowed border border-transparent'
                : 'bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] cursor-pointer border border-[#1A1A1A]'
            }`}
          >
            <span>{labelToUse}</span>
            {nextIcon === 'arrow' && <ArrowRight className="w-4 h-4" />}
            {nextIcon === 'check' && <Check className="w-4 h-4 stroke-[3]" />}
          </button>
        )}
      </div>
    </div>
  );
};
