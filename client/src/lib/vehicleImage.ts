/**
 * Render do veículo (estilo apps de montadora, ex.: BYD). Fontes, em ordem:
 *  1) vehicle.imageUrl — imagem específica (ex.: enviada pela GO360 ou cadastrada)
 *  2) CDN imagin.studio por marca/modelo — só quando VITE_CAR_IMAGE_KEY existe
 *  3) null → o card usa o fallback (logo da marca / ícone do tipo), sem quebrar
 *
 * Mantém custo zero por padrão: sem a chave do CDN, cai no fallback.
 */
type VehicleLike = {
  imageUrl?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  iconType?: string | null;
};

const CAR_ICON_TYPES = ["car", "sedan", "suv", "hatch", "pickup", "truck", "van"];

export function getVehicleImageUrl(vehicle: VehicleLike): string | null {
  if (vehicle?.imageUrl) return vehicle.imageUrl;

  const key = import.meta.env.VITE_CAR_IMAGE_KEY as string | undefined;
  const iconType = String(vehicle?.iconType || "car").toLowerCase();
  const isCar = !vehicle?.iconType || CAR_ICON_TYPES.includes(iconType);

  if (key && isCar && vehicle?.brand) {
    const make = String(vehicle.brand).trim().toLowerCase().split(/\s+/)[0];
    const modelFamily = String(vehicle.model || "").trim().toLowerCase().split(/\s+/)[0];
    const params = new URLSearchParams({ customer: key, make, angle: "23", fileType: "png" });
    if (modelFamily) params.set("modelFamily", modelFamily);
    if (vehicle.year) params.set("modelYear", String(vehicle.year));
    return `https://cdn.imagin.studio/getImage?${params.toString()}`;
  }
  return null;
}
