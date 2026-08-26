import React from 'react';
import { motion } from 'motion/react';

// Dreamy Cotton Candy Sky (Kẹo Bông Pastel): Mây hồng phấn & tím nhạt bồng bềnh chuẩn phong cách ảnh Hàn Quốc (Life4cut/Photobooth)
const COTTON_CANDY_WALLPAPER = {
  id: 'cute-cotton-candy-sky',
  name: 'Cotton Candy Sky',
  url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=2560&q=85',
};

export const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#120e18]">
      
      {/* 🌸 Kẹo Bông Pastel - Gentle & Smooth Breathing Movement */}
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{
          opacity: 1,
          scale: [1.03, 1.08, 1.03],
          x: [0, -10, 8, 0],
          y: [0, 8, -6, 0]
        }}
        transition={{
          opacity: { duration: 1 },
          scale: { duration: 22, repeat: Infinity, ease: 'easeInOut' },
          x: { duration: 26, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 30, repeat: Infinity, ease: 'easeInOut' }
        }}
        className="absolute inset-0 w-full h-full bg-cover bg-center"
        style={{
          backgroundImage: `url(${COTTON_CANDY_WALLPAPER.url})`,
          backgroundPosition: 'center center'
        }}
      />

      {/* Soft Pastel Ambient Darkening Overlay - Smooth contrast & high readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/60 backdrop-blur-[1.5px]" />

      {/* Floating Gentle Pastel Light Blooms (Soft glowing dreamy ambience) */}
      <motion.div
        animate={{
          opacity: [0.3, 0.55, 0.3],
          scale: [1, 1.2, 1],
          x: [0, 35, 0],
          y: [0, -25, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/4 -left-10 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-pink-400/25 via-rose-300/20 to-purple-400/25 blur-[120px]"
      />

      <motion.div
        animate={{
          opacity: [0.25, 0.5, 0.25],
          scale: [1.1, 0.95, 1.1],
          x: [0, -30, 0],
          y: [0, 35, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute bottom-1/4 -right-10 w-[550px] h-[550px] rounded-full bg-gradient-to-bl from-amber-300/20 via-pink-400/20 to-indigo-400/20 blur-[130px]"
      />
    </div>
  );
};
