import { useSyncExternalStore } from "react";

/**
 * Localização do dispositivo (GPS do celular), compartilhada entre telas.
 * Pedimos sob demanda (precisa de permissão). Guardada em memória + reativa.
 */
export type DeviceCoords = { lat: number; lng: number; accuracy?: number; at: number } | null;

let coords: DeviceCoords = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getDeviceCoords(): DeviceCoords {
  return coords;
}

export function useDeviceCoords(): DeviceCoords {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getDeviceCoords,
    () => null,
  );
}

/** Pede a localização do celular (uma vez). Retorna null se negada/indisponível. */
export function requestDeviceLocation(): Promise<DeviceCoords> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        coords = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
        emit();
        resolve(coords);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}
