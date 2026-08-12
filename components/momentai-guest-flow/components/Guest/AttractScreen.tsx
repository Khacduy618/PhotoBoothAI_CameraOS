import React from 'react';
import { EventConfig } from '../../types';
import { Camera, MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import hoianSceneryImg from '../../assets/images/hoian_ancient_town_scenery_1786437274938.jpg';

interface AttractScreenProps {
  eventConfig: EventConfig;
  onStartSession: () => void;
}

export const AttractScreen: React.FC<AttractScreenProps> = ({
  onStartSession,
}) => {
  return (
    <div
      onClick={onStartSession}
      className="relative w-full h-screen select-none cursor-pointer overflow-hidden flex flex-col justify-between"
    >
      {/* Full-Screen Scenery Background Image */}
      <div className="absolute inset-0 w-full h-full z-0 bg-black">
        <img
          src={hoianSceneryImg.src}
          alt="Hội An Ancient Town Scenery"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center scale-105 filter brightness-90 saturate-110"
        />
        {/* Atmospheric Dark Overlay for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/75" />
      </div>

      {/* Top Header Tag */}
      <header className="relative z-10 pt-6 px-6 sm:px-10 flex justify-center sm:justify-start items-center text-[#FDFCFB]">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-black/40 backdrop-blur-md border border-white/20 rounded-full text-xs font-mono uppercase tracking-widest text-[#FDFCFB]"
        >
          <MapPin className="w-3.5 h-3.5 text-[#E6C687]" />
          <span>PHỐ CỔ HỘI AN • TIỆM ẢNH DI SẢN</span>
        </motion.div>
      </header>

      {/* Center Hero Text & Touch Action Button */}
      <main className="relative z-10 my-auto px-6 max-w-4xl mx-auto flex flex-col items-center text-center gap-8 py-8">
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-serif tracking-tight text-[#FDFCFB] leading-tight drop-shadow-lg"
          >
            Chụp Ảnh Lấy Ngay <br />
            <span className="italic font-light text-[#E6C687]">Tại Phố Cổ Hội An</span>
          </motion.h1>
        </div>

        {/* Action Button Centered Directly Below Title Sequence */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="pt-2"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              boxShadow: [
                '0 0 0 0px rgba(230, 198, 135, 0.4)',
                '0 0 0 16px rgba(230, 198, 135, 0)',
              ],
            }}
            transition={{
              boxShadow: {
                repeat: Infinity,
                duration: 2,
              },
            }}
            className="w-full sm:w-[380px] h-[60px] bg-[#FDFCFB] text-[#1A1A1A] border-2 border-[#E6C687] flex items-center justify-between px-8 group cursor-pointer shadow-2xl rounded-sm"
          >
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-[#C85A32]" />
              <span className="text-sm uppercase tracking-[0.25em] font-bold">CHẠM ĐỂ CHỤP ẢNH</span>
            </div>
            <ArrowRight className="w-5 h-5 text-[#1A1A1A] transition-transform group-hover:translate-x-1.5" />
          </motion.div>
        </motion.div>
      </main>

      {/* Footer Branding Subtitle */}
      <footer className="relative z-10 pb-6 text-center text-white/50 text-xs font-mono uppercase tracking-widest">
        MOMENTAI PHOTOBOOTH • HOI AN HERITAGE EDITION
      </footer>
    </div>
  );
};
