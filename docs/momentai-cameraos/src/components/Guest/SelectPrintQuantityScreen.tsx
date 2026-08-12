import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface SelectPrintQuantityScreenProps {
  shotCount: number;
  defaultQuantity?: number;
  onConfirmPrintQuantity: (quantity: number) => void;
  onBackToShots: () => void;
}

export const SelectPrintQuantityScreen: React.FC<SelectPrintQuantityScreenProps> = ({
  shotCount,
  defaultQuantity = 1,
  onConfirmPrintQuantity,
  onBackToShots,
}) => {
  const [selectedQuantity, setSelectedQuantity] = useState<number>(defaultQuantity);

  // Pricing rules based on shotCount
  const getPricing = (count: number) => {
    switch (count) {
      case 1:
        return { price1: '30.000đ', price2: '50.000đ', savings: 'Tiết kiệm 10.000đ' };
      case 2:
        return { price1: '40.000đ', price2: '70.000đ', savings: 'Tiết kiệm 10.000đ' };
      case 6:
        return { price1: '60.000đ', price2: '100.000đ', savings: 'Tiết kiệm 20.000đ' };
      case 4:
      default:
        return { price1: '50.000đ', price2: '80.000đ', savings: 'Tiết kiệm 20.000đ' };
    }
  };

  const pricing = getPricing(shotCount);

  // Render clean schematic photobooth wireframe card based on shotCount
  const renderSinglePrintCard = (extraClass: string = '') => {
    if (shotCount === 4) {
      return (
        <div className={`w-20 aspect-[1/2.2] bg-[#FDFCFB] p-1.5 flex flex-col justify-between gap-1 border border-[#1A1A1A]/30 shadow-md rounded-xs ${extraClass}`}>
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="w-full h-[20%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[9px] font-bold text-[#1A1A1A]/50 rounded-xs">
              {num}
            </div>
          ))}
          <div className="text-[7px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">HỘI AN</div>
        </div>
      );
    } else if (shotCount === 6) {
      return (
        <div className={`w-28 aspect-[2/3] bg-[#FDFCFB] p-2 flex flex-col justify-between gap-1 border border-[#1A1A1A]/30 shadow-md rounded-xs ${extraClass}`}>
          <div className="grid grid-cols-2 gap-1 w-full h-[85%]">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <div key={num} className="w-full h-full bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[9px] font-bold text-[#1A1A1A]/50 rounded-xs">
                {num}
              </div>
            ))}
          </div>
          <div className="text-[8px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
        </div>
      );
    } else if (shotCount === 2) {
      return (
        <div className={`w-28 aspect-[2/3] bg-[#FDFCFB] p-2.5 flex flex-col justify-between gap-1.5 border border-[#1A1A1A]/30 shadow-md rounded-xs ${extraClass}`}>
          <div className="w-full h-[41%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/50 rounded-xs">
            1
          </div>
          <div className="w-full h-[41%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/50 rounded-xs">
            2
          </div>
          <div className="text-[8px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
        </div>
      );
    } else {
      return (
        <div className={`w-28 aspect-[2/3] bg-[#FDFCFB] p-2.5 flex flex-col justify-between border border-[#1A1A1A]/30 shadow-md rounded-xs ${extraClass}`}>
          <div className="w-full h-[82%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/50 rounded-xs">
            1
          </div>
          <div className="text-[8px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-1 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
        </div>
      );
    }
  };

  const options = [
    {
      quantity: 1,
      title: '1 TẤM IN',
      price: pricing.price1,
      badgeNote: 'Bản in đơn',
      description: 'In 1 bản hình ảnh chất lượng cao sau khi kết thúc buổi chụp.',
      mockup: renderSinglePrintCard('transform hover:scale-105 transition-transform duration-200'),
    },
    {
      quantity: 2,
      title: '2 TẤM IN',
      price: pricing.price2,
      badgeNote: pricing.savings,
      description: 'In 2 bản song song cho bạn và bạn đồng hành lưu giữ.',
      mockup: (
        <div className="flex items-center justify-center gap-3 relative py-2">
          {renderSinglePrintCard('transform -rotate-6 shadow-md hover:scale-105 transition-transform duration-200')}
          {renderSinglePrintCard('transform rotate-6 shadow-xl hover:scale-105 transition-transform duration-200')}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full h-screen flex flex-col justify-between p-6 sm:p-10 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]"
        >
          CHỌN SỐ LƯỢNG IN
        </motion.h2>
        <p className="mt-2 text-xs sm:text-sm text-[#1A1A1A]/70 max-w-md">
          Chọn 1 hoặc 2 bản in giấy nhiệt chất lượng cao cho gói {shotCount} dáng chụp đã chọn.
        </p>
      </div>

      {/* Options Grid */}
      <div className="w-full max-w-4xl mx-auto my-auto py-6 grid grid-cols-1 sm:grid-cols-2 gap-8">
        {options.map((opt) => {
          const isSelected = selectedQuantity === opt.quantity;
          return (
            <motion.div
              key={opt.quantity}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedQuantity(opt.quantity)}
              className={`relative p-8 sm:p-10 border-2 transition-all duration-200 flex flex-col items-center justify-between text-center cursor-pointer bg-[#F4F2EE] text-[#1A1A1A] min-h-[380px] rounded-sm ${
                isSelected
                  ? 'border-[#1A1A1A] ring-2 ring-[#1A1A1A] shadow-md bg-[#FAF8F5]'
                  : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]/60'
              }`}
            >
              {/* Selected Badge */}
              {isSelected && (
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-[#1A1A1A] text-[#FDFCFB] text-[10px] font-bold px-3 py-1 tracking-wider uppercase rounded-xs">
                  <Check className="w-3.5 h-3.5 text-[#FDFCFB]" />
                  <span>ĐÃ CHỌN</span>
                </div>
              )}

              {/* Sample / Mockup illustration */}
              <div className="h-48 flex items-center justify-center my-2">
                {opt.mockup}
              </div>

              {/* Title & Price */}
              <div className="flex flex-col items-center mt-2">
                <span className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
                  {opt.title}
                </span>

                <span className="text-2xl font-bold text-[#1A1A1A] mt-1 font-sans">
                  {opt.price}
                </span>

                <span className="text-[11px] uppercase font-bold tracking-widest text-[#1A1A1A]/70 mt-1">
                  {opt.badgeNote}
                </span>

                <p className="mt-2 text-xs leading-relaxed px-2 opacity-75 max-w-xs">
                  {opt.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      <div className="w-full max-w-4xl mx-auto pt-6 border-t border-[#1A1A1A]/10 flex items-center justify-between">
        <button
          onClick={onBackToShots}
          className="flex items-center gap-2 px-6 py-3.5 border border-[#1A1A1A]/30 text-[#1A1A1A] hover:border-[#1A1A1A] transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>QUAY LẠI</span>
        </button>

        <button
          onClick={() => onConfirmPrintQuantity(selectedQuantity)}
          className="flex items-center gap-3 px-10 py-4 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] transition-colors text-xs font-bold uppercase tracking-[0.2em] cursor-pointer shadow-md rounded-xs"
        >
          <span>TIẾP TỤC</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

