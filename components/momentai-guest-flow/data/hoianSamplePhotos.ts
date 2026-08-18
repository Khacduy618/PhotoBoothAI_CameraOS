const samplePhoto = (start: string, end: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${start}"/><stop offset="100%" stop-color="${end}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="400" cy="360" r="140" fill="rgba(26,26,26,0.12)"/><ellipse cx="400" cy="740" rx="260" ry="200" fill="rgba(26,26,26,0.1)"/></svg>`)}`;

export const HOI_AN_SAMPLE_PHOTOS = [
  samplePhoto('#F5F3EF', '#EBE7E0'),
  samplePhoto('#EBE8E1', '#DFDAD1'),
  samplePhoto('#F8F6F0', '#EAE6DD'),
  samplePhoto('#ECE8E1', '#DDD8CE'),
  samplePhoto('#F2EFE9', '#E4DFC3'),
  samplePhoto('#EBE7DF', '#D9D3C7'),
  samplePhoto('#F4F1EA', '#E6E1D6'),
  samplePhoto('#EDE8DF', '#DDD7CB'),
];
