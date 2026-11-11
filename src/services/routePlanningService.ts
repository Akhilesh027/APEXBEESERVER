export type MapPoint = { latitude: number; longitude: number };
export type RouteCandidate = { id: string; address: string; point?: MapPoint | null };

export function mapPoint(value: any): MapPoint | null {
  const coordinates = value?.coordinates || value?.location?.coordinates;
  const latitude = Array.isArray(coordinates) ? coordinates[1] : value?.latitude ?? value?.lat;
  const longitude = Array.isArray(coordinates) ? coordinates[0] : value?.longitude ?? value?.lng ?? value?.lon;
  if (latitude === '' || longitude === '' || latitude == null || longitude == null) return null;
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { latitude: lat, longitude: lng } : null;
}

export function distanceKm(a: MapPoint, b: MapPoint) {
  const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function arrangeDeliveryStops(origin: MapPoint | null, candidates: RouteCandidate[]) {
  if (!candidates.length || candidates.length > 100 || new Set(candidates.map(stop => stop.id)).size !== candidates.length) throw new Error('Choose between 1 and 100 different route stops.');
  const located = candidates.filter(stop => mapPoint(stop.point));
  const missing = candidates.filter(stop => !mapPoint(stop.point)).sort((a, b) => {
    const area = (address: string) => address.toLowerCase().split(',').map(part => part.trim()).reverse().join(',');
    return area(a.address).localeCompare(area(b.address)) || a.id.localeCompare(b.id);
  });
  if (!located.length) return { subscriptionIds: missing.map(stop => stop.id), method: 'area' as const, estimatedKm: null, locatedStops: 0, missingCoordinates: missing.map(stop => stop.id), message: 'Stops grouped by their recorded delivery areas. GPS coordinates are missing, so distance optimisation is unavailable.' };
  const points = located.map(stop => mapPoint(stop.point)!);
  const distances = points.map(point => points.map(other => distanceKm(point, other)));
  const originDistances = points.map(point => origin ? distanceKm(origin, point) : 0);
  const cost = (order: number[]) => order.reduce((sum, current, index) => sum + (index ? distances[order[index - 1]][current] : originDistances[current]), 0);
  const remaining = new Set(points.map((_, index) => index)); const ordered: number[] = [];
  while (remaining.size) {
    const next = [...remaining].sort((a, b) => (ordered.length ? distances[ordered[ordered.length - 1]][a] - distances[ordered[ordered.length - 1]][b] : originDistances[a] - originDistances[b]) || located[a].id.localeCompare(located[b].id))[0];
    ordered.push(next); remaining.delete(next);
  }
  let best = cost(ordered);
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (let left = origin ? 0 : 1; left < ordered.length - 1; left++) for (let right = left + 1; right < ordered.length; right++) {
      const candidate = [...ordered.slice(0, left), ...ordered.slice(left, right + 1).reverse(), ...ordered.slice(right + 1)];
      const distance = cost(candidate);
      if (distance + 0.000001 < best) { ordered.splice(0, ordered.length, ...candidate); best = distance; improved = true; }
    }
    if (!improved) break;
  }
  // Retain the original GPS sequence when the heuristic would make it longer.
  const original = points.map((_, index) => index);
  if (cost(original) < best) { ordered.splice(0, ordered.length, ...original); best = cost(original); }
  return { subscriptionIds: [...ordered.map(index => located[index].id), ...missing.map(stop => stop.id)], method: 'gps' as const,
    estimatedKm: origin && !missing.length ? Math.round(best * 100) / 100 : null, locatedStops: located.length, missingCoordinates: missing.map(stop => stop.id),
    message: `${located.length} stops arranged by saved GPS positions${origin ? ' from the store' : ''}.${missing.length ? ` ${missing.length} stops without GPS are grouped by area at the end.` : ''} Distances are straight-line estimates; road conditions and traffic are not included.` };
}
