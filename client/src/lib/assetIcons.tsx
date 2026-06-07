import {
  Car, Bike, Truck, Caravan, Bus, Tractor, Sailboat, Plane, TrainFront, Forklift,
  Dog, Cat, Bird, Fish, Rabbit, Beef, PawPrint,
  Guitar, Piano, Drum, Mic, Music, Package, Boxes, Container, Smartphone, Laptop, Anchor,
  type LucideIcon,
} from "lucide-react";

export type AssetIconKey =
  | "car" | "moto" | "caminhao" | "van" | "onibus" | "trator" | "barco" | "aviao" | "trem" | "empilhadeira"
  | "dog" | "cat" | "passaro" | "peixe" | "coelho" | "boi" | "pet"
  | "guitarra" | "piano" | "bateria" | "microfone" | "instrumento"
  | "equipamento" | "carga" | "container" | "celular" | "notebook" | "outro";

type AssetIconDef = { key: AssetIconKey; label: string; Icon: LucideIcon; group: string };

export const ASSET_ICONS: AssetIconDef[] = [
  // Veículos
  { key: "car", label: "Carro", Icon: Car, group: "Veículos" },
  { key: "moto", label: "Moto", Icon: Bike, group: "Veículos" },
  { key: "caminhao", label: "Caminhão", Icon: Truck, group: "Veículos" },
  { key: "van", label: "Van", Icon: Caravan, group: "Veículos" },
  { key: "onibus", label: "Ônibus", Icon: Bus, group: "Veículos" },
  { key: "trator", label: "Trator", Icon: Tractor, group: "Veículos" },
  { key: "barco", label: "Barco", Icon: Sailboat, group: "Veículos" },
  { key: "aviao", label: "Avião", Icon: Plane, group: "Veículos" },
  { key: "trem", label: "Trem", Icon: TrainFront, group: "Veículos" },
  { key: "empilhadeira", label: "Empilhadeira", Icon: Forklift, group: "Veículos" },
  // Animais / Pets
  { key: "dog", label: "Cachorro", Icon: Dog, group: "Animais" },
  { key: "cat", label: "Gato", Icon: Cat, group: "Animais" },
  { key: "passaro", label: "Pássaro", Icon: Bird, group: "Animais" },
  { key: "peixe", label: "Peixe", Icon: Fish, group: "Animais" },
  { key: "coelho", label: "Coelho", Icon: Rabbit, group: "Animais" },
  { key: "boi", label: "Boi/Gado", Icon: Beef, group: "Animais" },
  { key: "pet", label: "Outro pet", Icon: PawPrint, group: "Animais" },
  // Bens / Outros
  { key: "guitarra", label: "Guitarra", Icon: Guitar, group: "Bens" },
  { key: "piano", label: "Piano", Icon: Piano, group: "Bens" },
  { key: "bateria", label: "Bateria", Icon: Drum, group: "Bens" },
  { key: "microfone", label: "Microfone", Icon: Mic, group: "Bens" },
  { key: "instrumento", label: "Instrumento", Icon: Music, group: "Bens" },
  { key: "equipamento", label: "Equipamento", Icon: Package, group: "Bens" },
  { key: "carga", label: "Carga", Icon: Boxes, group: "Bens" },
  { key: "container", label: "Contêiner", Icon: Container, group: "Bens" },
  { key: "celular", label: "Celular", Icon: Smartphone, group: "Bens" },
  { key: "notebook", label: "Notebook", Icon: Laptop, group: "Bens" },
  { key: "outro", label: "Outro", Icon: Anchor, group: "Bens" },
];

const BY_KEY = new Map(ASSET_ICONS.map((d) => [d.key, d]));
const VEHICLE_KEYS = new Set(ASSET_ICONS.filter((d) => d.group === "Veículos").map((d) => d.key));

export function getAssetIcon(key: string | null | undefined): LucideIcon {
  return (key && BY_KEY.get(key as AssetIconKey)?.Icon) || Car;
}

export function getAssetLabel(key: string | null | undefined): string {
  return (key && BY_KEY.get(key as AssetIconKey)?.label) || "Carro";
}

/** True when the asset is a vehicle (so a brand logo makes sense). */
export function isVehicleAsset(key: string | null | undefined): boolean {
  if (!key) return true; // default = car
  return VEHICLE_KEYS.has(key as AssetIconKey);
}

export const ASSET_GROUPS = ["Veículos", "Animais", "Bens"] as const;
