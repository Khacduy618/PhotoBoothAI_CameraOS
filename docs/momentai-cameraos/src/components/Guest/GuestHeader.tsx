import React from 'react';
import { EventConfig } from '../../types';

interface GuestHeaderProps {
  eventConfig: EventConfig;
  onOpenOperator?: () => void;
}

export const GuestHeader: React.FC<GuestHeaderProps> = ({
  eventConfig,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FDFCFB] border-b border-[#1A1A1A]/10 text-[#1A1A1A] px-6 py-4 flex items-center justify-between">
      {/* Brand & Event Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-serif italic tracking-tight leading-none text-[#1A1A1A]">
          {eventConfig.eventName || 'PHOTOBOOTH'}
        </h1>
        {eventConfig.customTagline && (
          <p className="text-[10px] uppercase tracking-[0.15em] opacity-60 font-medium mt-0.5">
            {eventConfig.customTagline}
          </p>
        )}
      </div>
    </header>
  );
};


