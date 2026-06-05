import * as db from "../db";
import { processTelemetry, type TelemetryData } from "../telemetry";

/**
 * GO360 integration (pull model): our backend periodically calls the GO360 API,
 * fetches device positions/telemetry, matches each device to a vehicle by its
 * tracker serial (IMEI) and feeds it into the shared telemetry pipeline.
 *
 * Everything is env-configurable so we can adapt to the exact GO360 endpoints
 * without code changes:
 *   GO360_BASE_URL        e.g. https://go360id-production.up.railway.app
 *   GO360_TOKEN           bearer token / api key
 *   GO360_AUTH_HEADER     default "Authorization"
 *   GO360_AUTH_SCHEME     default "Bearer " (use "" for raw key, or "Token ")
 *   GO360_POSITIONS_PATH  default "/api/positions"
 *   GO360_SPEED_UNIT      "knots" | "kmh" (default "kmh")
 */
const CFG = () => ({
  baseUrl: (process.env.GO360_BASE_URL ?? "").replace(/\/+$/, ""),
  token: process.env.GO360_TOKEN ?? "",
  authHeader: process.env.GO360_AUTH_HEADER ?? "Authorization",
  authScheme: process.env.GO360_AUTH_SCHEME ?? "Bearer ",
  positionsPath: process.env.GO360_POSITIONS_PATH ?? "/api/positions",
  speedUnit: process.env.GO360_SPEED_UNIT ?? "kmh",
});

export function go360Configured(): boolean {
  const c = CFG();
  return Boolean(c.baseUrl && c.token);
}

async function go360Get(path: string): Promise<any> {
  const c = CFG();
  if (!c.baseUrl || !c.token) throw new Error("GO360 not configured (GO360_BASE_URL / GO360_TOKEN)");
  const url = path.startsWith("http") ? path : `${c.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    headers: { [c.authHeader]: `${c.authScheme}${c.token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GO360 ${path} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Normalizes the many shapes a positions response can have into a flat array. */
function asArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.positions)) return payload.positions;
  if (Array.isArray(payload?.devices)) return payload.devices;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) {
    const v = k.split(".").reduce((acc: any, part) => (acc == null ? acc : acc[part]), o);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

/** Maps one GO360 position record into our TelemetryData (+ device serial). */
export function mapGo360Position(raw: any): { serial?: string; data: TelemetryData } {
  const num = (v: any) => (v === undefined || v === null || v === "" ? undefined : Number(v));
  const str = (v: any) => (v === undefined || v === null ? undefined : String(v));
  const bool = (v: any) =>
    typeof v === "boolean" ? v : v == null ? undefined : ["1", "true", "on", "ligada", "yes"].includes(String(v).toLowerCase());

  const serial = str(pick(raw, "trackerSerial", "serial", "imei", "uniqueId", "deviceId", "device_id", "device.imei", "device.uniqueId"));

  let speed = num(pick(raw, "speed", "velocidade", "attributes.speed"));
  if (speed !== undefined && CFG().speedUnit === "knots") speed = Math.round(speed * 1.852);

  const data: TelemetryData = {
    latitude: str(pick(raw, "latitude", "lat")),
    longitude: str(pick(raw, "longitude", "lng", "lon")),
    address: str(pick(raw, "address", "endereco")),
    speed,
    heading: num(pick(raw, "heading", "course", "direction", "curso")),
    odometer: str(pick(raw, "odometer", "attributes.odometer", "odometro")),
    hourmeter: str(pick(raw, "hourmeter", "attributes.hours", "horimetro")),
    batteryMain: str(pick(raw, "batteryMain", "battery_main", "voltage", "power", "attributes.power", "attributes.batteryMain")),
    batteryBackup: str(pick(raw, "batteryBackup", "battery_backup", "attributes.battery")),
    ignition: bool(pick(raw, "ignition", "ignicao", "attributes.ignition")),
    gpsSatellites: num(pick(raw, "gpsSatellites", "satellites", "sat", "attributes.sat")),
    gpsSignal: num(pick(raw, "gpsSignal")),
    simSignal: num(pick(raw, "simSignal", "attributes.rssi")),
    trackerModel: str(pick(raw, "trackerModel", "model", "device.model")),
    trackerSerial: serial,
  };
  return { serial, data };
}

/**
 * Pulls current positions from GO360 and applies them to matching vehicles.
 * Returns counts; `sample` (raw first record) is exposed for discovery/debug.
 */
export async function syncGo360(opts: { debug?: boolean } = {}): Promise<{
  ok: boolean; synced: number; skipped: number; total: number; sample?: any; error?: string;
}> {
  if (!go360Configured()) return { ok: false, synced: 0, skipped: 0, total: 0, error: "GO360 not configured" };

  const payload = await go360Get(CFG().positionsPath);
  const list = asArray(payload);
  let synced = 0;
  let skipped = 0;

  for (const raw of list) {
    const { serial, data } = mapGo360Position(raw);
    if (!serial) { skipped++; continue; }
    const vehicle = await db.getVehicleBySerial(serial);
    if (!vehicle) { skipped++; continue; }
    await processTelemetry(vehicle.userId, vehicle.id, data);
    synced++;
  }

  return { ok: true, synced, skipped, total: list.length, sample: opts.debug ? list[0] ?? null : undefined };
}
