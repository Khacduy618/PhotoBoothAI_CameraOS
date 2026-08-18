import React from 'react';
import { FrameTemplate, SessionData } from '../../../types';
import { FramePreview5x15Strip } from './FramePreview5x15Strip';
import { FramePreview10x15Grid } from './FramePreview10x15Grid';

export interface FramePreviewCardProps {
  template: FrameTemplate;
  session: SessionData;
  drawDataUrl?: string;
  className?: string;
}

const normalizePercent = (val: number): number => (val <= 1 && val > 0 ? val * 100 : val);

export const isStripTemplate = (template: FrameTemplate): boolean => {
  const normSlots = template.slots || [];

  // Any template with 2 columns of slots (x >= 35%) or explicit 2x2/2x3 grid is a 10x15 Sheet/Grid, NEVER a 5x15 Strip!
  const hasSecondColumn = normSlots.some((s) => normalizePercent(s.x) >= 35);
  if (hasSecondColumn || template.layout?.type === '2x2' || template.layout?.type === '2x3') {
    return false;
  }

  if (
    template.category === 'STRIP' ||
    template.renderMode === 'double-strip' ||
    template.preferredPaper === '2x6-double' ||
    (template.preferredPaper as string) === '5x15' ||
    template.layout?.type === '1x4' ||
    template.layout?.type === '1x2'
  ) {
    return true;
  }

  const slotCount = normSlots.length || template.shotCount || template.layout?.slotCount || 4;
  return (slotCount === 2 || slotCount === 4) && normalizePercent(normSlots[0]?.width || 0) > 60;
};

export const FramePreviewCard: React.FC<FramePreviewCardProps> = ({
  template,
  session,
  drawDataUrl,
  className = '',
}) => {
  const useStrip = isStripTemplate(template);

  if (useStrip) {
    return (
      <FramePreview5x15Strip
        template={template}
        session={session}
        drawDataUrl={drawDataUrl}
        className={className}
      />
    );
  }

  return (
    <FramePreview10x15Grid
      template={template}
      session={session}
      drawDataUrl={drawDataUrl}
      className={className}
    />
  );
};
