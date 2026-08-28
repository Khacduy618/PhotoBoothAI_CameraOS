import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { GuestBottomNavigation } from '../UI/GuestBottomNavigation';
import { GUEST_PRODUCTS, type GuestProductConfig, type GuestProductId } from '@/types/guest-product';

interface SelectProductScreenProps {
  defaultProductId?: GuestProductId;
  onSelectProduct: (product: GuestProductConfig) => void;
  onBackToStart: () => void;
}

export const SelectProductScreen: React.FC<SelectProductScreenProps> = ({
  defaultProductId = 'STRIP_4',
  onSelectProduct,
  onBackToStart,
}) => {
  const [selectedId, setSelectedId] = useState<GuestProductId | null>(defaultProductId);

  const selectedProduct = selectedId ? GUEST_PRODUCTS[selectedId] : null;

  const handleConfirm = () => {
    if (selectedProduct) {
      onSelectProduct(selectedProduct);
    }
  };

  const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

  /**
   * Wireframe Mockup Preview:
   * Enlarged wireframe mockup visuals filling the card space generously.
   * When selected, scales up to scale-135/140 with rich green glow shadow and green border!
   */
  const renderWireframeMockup = (productId: GuestProductId) => {
    const isSelected = selectedId === productId;

    switch (productId) {
      case 'PREMIUM_POSTCARD':
        return (
          <div className={`transition-all duration-300 transform my-auto ${
            isSelected ? 'scale-135 sm:scale-140 z-20' : 'scale-120 hover:scale-125 opacity-90'
          }`}>
            <div className={`w-36 sm:w-42 xl:w-46 aspect-[2/3] bg-[#FDFCFB] p-3 flex flex-col justify-between border-2 rounded-xs transition-all duration-300 ${
              isSelected
                ? 'border-[#10b981] shadow-[0_25px_50px_rgba(16,185,129,0.4)] ring-2 ring-[#10b981]/40'
                : 'border-[#f59e0b]/50 shadow-md'
            }`}>
              <div className="w-full h-[68%] bg-[#f59e0b]/10 border-2 border-dashed border-[#f59e0b]/40 flex flex-col items-center justify-center font-mono text-xs font-bold text-[#f59e0b] rounded-xs p-1 text-center">
                <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> 1 Ảnh Chọn</span>
                <span className="text-[9px] font-sans font-normal opacity-80 mt-0.5">(Chụp 3 dáng)</span>
              </div>
              <div className="w-full h-[18%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/20 flex items-center justify-center font-serif italic text-[9px] text-[#1A1A1A]/70 rounded-xs">
                ✍️ Ký tên & Vẽ tay
              </div>
              <div className="text-[10px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">
                PHỐ CỔ HỘI AN
              </div>
            </div>
          </div>
        );

      case 'STRIP_2':
        return (
          <div className={`transition-all duration-300 transform flex items-center justify-center relative py-1 my-auto ${
            isSelected ? 'scale-135 sm:scale-140 z-20' : 'scale-120 hover:scale-125 opacity-90'
          }`}>
            {/* Strip 1 (-rotate-6) */}
            <div className={`w-20 sm:w-24 xl:w-26 aspect-[1/3] bg-[#FDFCFB] p-1.5 flex flex-col justify-between gap-1 border-2 rounded-xs transform -rotate-6 transition-all duration-300 ${
              isSelected
                ? 'border-[#10b981] shadow-[0_20px_40px_rgba(16,185,129,0.35)] ring-1 ring-[#10b981]/30'
                : 'border-[#1A1A1A]/30 shadow-md'
            }`}>
              <div className="w-full h-[40%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs">1</div>
              <div className="w-full h-[40%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs">2</div>
              <div className="text-[7px] font-serif italic text-center text-[#1A1A1A]/70 font-bold truncate border-t border-[#1A1A1A]/10 pt-0.5">HỘI AN</div>
            </div>
            {/* Strip 2 (+rotate-6 overlapping) */}
            <div className={`w-20 sm:w-24 xl:w-26 aspect-[1/3] bg-[#FDFCFB] p-1.5 flex flex-col justify-between gap-1 border-2 rounded-xs transform rotate-6 transition-all duration-300 -ml-7 z-10 ${
              isSelected
                ? 'border-[#10b981] shadow-[0_25px_50px_rgba(16,185,129,0.45)] ring-2 ring-[#10b981]/40'
                : 'border-[#1A1A1A]/30 shadow-xl'
            }`}>
              <div className="w-full h-[40%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs">1</div>
              <div className="w-full h-[40%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs">2</div>
              <div className="text-[7px] font-serif italic text-center text-[#1A1A1A]/70 font-bold truncate border-t border-[#1A1A1A]/10 pt-0.5">HỘI AN</div>
            </div>
          </div>
        );

      case 'STRIP_4':
        return (
          <div className={`transition-all duration-300 transform flex items-center justify-center relative py-1 my-auto ${
            isSelected ? 'scale-135 sm:scale-140 z-20' : 'scale-120 hover:scale-125 opacity-90'
          }`}>
            {/* Strip 1 (-rotate-6) */}
            <div className={`w-20 sm:w-24 xl:w-26 aspect-[1/3] bg-[#FDFCFB] p-1.5 flex flex-col justify-between gap-0.5 border-2 rounded-xs transform -rotate-6 transition-all duration-300 ${
              isSelected
                ? 'border-[#10b981] shadow-[0_20px_40px_rgba(16,185,129,0.35)] ring-1 ring-[#10b981]/30'
                : 'border-[#1A1A1A]/30 shadow-md'
            }`}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="w-full h-[18%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[9px] font-bold text-[#1A1A1A]/60 rounded-xs">{n}</div>
              ))}
              <div className="text-[7px] font-serif italic text-center text-[#1A1A1A]/70 font-bold truncate border-t border-[#1A1A1A]/10 pt-0.5">HỘI AN</div>
            </div>
            {/* Strip 2 (+rotate-6 overlapping) */}
            <div className={`w-20 sm:w-24 xl:w-26 aspect-[1/3] bg-[#FDFCFB] p-1.5 flex flex-col justify-between gap-0.5 border-2 rounded-xs transform rotate-6 transition-all duration-300 -ml-7 z-10 ${
              isSelected
                ? 'border-[#10b981] shadow-[0_25px_50px_rgba(16,185,129,0.45)] ring-2 ring-[#10b981]/40'
                : 'border-[#1A1A1A]/30 shadow-xl'
            }`}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="w-full h-[18%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[9px] font-bold text-[#1A1A1A]/60 rounded-xs">{n}</div>
              ))}
              <div className="text-[7px] font-serif italic text-center text-[#1A1A1A]/70 font-bold truncate border-t border-[#1A1A1A]/10 pt-0.5">HỘI AN</div>
            </div>
          </div>
        );

      case 'SHEET_4':
        return (
          <div className={`transition-all duration-300 transform my-auto ${
            isSelected ? 'scale-135 sm:scale-140 z-20' : 'scale-120 hover:scale-125 opacity-90'
          }`}>
            <div className={`w-36 sm:w-42 xl:w-46 aspect-[2/3] bg-[#FDFCFB] p-3 flex flex-col justify-between gap-1.5 border-2 rounded-xs transition-all duration-300 ${
              isSelected
                ? 'border-[#10b981] shadow-[0_25px_50px_rgba(16,185,129,0.4)] ring-2 ring-[#10b981]/40'
                : 'border-[#1A1A1A]/30 shadow-lg'
            }`}>
              <div className="grid grid-cols-2 gap-1.5 w-full h-[84%]">
                {[1, 2, 3, 4].map((num) => (
                  <div key={num} className="w-full h-full bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs">
                    {num}
                  </div>
                ))}
              </div>
              <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
            </div>
          </div>
        );

      case 'SHEET_6':
        return (
          <div className={`transition-all duration-300 transform my-auto ${
            isSelected ? 'scale-135 sm:scale-140 z-20' : 'scale-120 hover:scale-125 opacity-90'
          }`}>
            <div className={`w-36 sm:w-42 xl:w-46 aspect-[2/3] bg-[#FDFCFB] p-3 flex flex-col justify-between gap-1.5 border-2 rounded-xs transition-all duration-300 ${
              isSelected
                ? 'border-[#10b981] shadow-[0_25px_50px_rgba(16,185,129,0.4)] ring-2 ring-[#10b981]/40'
                : 'border-[#1A1A1A]/30 shadow-lg'
            }`}>
              <div className="grid grid-cols-2 gap-1.5 w-full h-[84%]">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <div key={num} className="w-full h-full bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs">
                    {num}
                  </div>
                ))}
              </div>
              <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div>
            </div>
          </div>
        );
    }
  };

  /**
   * Sub-option item rendered directly inside group card without inner card boxes or "ĐÃ CHỌN" badges
   */
  const renderSubOptionItem = (id: GuestProductId) => {
    const product = GUEST_PRODUCTS[id];
    const isSelected = selectedId === id;

    return (
      <div
        key={id}
        onClick={() => setSelectedId(id)}
        className="relative p-2 w-full h-full flex flex-col items-center justify-between text-center cursor-pointer select-none group"
      >
        {/* Wireframe Mockup Illustration Centered - Hero Animation & Shadow Focus */}
        <div className="my-auto flex items-center justify-center w-full py-4 flex-1 min-h-[240px]">
          {renderWireframeMockup(id)}
        </div>

        {/* Product Details & Price Footer */}
        <div className="w-full pt-3 border-t border-[#1A1A1A]/10 space-y-1">
          <h3 className={`text-base sm:text-lg font-serif font-black tracking-tight transition-colors duration-200 ${
            isSelected ? 'text-[#10b981]' : 'text-[#1A1A1A] group-hover:text-[#10b981]'
          }`}>
            {product.name}
          </h3>
          <div className={`text-sm sm:text-base font-black transition-colors duration-200 ${
            isSelected ? 'text-[#10b981]' : 'text-[#1A1A1A]'
          }`}>
            {formatVnd(product.price)}
          </div>
          <p className="text-[10px] sm:text-xs font-sans opacity-70 leading-tight line-clamp-2">
            {product.description}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-screen flex flex-col justify-between px-4 py-3 sm:px-8 sm:py-5 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden">
      {/* Top Header */}
      <div className="w-full max-w-[98%] mx-auto flex flex-col items-center text-center">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-normal text-[#1A1A1A] mb-1"
        >
          CHỌN LOẠI ẢNH BẠN MUỐN IN
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs sm:text-sm opacity-75 max-w-lg font-sans"
        >
          Chọn sản phẩm phù hợp để xác định số lần chụp và định dạng thành phẩm in.
        </motion.p>
      </div>

      {/* 3 Group Cards Grid (20% + 40% + 40% Width Distribution) */}
      <div className="w-full max-w-[98%] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-10 gap-5 items-stretch my-auto py-2 max-h-[76vh]">
        {/* GROUP 1: PREMIUM POSTCARD (20% Width) */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setSelectedId('PREMIUM_POSTCARD')}
          className={`lg:col-span-2 relative p-4 sm:p-5 h-full border-2 transition-all duration-300 flex flex-col items-center justify-between text-center cursor-pointer rounded-md overflow-hidden bg-[#F4F2EE] ${
            selectedId === 'PREMIUM_POSTCARD'
              ? 'border-[#10b981] ring-4 ring-[#10b981]/25 shadow-[0_15px_35px_rgba(16,185,129,0.2)] bg-[#f0fdf4]/50 z-20'
              : 'border-[#1A1A1A]/15 hover:border-[#10b981]/40'
          }`}
        >
          <div className="w-full flex items-center justify-center mt-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full border bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30">
              ★ PREMIUM POSTCARD
            </span>
          </div>

          <div className="my-auto flex items-center justify-center w-full py-2 flex-1 min-h-[240px]">
            {renderWireframeMockup('PREMIUM_POSTCARD')}
          </div>

          <div className="w-full pt-3 border-t border-[#1A1A1A]/10 space-y-1">
            <h3 className={`text-base sm:text-lg font-serif font-black tracking-tight transition-colors duration-200 ${
              selectedId === 'PREMIUM_POSTCARD' ? 'text-[#10b981]' : 'text-[#1A1A1A]'
            }`}>
              {GUEST_PRODUCTS.PREMIUM_POSTCARD.name}
            </h3>
            <div className={`text-sm sm:text-base font-black transition-colors duration-200 ${
              selectedId === 'PREMIUM_POSTCARD' ? 'text-[#10b981]' : 'text-[#1A1A1A]'
            }`}>
              {formatVnd(GUEST_PRODUCTS.PREMIUM_POSTCARD.price)}
            </div>
            <p className="text-[10px] sm:text-xs font-sans opacity-70 leading-tight line-clamp-2">
              {GUEST_PRODUCTS.PREMIUM_POSTCARD.description}
            </p>
          </div>
        </motion.button>

        {/* GROUP 2: PHOTO STRIP (40% Width - Single Group Card) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className={`lg:col-span-4 relative p-3 sm:p-4 h-full border-2 transition-all duration-300 flex flex-col justify-between rounded-md bg-[#F4F2EE] ${
            selectedId === 'STRIP_2' || selectedId === 'STRIP_4'
              ? 'border-[#10b981] ring-2 ring-[#10b981]/20 shadow-[0_15px_35px_rgba(16,185,129,0.15)]'
              : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]/40'
          }`}
        >
          {/* Top Group Banner */}
          <div className="w-full flex items-center justify-center mb-1 py-1">
            <span className="text-xs font-mono font-bold uppercase tracking-widest px-3.5 py-1 rounded-full bg-[#1A1A1A]/5 text-[#1A1A1A] border border-[#1A1A1A]/20">
              PHOTO STRIP
            </span>
          </div>

          {/* Clean Sub-option Columns without inner column boxes */}
          <div className="grid grid-cols-2 gap-4 flex-1 items-stretch h-full">
            {renderSubOptionItem('STRIP_2')}
            {renderSubOptionItem('STRIP_4')}
          </div>
        </motion.div>

        {/* GROUP 3: PHOTO SHEET (40% Width - Single Group Card) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className={`lg:col-span-4 relative p-3 sm:p-4 h-full border-2 transition-all duration-300 flex flex-col justify-between rounded-md bg-[#F4F2EE] ${
            selectedId === 'SHEET_4' || selectedId === 'SHEET_6'
              ? 'border-[#10b981] ring-2 ring-[#10b981]/20 shadow-[0_15px_35px_rgba(16,185,129,0.15)]'
              : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]/40'
          }`}
        >
          {/* Top Group Banner */}
          <div className="w-full flex items-center justify-center mb-1 py-1">
            <span className="text-xs font-mono font-bold uppercase tracking-widest px-3.5 py-1 rounded-full bg-[#1A1A1A]/5 text-[#1A1A1A] border border-[#1A1A1A]/20">
              PHOTO SHEET
            </span>
          </div>

          {/* Clean Sub-option Columns without inner column boxes */}
          <div className="grid grid-cols-2 gap-4 flex-1 items-stretch h-full">
            {renderSubOptionItem('SHEET_4')}
            {renderSubOptionItem('SHEET_6')}
          </div>
        </motion.div>
      </div>

      {/* Bottom Action Navigation */}
      <GuestBottomNavigation
        onBack={onBackToStart}
        backText="QUAY LẠI"
        onNext={handleConfirm}
        nextText="TIẾP TỤC"
        nextDisabled={!selectedProduct}
      />
    </div>
  );
};
