export interface ApplicationBusinessInformation {
  openingTime: string; closingTime: string; serviceRadiusKm: number; acceptsOrders: boolean;
  logoUrl?: string; shopPhotos: string[];
}

const text = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const mediaUrl = (value: unknown) => {
  const url = text(value, 2048);
  if (!url) return '';
  if (/^\/uploads\/[a-zA-Z0-9_./-]+$/.test(url) && !url.includes('..')) return url;
  try { const parsed = new URL(url); if (['http:', 'https:'].includes(parsed.protocol)) return url; } catch { /* Invalid media URL. */ }
  throw new Error('Invalid business image address.');
};

export function parseApplicationBusinessDetails(body: any) {
  const info = body.businessInformation;
  if (!info || typeof info !== 'object' || Array.isArray(info)) throw new Error('Business operations details are required.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(info.openingTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(info.closingTime || '')) throw new Error('Enter valid opening and closing times.');
  const radius = Number(info.serviceRadiusKm);
  if (!Number.isFinite(radius) || radius <= 0 || radius > 1000) throw new Error('Enter a service radius greater than zero and no more than 1000 km.');
  if (typeof info.acceptsOrders !== 'boolean') throw new Error('Choose whether the business accepts orders.');
  if (!Array.isArray(info.shopPhotos) || info.shopPhotos.length > 6) throw new Error('Add no more than six shop photos.');
  let location: { type: 'Point'; coordinates: number[] } | undefined;
  // Older application forms used location as an address string, not a map point.
  if (body.location !== undefined && body.location !== null && typeof body.location !== 'string') {
    const coordinates = body.location.coordinates;
    if (body.location.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2 || coordinates.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value)) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) throw new Error('Enter valid map coordinates.');
    location = { type: 'Point', coordinates: [...coordinates] };
  }
  const businessInformation: ApplicationBusinessInformation = { openingTime: info.openingTime, closingTime: info.closingTime,
    serviceRadiusKm: radius, acceptsOrders: info.acceptsOrders, logoUrl: mediaUrl(info.logoUrl), shopPhotos: info.shopPhotos.map(mediaUrl).filter(Boolean) };
  return { businessInformation, ...(location ? { location } : {}), fssaiNumber: text(body.fssaiNumber, 100) };
}
