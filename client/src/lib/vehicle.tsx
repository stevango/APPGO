import { getAssetIcon, isVehicleAsset } from "./assetIcons";

// Brand logos (served from a public CDN). Lowercase brand name → logo URL.
const BRAND_LOGOS: Record<string, string> = {
  toyota: "https://www.carlogos.org/car-logos/toyota-logo.png",
  honda: "https://www.carlogos.org/car-logos/honda-logo.png",
  ford: "https://www.carlogos.org/car-logos/ford-logo.png",
  chevrolet: "https://www.carlogos.org/car-logos/chevrolet-logo.png",
  volkswagen: "https://www.carlogos.org/car-logos/volkswagen-logo.png",
  fiat: "https://www.carlogos.org/car-logos/fiat-logo.png",
  hyundai: "https://www.carlogos.org/car-logos/hyundai-logo.png",
  jeep: "https://www.carlogos.org/car-logos/jeep-logo.png",
  bmw: "https://www.carlogos.org/car-logos/bmw-logo.png",
  mercedes: "https://www.carlogos.org/car-logos/mercedes-benz-logo.png",
  nissan: "https://www.carlogos.org/car-logos/nissan-logo.png",
  renault: "https://www.carlogos.org/car-logos/renault-logo.png",
  peugeot: "https://www.carlogos.org/car-logos/peugeot-logo.png",
  citroen: "https://www.carlogos.org/car-logos/citroen-logo.png",
  kia: "https://www.carlogos.org/car-logos/kia-logo.png",
  mitsubishi: "https://www.carlogos.org/car-logos/mitsubishi-logo.png",
  byd: "https://www.carlogos.org/car-logos/byd-logo.png",
  audi: "https://www.carlogos.org/car-logos/audi-logo.png",
  volvo: "https://www.carlogos.org/car-logos/volvo-logo.png",
  subaru: "https://www.carlogos.org/car-logos/subaru-logo.png",
  suzuki: "https://www.carlogos.org/car-logos/suzuki-logo.png",
  ram: "https://www.carlogos.org/car-logos/ram-logo.png",
  caoa: "https://www.carlogos.org/car-logos/chery-logo.png",
};

export function getBrandLogo(brand: string | null | undefined): string | null {
  if (!brand) return null;
  return BRAND_LOGOS[brand.toLowerCase().trim()] || null;
}

/** ABC1D23 / ABC1234 → "ABC-1D23" (display with a dash, padrão brasileiro). */
export function formatPlate(plate: string): string {
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return clean;
}

/**
 * Visual mark for an asset:
 * - vehicles with a known brand → brand logo
 * - everything else (pets, instruments, gear…) → the asset-type icon
 */
export function BrandMark({
  brand,
  iconType,
  className = "",
}: {
  brand?: string | null;
  iconType?: string | null;
  className?: string;
}) {
  const logo = getBrandLogo(brand);
  const AssetIcon = getAssetIcon(iconType);
  const useLogo = logo && isVehicleAsset(iconType);

  if (!useLogo) {
    return (
      <div className={`bg-[#243FF7]/8 rounded-2xl flex items-center justify-center ${className}`}>
        <AssetIcon className="w-1/2 h-1/2 text-[#243FF7]" />
      </div>
    );
  }
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <img
        src={logo}
        alt={brand || "Veículo"}
        className="w-3/4 h-3/4 object-contain"
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = "none";
          img.nextElementSibling?.classList.remove("hidden");
        }}
      />
      <div className="hidden absolute inset-0 bg-[#243FF7]/8 rounded-2xl flex items-center justify-center">
        <AssetIcon className="w-1/2 h-1/2 text-[#243FF7]" />
      </div>
    </div>
  );
}

/** Identifier tag for non-vehicle assets (pets, gear, instruments). */
export function AssetTag({ label, size = "md" }: { label: string; size?: "sm" | "md" }) {
  const text = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";
  return (
    <span className={`inline-flex items-center rounded-lg bg-gray-100 border border-gray-200 font-mono font-bold tracking-wide text-gray-700 ${text}`}>
      {label.toUpperCase()}
    </span>
  );
}

/** Realistic Brazilian Mercosul license plate. */
export function LicensePlate({ plate, size = "md" }: { plate: string; size?: "sm" | "md" | "lg" }) {
  const text = formatPlate(plate);
  const dims = {
    sm: { bar: "h-3 text-[5px]", body: "text-base px-2 py-0.5", radius: "rounded" },
    md: { bar: "h-3.5 text-[6px]", body: "text-xl px-2.5 py-0.5", radius: "rounded-md" },
    lg: { bar: "h-4 text-[7px]", body: "text-2xl px-3 py-1", radius: "rounded-lg" },
  }[size];

  return (
    <div className={`inline-flex flex-col overflow-hidden border-2 border-gray-800 bg-white shadow-sm shrink-0 ${dims.radius}`}>
      {/* Mercosul top bar */}
      <div className={`bg-[#0b3bd1] flex items-center justify-between px-1.5 ${dims.bar}`}>
        <span className="font-bold text-white leading-none">BR</span>
        <span className="font-semibold text-white tracking-[0.2em] leading-none">BRASIL</span>
        <span className="text-[#E2FF04] leading-none">★</span>
      </div>
      {/* Plate number */}
      <div className={`text-center whitespace-nowrap ${dims.body}`}>
        <span className="font-mono font-extrabold text-gray-900 tracking-[0.12em] leading-none whitespace-nowrap">{text}</span>
      </div>
    </div>
  );
}
