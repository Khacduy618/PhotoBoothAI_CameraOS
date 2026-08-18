import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus } from 'lucide-react';
import { GuestBottomNavigation } from '../UI/GuestBottomNavigation';

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
  const [selectedQuantity, setSelectedQuantity] = useState<number>(Math.min(5, Math.max(1, defaultQuantity)));

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
  const clampedQuantity = Math.min(5, Math.max(1, selectedQuantity));

  const parseVnd = (price: string) => Number(price.replace(/[^0-9]/g, '')) || 0;
  const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;
  const selectedTotalPrice = clampedQuantity === 1
    ? pricing.price1
    : clampedQuantity === 2
      ? pricing.price2
      : formatVnd(parseVnd(pricing.price2) + (clampedQuantity - 2) * parseVnd(pricing.price1));

  const adjustQuantity = (delta: number) => {
    setSelectedQuantity((current) => Math.min(5, Math.max(1, current + delta)));
  };

  // Render clean schematic photobooth wireframe card matching SelectShotsScreen dimensions
  const renderSinglePrintCard = (cardSizeClass: string = 'w-40 sm:w-44 xl:w-48', extraClass: string = '') => {
    if (shotCount === 4) {
      return (
        <div className={`${cardSizeClass} aspect-[2/3] bg-[#FDFCFB] p-3 sm:p-4 flex flex-col justify-between gap-1.5 border-2 border-[#1A1A1A]/20 shadow-md rounded-xs ${extraClass}`}>
          <div className="grid grid-cols-2 gap-1.5 w-full h-[84%]">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="w-full h-full bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs">
                {num}
              </div>
            ))}
          </div>
          <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
        </div>
      );
    } else if (shotCount === 6) {
      return (
        <div className={`${cardSizeClass} aspect-[2/3] bg-[#FDFCFB] p-3 sm:p-4 flex flex-col justify-between gap-1.5 border-2 border-[#1A1A1A]/20 shadow-md rounded-xs ${extraClass}`}>
          <div className="grid grid-cols-2 gap-1.5 w-full h-[84%]">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <div key={num} className="w-full h-full bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs">
                {num}
              </div>
            ))}
          </div>
          <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
        </div>
      );
    } else if (shotCount === 2) {
      return (
        <div className={`${cardSizeClass} aspect-[2/3] bg-[#FDFCFB] p-3 sm:p-4 flex flex-col justify-between gap-2 border-2 border-[#1A1A1A]/20 shadow-md rounded-xs ${extraClass}`}>
          <div className="w-full h-[41%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-base font-bold text-[#1A1A1A]/60 rounded-xs">
            1
          </div>
          <div className="w-full h-[41%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-base font-bold text-[#1A1A1A]/60 rounded-xs">
            2
          </div>
          <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
        </div>
      );
    } else {
      return (
        <div className={`${cardSizeClass} aspect-[2/3] bg-[#FDFCFB] p-3 sm:p-4 flex flex-col justify-between border-2 border-[#1A1A1A]/20 shadow-md rounded-xs ${extraClass}`}>
          <div className="w-full h-[84%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-base font-bold text-[#1A1A1A]/60 rounded-xs">
            1
          </div>
          <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-1 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
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
      mockup: renderSinglePrintCard('w-40 sm:w-44 xl:w-48', 'transform hover:scale-105 transition-transform duration-200'),
    },
    {
      quantity: 2,
      title: '2 TẤM IN',
      price: pricing.price2,
      badgeNote: pricing.savings,
      description: 'In 2 bản song song cho bạn và bạn đồng hành lưu giữ.',
      mockup: (
        <div className="flex items-center justify-center gap-2 relative py-1">
          {renderSinglePrintCard('w-32 sm:w-36 xl:w-40', 'transform -rotate-6 shadow-md hover:scale-105 transition-transform duration-200')}
          {renderSinglePrintCard('w-32 sm:w-36 xl:w-40', 'transform rotate-6 shadow-xl hover:scale-105 transition-transform duration-200')}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full h-screen flex flex-col justify-between px-4 py-3 sm:px-8 sm:py-5 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-[98%] mx-auto flex flex-col items-center text-center">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight text-[#1A1A1A]"
        >
          CHỌN SỐ LƯỢNG IN
        </motion.h2>
        <p className="mt-1 text-xs sm:text-sm text-[#1A1A1A]/70 max-w-lg">
          Chọn nhanh 1 hoặc 2 tấm in, hoặc tinh chỉnh thêm số lượng ở bên phải.
        </p>
      </div>

      {/* Options Grid */}
      <div className="w-full max-w-[98%] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-center my-auto py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full items-center">
          {options.map((opt) => {
            const isSelected = selectedQuantity === opt.quantity;
            return (
              <motion.div
                key={opt.quantity}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedQuantity(opt.quantity)}
                className={`relative p-6 sm:p-8 border-2 transition-all duration-200 flex flex-col items-center justify-between text-center cursor-pointer bg-[#F4F2EE] text-[#1A1A1A] h-[58vh] xl:h-[64vh] rounded-md ${
                  isSelected
                    ? 'border-[#1A1A1A] ring-4 ring-[#1A1A1A]/20 shadow-xl bg-[#FAF8F5]'
                    : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]/60'
                }`}
              >
                {/* Selected Badge */}
                {isSelected && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-[#1A1A1A] text-[#FDFCFB] text-xs font-bold px-3.5 py-1.5 tracking-wider uppercase rounded-xs shadow-md z-10">
                    <span>ĐÃ CHỌN</span>
                  </div>
                )}

                {/* Sample / Mockup illustration - centered in top area */}
                <div className="flex-1 w-full flex items-center justify-center my-auto py-2">
                  {opt.mockup}
                </div>

                {/* Title & Price */}
                <div className="flex flex-col items-center mt-auto">
                  <span className="font-serif text-3xl sm:text-4xl font-black text-[#1A1A1A]">
                    {opt.title}
                  </span>

                  <span className="text-3xl font-extrabold text-[#1A1A1A] mt-1.5 font-sans">
                    {opt.price}
                  </span>

                  <span className="text-xs uppercase font-bold tracking-widest text-[#1A1A1A]/70 mt-1.5">
                    {opt.badgeNote}
                  </span>

                  <p className="mt-2 text-xs sm:text-sm leading-relaxed px-2 opacity-75 max-w-xs">
                    {opt.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="h-[58vh] xl:h-[64vh] p-8 border-2 border-[#1A1A1A]/15 bg-[#F4F2EE] rounded-md flex flex-col justify-center text-center shadow-md"
        >
          <span className="text-xs uppercase font-bold tracking-[0.22em] text-[#1A1A1A]/60">
            Tùy chỉnh
          </span>
          <span className="mt-3 font-serif text-3xl font-black text-[#1A1A1A]">
            Số lượng in
          </span>

          <div className="mt-8 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => adjustQuantity(-1)}
              disabled={clampedQuantity <= 1}
              aria-label="Giảm số lượng in"
              className="w-18 h-18 border-2 border-[#1A1A1A]/30 bg-[#FDFCFB] text-[#1A1A1A] flex items-center justify-center rounded-full disabled:opacity-35 disabled:cursor-not-allowed hover:border-[#1A1A1A] transition-colors cursor-pointer shadow-sm"
            >
              <Minus className="w-8 h-8" />
            </button>

            <div className="w-28 h-28 rounded-full bg-[#1A1A1A] text-[#FDFCFB] flex items-center justify-center font-serif text-6xl font-bold shadow-lg" aria-live="polite">
              {clampedQuantity}
            </div>

            <button
              type="button"
              onClick={() => adjustQuantity(1)}
              disabled={clampedQuantity >= 5}
              aria-label="Tăng số lượng in"
              className="w-18 h-18 border-2 border-[#1A1A1A]/30 bg-[#FDFCFB] text-[#1A1A1A] flex items-center justify-center rounded-full disabled:opacity-35 disabled:cursor-not-allowed hover:border-[#1A1A1A] transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-8 h-8" />
            </button>
          </div>

          <div className="mt-6 border-t border-[#1A1A1A]/10 pt-5" aria-live="polite">
            <span className="block text-xs uppercase font-bold tracking-[0.2em] text-[#1A1A1A]/60">
              Tổng tiền
            </span>
            <span className="mt-1 block text-3xl font-black text-[#1A1A1A] font-sans">
              {selectedTotalPrice}
            </span>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[#1A1A1A]/70">
            Dùng nút - / + nếu khách muốn thêm bản in giống nhau. Tối đa 5 tấm.
          </p>
        </motion.div>
      </div>

      {/* Shared Footer Navigation */}
      <GuestBottomNavigation
        onBack={onBackToShots}
        backText="QUAY LẠI"
        onNext={() => onConfirmPrintQuantity(clampedQuantity)}
        nextText="TIẾP TỤC"
      />
    </div>
  );
};
