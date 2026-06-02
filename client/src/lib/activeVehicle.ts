import { useSyncExternalStore } from "react";

/**
 * Globally selected asset ("equipamento ativo"), shared across Home, Tracking
 * and the selector. Persisted in localStorage and reactive via an external
 * store so every screen updates when the selection changes.
 */
const KEY = "go-active-vehicle";
const listeners = new Set<() => void>();

export function getActiveVehicleId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  return raw ? Number(raw) : null;
}

export function setActiveVehicleId(id: number | null): void {
  if (id == null) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, String(id));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useActiveVehicleId(): number | null {
  return useSyncExternalStore(subscribe, getActiveVehicleId, () => null);
}

/** Pick the active asset from a list, falling back to the first one. */
export function pickActiveVehicle<T extends { id: number }>(
  vehicles: T[] | undefined,
  activeId: number | null,
): T | undefined {
  if (!vehicles || vehicles.length === 0) return undefined;
  return vehicles.find((v) => v.id === activeId) ?? vehicles[0];
}
