import * as db from "./db";
import { sendPushToUser } from "./pushService";

// Haversine distance in km
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type TelemetryData = {
  latitude?: string;
  longitude?: string;
  address?: string;
  speed?: number;
  heading?: number;
  odometer?: string;
  hourmeter?: string;
  batteryMain?: string;
  batteryBackup?: string;
  ignition?: boolean;
  gpsSatellites?: number;
  gpsSignal?: number;
  trackerMode?: "active" | "sleep" | "deep_sleep" | "emergency";
  simStatus?: "active" | "inactive" | "no_signal";
  simSignal?: number;
  trackerModel?: string;
  trackerSerial?: string;
};

/**
 * Applies a telemetry update to a vehicle and fires the derived alerts (battery,
 * geofence enter/exit, speeding) with deduplication + push. Shared by the tRPC
 * procedure (app) and the external ingestion endpoint (real tracker hardware).
 */
export async function processTelemetry(userId: number, vehicleId: number, data: TelemetryData) {
  await db.updateVehicleTelemetry(vehicleId, data);

  // Record route point if position is included
  if (data.latitude && data.longitude) {
    await db.addRoutePoint({
      vehicleId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      heading: data.heading,
      address: data.address,
    });
  }

  // Battery alert (1h cooldown)
  if (data.batteryMain) {
    const voltage = parseFloat(data.batteryMain);
    if (voltage > 0 && voltage < 11.0) {
      const recentAlert = await db.getRecentBatteryNotification(userId, vehicleId);
      if (!recentAlert) {
        const isCritical = voltage < 10.5;
        const batteryTitle = isCritical ? "Bateria Crítica!" : "Bateria Baixa";
        const batteryMsg = isCritical
          ? `A bateria principal está em ${voltage.toFixed(1)}V. Verifique o veículo imediatamente.`
          : `A bateria principal está em ${voltage.toFixed(1)}V. Recomendamos verificação.`;
        await db.createNotification({ userId, vehicleId, type: "bateria_baixa", title: batteryTitle, message: batteryMsg });
        sendPushToUser(userId, { title: `🔋 ${batteryTitle}`, body: batteryMsg, tag: `battery-${vehicleId}`, data: { url: "/" } }).catch(() => {});
      }
    }
  }

  // Geofence enter/exit (30min cooldown per fence)
  if (data.latitude && data.longitude) {
    const geofences = await db.getUserGeofences(userId);
    for (const fence of geofences) {
      if (fence.vehicleId !== vehicleId) continue;
      const dist = getDistanceKm(
        parseFloat(data.latitude), parseFloat(data.longitude),
        parseFloat(fence.latitude), parseFloat(fence.longitude),
      );
      const isInside = dist * 1000 <= (fence.radius || 200);
      if (!isInside && fence.alertOnExit) {
        const recent = await db.getRecentGeofenceNotification(userId, vehicleId, fence.id, "saida");
        if (!recent) {
          const msg = `Veículo saiu da cerca "${fence.name}" (distância: ${(dist * 1000).toFixed(0)}m do centro).`;
          await db.createNotification({ userId, vehicleId, type: "cerca_saida", title: "Cerca Eletrônica - Saída", message: msg });
          sendPushToUser(userId, { title: "📍 Cerca Eletrônica", body: msg, tag: `geofence-${fence.id}-${vehicleId}`, data: { url: "/geofences" } }).catch(() => {});
          break;
        }
      }
      if (isInside && fence.alertOnEntry) {
        const recent = await db.getRecentGeofenceNotification(userId, vehicleId, fence.id, "entrada");
        if (!recent) {
          const msg = `Veículo entrou na cerca "${fence.name}".`;
          await db.createNotification({ userId, vehicleId, type: "cerca_entrada", title: "Cerca Eletrônica - Entrada", message: msg });
          sendPushToUser(userId, { title: "📍 Cerca Eletrônica", body: msg, tag: `geofence-entry-${fence.id}-${vehicleId}`, data: { url: "/geofences" } }).catch(() => {});
          break;
        }
      }
    }
  }

  // Speeding alert (5min cooldown)
  if (data.speed && data.speed > 0) {
    const vehicle = await db.getVehicleById(vehicleId);
    const speedLimit = vehicle?.speedLimit || 120;
    if (data.speed > speedLimit) {
      const recent = await db.getRecentSpeedNotification(userId, vehicleId);
      if (!recent) {
        const msg = `Veículo a ${data.speed} km/h. Limite configurado: ${speedLimit} km/h.`;
        await db.createNotification({ userId, vehicleId, type: "velocidade_excessiva", title: "Velocidade Excessiva!", message: msg });
        sendPushToUser(userId, { title: "⚡ Velocidade Excessiva!", body: msg, tag: `speed-${vehicleId}`, data: { url: "/" } }).catch(() => {});
      }
    }
  }
}

