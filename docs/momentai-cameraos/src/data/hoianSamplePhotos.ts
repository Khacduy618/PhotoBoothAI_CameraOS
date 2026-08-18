const samplePhoto = (label: string, start: string, end: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="400" cy="330" r="130" fill="rgba(255,255,255,.86)"/><ellipse cx="400" cy="690" rx="255" ry="190" fill="rgba(255,255,255,.78)"/><text x="400" y="930" text-anchor="middle" font-family="serif" font-size="44" fill="white">${label}</text></svg>`)}`;

export const HOI_AN_SAMPLE_PHOTOS = [
  samplePhoto('MOMENTAI 01', '#4f46e5', '#ec4899'),
  samplePhoto('MOMENTAI 02', '#f97316', '#7c3aed'),
  samplePhoto('MOMENTAI 03', '#0f766e', '#38bdf8'),
  samplePhoto('MOMENTAI 04', '#be123c', '#f59e0b'),
  samplePhoto('MOMENTAI 05', '#4338ca', '#a855f7'),
  samplePhoto('MOMENTAI 06', '#0891b2', '#84cc16'),
  samplePhoto('MOMENTAI 07', '#ea580c', '#eab308'),
  samplePhoto('MOMENTAI 08', '#1d4ed8', '#9333ea'),
];
