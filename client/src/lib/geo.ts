/** Distância em metros entre dois pontos (Haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // raio da Terra em metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Formata distância amigável: "320 m", "1,2 km", "15 km". */
export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km`;
}