const TRACKER_MODES = ["active", "sleep", "deep_sleep", "emergency"];
const SIM_STATUSES = ["active", "inactive", "no_signal"];

/**
 * Ingest a telemetry payload from an external tracker/platform. Resolves the
 * vehicle by its tracker serial (IMEI), maps common field names, and applies it.
 */
export async function ingestTelemetry(body: Record<string, any>): Promise<{ ok: boolean; vehicleId?: number; error?: string }> {
  const serial = body.trackerSerial ?? body.serial ?? body.imei ?? body.device_id ?? body.deviceId;
  if (!serial) return { ok: false, error: "trackerSerial/serial/imei é obrigatório" };

  const vehicle = await db.getVehicleBySerial(String(serial));
  if (!vehicle) return { ok: false, error: "dispositivo não cadastrado" };

  // Evento de comportamento (frenagem/aceleração/excesso) → alimenta o Score.
  const eventType = body.event ?? body.evento ?? body.eventType;
  if (eventType) {
    const sevRaw = String(body.severity ?? body.severidade ?? "media").toLowerCase();
    const severity = (["leve", "media", "alta"].includes(sevRaw) ? sevRaw : "media") as "leve" | "media" | "alta";
    const at = body.eventAt ?? body.event_at ?? body.eventoEm;
    await db.insertDrivingEvent({
      vehicleId: vehicle.id,
      type: String(eventType),
      severity,
      latitude: body.latitude != null ? String(body.latitude ?? body.lat) : null,
      longitude: body.longitude != null ? String(body.longitude ?? body.lng) : null,
      speed: body.speed != null ? Number(body.speed) : null,
      eventAt: at ? new Date(String(at)) : new Date(),
    });
    return { ok: true, vehicleId: vehicle.id };
  }

  const num = (v: any) => (v === undefined || v === null || v === "" ? undefined : Number(v));
  const str = (v: any) => (v === undefined || v === null ? undefined : String(v));
  const bool = (v: any) =>
    typeof v === "boolean" ? v : v == null ? undefined : ["1", "true", "on", "ligada", "yes"].includes(String(v).toLowerCase());

  const data: TelemetryData = {
    latitude: str(body.latitude ?? body.lat),
    longitude: str(body.longitude ?? body.lng ?? body.lon),
    address: str(body.address),
    speed: num(body.speed),
    heading: num(body.heading ?? body.course),
    odometer: str(body.odometer),
    hourmeter: str(body.hourmeter),
    batteryMain: str(body.batteryMain ?? body.battery_main ?? body.voltage),
    batteryBackup: str(body.batteryBackup ?? body.battery_backup),
    ignition: bool(body.ignition),
    gpsSatellites: num(body.gpsSatellites ?? body.satellites),
    gpsSignal: num(body.gpsSignal),
    trackerMode: TRACKER_MODES.includes(body.trackerMode) ? body.trackerMode : undefined,
    simStatus: SIM_STATUSES.includes(body.simStatus) ? body.simStatus : undefined,
    simSignal: num(body.simSignal),
    trackerModel: str(body.trackerModel),
    trackerSerial: String(serial),
  };

  await processTelemetry(vehicle.userId, vehicle.id, data);
  return { ok: true, vehicleId: vehicle.id };
}
