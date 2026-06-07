import { useState } from "react";
import { Navigation, LocateFixed, Loader2 } from "lucide-react";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { useDeviceCoords, requestDeviceLocation } from "@/lib/deviceLocation";

/**
 * Mostra a distância entre o celular do usuário e o equipamento (carro, pet…),
 * usando o GPS do dispositivo + a última posição do rastreador. Pede permissão
 * sob demanda. Com a posição, mostra também "Como chegar".
 */
export default function DistanceToVehicle({
  vehicle,
  stale,
  className = "",
}: {
  vehicle: { lastLatitude?: any; lastLongitude?: any; brand?: string | null; model?: string | null };
  stale?: boolean;
  className?: string;
}) {
  const coords = useDeviceCoords();
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  const vlat = vehicle.lastLatitude != null ? parseFloat(String(vehicle.lastLatitude)) : NaN;
  const vlng = vehicle.lastLongitude != null ? parseFloat(String(vehicle.lastLongitude)) : NaN;
  if (!Number.isFinite(vlat) || !Number.isFinite(vlng)) return null;

  const ask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const c = await requestDeviceLocation();
    setLoading(false);
    if (!c) setDenied(true);
  };

  if (!coords) {
    return (
      <span
        onClick={ask}
        className={`mt-3 w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#243FF7] bg-[#243FF7]/[0.06] rounded-xl py-2.5 go-btn-active ${className}`}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
        {denied ? "Ative a localização para ver a distância" : "Ver minha distância até ele"}
      </span>
    );
  }

  const dist = distanceMeters(coords.lat, coords.lng, vlat, vlng);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${vlat},${vlng}&travelmode=driving`;

  return (
    <div className={`mt-3 flex items-center gap-2 ${className}`}>
      <div className="flex-1 flex items-center gap-2 bg-[#243FF7]/[0.06] rounded-xl px-3 py-2.5">
        <LocateFixed className="w-4 h-4 text-[#243FF7] shrink-0" />
        <span className="text-[12px] text-[#111111]">
          <b>{formatDistance(dist)}</b> de você{stale ? " (última posição)" : ""}
        </span>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 text-[12px] font-bold text-white bg-[#243FF7] rounded-xl px-3 py-2.5 go-btn-active"
      >
        <Navigation className="w-3.5 h-3.5" /> Como chegar
      </a>
    </div>
  );
}
