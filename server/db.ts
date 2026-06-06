import { eq, desc, and, gte, lte, lt, sql, inArray, isNotNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, vehicles, geofences, notifications, occurrences, blockLogs, sosAlerts, routeHistory, trips, shareLinks, emergencyContacts, pushSubscriptions } from "../drizzle/schema";
import type { InsertTrip, InsertShareLink, InsertEmergencyContact, EmergencyContact } from "../drizzle/schema";
import type { InsertVehicle, InsertGeofence, InsertOccurrence, InsertNotification } from "../drizzle/schema";
import { ENV } from './_core/env';
import { encryptSecret } from "./crypto";
import { randomUUID } from "crypto";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

/** Token estável p/ o widget nativo ler o resumo sem sessão. Cria se faltar. */
export async function getOrCreateWidgetToken(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const u = (await db.select({ t: users.widgetToken }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (u?.t) return u.t;
  const token = randomUUID().replace(/-/g, "");
  await db.update(users).set({ widgetToken: token }).where(eq(users.id, userId));
  return token;
}

export async function getUserByWidgetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.widgetToken, token)).limit(1);
  return r[0];
}

export async function createUserWithPassword(input: {
  openId: string;
  name: string | null;
  email: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalizedEmail = input.email.trim().toLowerCase();
  const now = new Date();
  await db.insert(users).values({
    openId: input.openId,
    name: input.name,
    email: normalizedEmail,
    passwordHash: input.passwordHash,
    loginMethod: "email",
    lastSignedIn: now,
    role: input.openId === ENV.ownerOpenId ? "admin" : "user",
  });
  return getUserByOpenId(input.openId);
}

export async function setUserPassword(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.openId, openId));
}

/** Create/update a local user mirrored from a GO360 customer, return the row. */
export async function upsertGo360User(input: { clienteId: string; name?: string | null; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `go360_${input.clienteId}`;
  const email = input.email ? input.email.trim().toLowerCase() : null;
  await db.insert(users).values({
    openId,
    name: input.name ?? null,
    email,
    loginMethod: "go360",
    go360ClienteId: input.clienteId,
    lastSignedIn: new Date(),
  }).onDuplicateKeyUpdate({
    set: { name: input.name ?? null, email, go360ClienteId: input.clienteId, lastSignedIn: new Date() },
  });
  return getUserByOpenId(openId);
}

export async function setUserGo360Token(userId: number, token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ go360Token: encryptSecret(token) }).where(eq(users.id, userId));
}

/** Upsert a vehicle synced from GO360 (matched by user + plate). */
export async function upsertGo360Vehicle(userId: number, data: {
  plate: string; brand?: string | null; model: string; color?: string | null; year?: number | null;
  chassi?: string | null; renavam?: string | null; anoFabricacao?: number | null; anoModelo?: number | null;
  fuel?: string | null; cityState?: string | null;
  trackerSerial?: string | null; trackerModel?: string | null; trackerStatus?: "online" | "offline" | "alert";
  go360AtivoId?: string | null; imageUrl?: string | null; fichaUrl?: string | null; fichaData?: unknown;
  latitude?: string | null; longitude?: string | null; lastAddress?: string | null; speed?: number | null; ignition?: boolean | null;
  lastSignalAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(vehicles)
    .where(and(eq(vehicles.userId, userId), eq(vehicles.plate, data.plate))).limit(1);
  const fields: Record<string, unknown> = {
    brand: data.brand ?? null,
    model: data.model || "Veículo",
    color: data.color ?? null,
    year: data.year ?? null,
    chassi: data.chassi ?? null,
    renavam: data.renavam ?? null,
    anoFabricacao: data.anoFabricacao ?? null,
    anoModelo: data.anoModelo ?? null,
    fuel: data.fuel ?? null,
    cityState: data.cityState ?? null,
    trackerSerial: data.trackerSerial ?? null,
    trackerModel: data.trackerModel ?? null,
    trackerStatus: data.trackerStatus ?? "online",
    go360AtivoId: data.go360AtivoId ?? null,
    isDemo: false,
  };
  // Só sobrescreve a imagem quando a GO360 manda uma (não apaga a existente).
  if (data.imageUrl) fields.imageUrl = data.imageUrl;
  if (data.fichaUrl) fields.fichaUrl = data.fichaUrl;
  if (data.fichaData) fields.fichaData = data.fichaData;
  // Only set position when GO360 actually provided it (don't wipe GPS from ingestion).
  if (data.latitude && data.longitude) {
    fields.lastLatitude = data.latitude;
    fields.lastLongitude = data.longitude;
    fields.lastSignalAt = data.lastSignalAt ?? new Date();
    if (data.lastAddress != null) fields.lastAddress = data.lastAddress;
    if (data.speed != null) fields.speed = data.speed;
    if (data.ignition != null) fields.ignition = data.ignition;
  }
  if (existing[0]) {
    await db.update(vehicles).set(fields).where(eq(vehicles.id, existing[0].id));
  } else {
    await db.insert(vehicles).values({ userId, plate: data.plate, iconType: "car", ...fields } as any);
  }
}

/** Atualiza campos editáveis do veículo localmente (após gravar no GO360). */
export async function updateVehicleFields(vehicleId: number, fields: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return;
  await db.update(vehicles).set(clean as any).where(eq(vehicles.id, vehicleId));
}

export async function setUserAddress(userId: number, data: { address: string; lat?: string | null; lng?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    address: data.address,
    addressLat: data.lat ?? null,
    addressLng: data.lng ?? null,
  }).where(eq(users.id, userId));
}

/** Atualiza nome/e-mail do usuário localmente (após gravar no GO360). */
export async function updateUserProfile(userId: number, data: { name?: string; email?: string }) {
  const db = await getDb();
  if (!db) return;
  const fields: Record<string, unknown> = {};
  if (data.name !== undefined) fields.name = data.name;
  if (data.email !== undefined) fields.email = data.email.trim().toLowerCase();
  if (Object.keys(fields).length === 0) return;
  await db.update(users).set(fields).where(eq(users.id, userId));
}

/**
 * Permanently delete a user and all data linked to them (LGPD / app-store
 * "delete account" requirement). Removes vehicle-scoped data first, then
 * user-scoped data, then the user row itself.
 */
export async function deleteUserAccount(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.userId, userId));
  const vehicleIds = userVehicles.map(v => v.id);

  if (vehicleIds.length > 0) {
    await db.delete(routeHistory).where(inArray(routeHistory.vehicleId, vehicleIds));
    await db.delete(trips).where(inArray(trips.vehicleId, vehicleIds));
  }

  // Tables keyed directly by userId.
  await db.delete(shareLinks).where(eq(shareLinks.userId, userId));
  await db.delete(geofences).where(eq(geofences.userId, userId));
  await db.delete(occurrences).where(eq(occurrences.userId, userId));
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(blockLogs).where(eq(blockLogs.userId, userId));
  await db.delete(sosAlerts).where(eq(sosAlerts.userId, userId));
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  await db.delete(serviceAppointments).where(eq(serviceAppointments.userId, userId));
  await db.delete(vehicleOfflineReasons).where(eq(vehicleOfflineReasons.userId, userId));
  await db.delete(paymentMethods).where(eq(paymentMethods.userId, userId));
  await db.delete(paymentChangeHistory).where(eq(paymentChangeHistory.userId, userId));
  await db.delete(invoices).where(eq(invoices.userId, userId));
  await db.delete(emergencyContacts).where(eq(emergencyContacts.userId, userId));

  await db.delete(vehicles).where(eq(vehicles.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

// Vehicle helpers
export async function getUserVehicles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles).where(eq(vehicles.userId, userId));
}

export async function getUserDemoVehicle(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.userId, userId), eq(vehicles.isDemo, true)))
    .limit(1);
  return result[0];
}

export async function getUserDemoVehicles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles).where(and(eq(vehicles.userId, userId), eq(vehicles.isDemo, true)));
}

/** Remove all demo assets and the data attached to them (keeps the user account). */
export async function deleteDemoVehicleData(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const demos = await getUserDemoVehicles(userId);
  if (demos.length === 0) return;
  const ids = demos.map(v => v.id);
  await db.delete(routeHistory).where(inArray(routeHistory.vehicleId, ids));
  await db.delete(trips).where(inArray(trips.vehicleId, ids));
  await db.delete(geofences).where(inArray(geofences.vehicleId, ids));
  await db.delete(notifications).where(inArray(notifications.vehicleId, ids));
  await db.delete(vehicles).where(inArray(vehicles.id, ids));
}

export async function getVehicleById(vehicleId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  return result[0];
}

export async function createVehicle(vehicle: InsertVehicle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vehicles).values(vehicle);
  return result;
}

export async function updateVehicleBlock(vehicleId: number, blocked: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vehicles).set({ blocked }).where(eq(vehicles.id, vehicleId));
}

// Geofence helpers
export async function getUserGeofences(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(geofences).where(eq(geofences.userId, userId));
}

export async function createGeofence(geofence: InsertGeofence) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(geofences).values(geofence);
}

export async function getGeofenceById(geofenceId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(geofences).where(eq(geofences.id, geofenceId)).limit(1);
  return r[0];
}

export async function deleteGeofence(geofenceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(geofences).where(eq(geofences.id, geofenceId));
}

// Notification helpers
export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(notifications).values(notification);
}

/**
 * Mantém UM único alerta de manutenção por veículo, atualizado a cada dia (a
 * contagem de dias sobe), em vez de empilhar um card novo por dia. Reaproveita o
 * card existente: atualiza a mensagem, marca como não lido e sobe para o topo.
 */
export async function upsertMaintenanceNotification(
  userId: number, vehicleId: number, title: string, message: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.vehicleId, vehicleId),
      eq(notifications.type, "manutencao"),
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  if (existing[0]) {
    await db.update(notifications)
      .set({ title, message, read: false, createdAt: new Date() })
      .where(eq(notifications.id, existing[0].id));
  } else {
    await db.insert(notifications).values({ userId, vehicleId, type: "manutencao", title, message });
  }
}

// Check if a battery notification was sent in the last hour (deduplication)
export async function getRecentBatteryNotification(userId: number, vehicleId: number) {
  const db = await getDb();
  if (!db) return null;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const result = await db.select().from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.vehicleId, vehicleId),
      eq(notifications.type, "bateria_baixa"),
      gte(notifications.createdAt, oneHourAgo)
    ))
    .limit(1);
  return result[0] || null;
}

// Check if a geofence notification was sent in the last 30 minutes per fence+direction (deduplication)
export async function getRecentGeofenceNotification(userId: number, vehicleId: number, fenceId: number, direction: "entrada" | "saida" = "saida") {
  const db = await getDb();
  if (!db) return null;
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const notifType = direction === "entrada" ? "cerca_entrada" : "cerca_saida";
  const result = await db.select().from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.vehicleId, vehicleId),
      eq(notifications.type, notifType),
      gte(notifications.createdAt, thirtyMinAgo)
    ))
    .limit(1);
  return result[0] || null;
}

// Check if a speed notification was sent in the last 5 minutes (deduplication)
export async function getRecentSpeedNotification(userId: number, vehicleId: number) {
  const db = await getDb();
  if (!db) return null;
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const result = await db.select().from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.vehicleId, vehicleId),
      eq(notifications.title, "Velocidade Excessiva!"),
      gte(notifications.createdAt, fiveMinAgo)
    ))
    .limit(1);
  return result[0] || null;
}

export async function updateVehicleSpeedLimit(vehicleId: number, speedLimit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vehicles).set({ speedLimit }).where(eq(vehicles.id, vehicleId));
}

/** Aplica o mesmo limite de velocidade a todos os veículos do usuário. */
export async function updateAllVehicleSpeedLimits(userId: number, speedLimit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vehicles).set({ speedLimit }).where(eq(vehicles.userId, userId));
}

export async function updateVehicleIconType(vehicleId: number, userId: number, iconType: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vehicles).set({ iconType }).where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId)));
}

export async function getNotificationById(notificationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(notifications).where(eq(notifications.id, notificationId)).limit(1);
  return r[0];
}

export async function markNotificationRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
}

// Occurrence helpers
export async function createOccurrence(occurrence: InsertOccurrence) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(occurrences).values(occurrence);
}

export async function getUserOccurrences(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(occurrences).where(eq(occurrences.userId, userId)).orderBy(desc(occurrences.createdAt));
}

// Block log helpers
export async function createBlockLog(log: {
  userId: number;
  vehicleId: number;
  action: "block" | "unblock";
  termsAcceptedAt?: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  reason?: string | null;
  vehicleSpeed?: number;
  vehicleIgnition?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(blockLogs).values(log);
}

export async function updateBlockLogStatus(logId: number, status: "requested" | "sent" | "confirmed" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(blockLogs).set({ status }).where(eq(blockLogs.id, logId));
}

export async function getBlockHistory(vehicleId: number, userId: number, page = 1, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const offset = (page - 1) * limit;
  return db.select().from(blockLogs)
    .where(and(eq(blockLogs.vehicleId, vehicleId), eq(blockLogs.userId, userId)))
    .orderBy(desc(blockLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

// SOS helpers
export async function createSosAlert(alert: { userId: number; vehicleId?: number; type: string; latitude?: string; longitude?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(sosAlerts).values(alert as any);
}

export async function cancelSosAlert(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Cancel the most recent 'acionado' alert for this user (within last 30 seconds)
  const thirtySecondsAgo = new Date(Date.now() - 30000);
  const [latest] = await db.select().from(sosAlerts)
    .where(and(
      eq(sosAlerts.userId, userId),
      eq(sosAlerts.status, "acionado"),
      gte(sosAlerts.createdAt, thirtySecondsAgo)
    ))
    .orderBy(desc(sosAlerts.createdAt))
    .limit(1);
  if (!latest) return { cancelled: false, reason: "no_recent_alert" };
  await db.update(sosAlerts).set({ status: "cancelado" }).where(eq(sosAlerts.id, latest.id));
  return { cancelled: true, alertId: latest.id };
}

// Vehicle position update
export async function updateVehiclePosition(vehicleId: number, data: { latitude: string; longitude: string; address?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vehicles).set({
    lastLatitude: data.latitude,
    lastLongitude: data.longitude,
    lastAddress: data.address || null,
    lastSignalAt: new Date(),
  } as any).where(eq(vehicles.id, vehicleId));
}

// Telemetry update
export async function updateVehicleTelemetry(vehicleId: number, data: {
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
  trackerMode?: string;
  simStatus?: string;
  simSignal?: number;
  trackerModel?: string;
  trackerSerial?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {
    lastSignalAt: new Date(),
  };
  if (data.latitude) updateSet.lastLatitude = data.latitude;
  if (data.longitude) updateSet.lastLongitude = data.longitude;
  if (data.address) updateSet.lastAddress = data.address;
  if (data.speed !== undefined) updateSet.speed = data.speed;
  if (data.heading !== undefined) updateSet.heading = data.heading;
  if (data.odometer) updateSet.odometer = data.odometer;
  if (data.hourmeter) updateSet.hourmeter = data.hourmeter;
  if (data.batteryMain) updateSet.batteryMain = data.batteryMain;
  if (data.batteryBackup) updateSet.batteryBackup = data.batteryBackup;
  if (data.ignition !== undefined) updateSet.ignition = data.ignition;
  if (data.gpsSatellites !== undefined) updateSet.gpsSatellites = data.gpsSatellites;
  if (data.gpsSignal !== undefined) updateSet.gpsSignal = data.gpsSignal;
  if (data.trackerMode) updateSet.trackerMode = data.trackerMode;
  if (data.simStatus) updateSet.simStatus = data.simStatus;
  if (data.simSignal !== undefined) updateSet.simSignal = data.simSignal;
  if (data.trackerModel) updateSet.trackerModel = data.trackerModel;
  if (data.trackerSerial) updateSet.trackerSerial = data.trackerSerial;
  if (data.latitude || data.longitude) updateSet.lastGpsAt = new Date();
  if (data.simStatus || data.simSignal !== undefined) updateSet.lastGprsAt = new Date();
  await db.update(vehicles).set(updateSet as any).where(eq(vehicles.id, vehicleId));
}

// Route History helpers
export async function getVehicleRouteHistory(vehicleId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(routeHistory).where(eq(routeHistory.vehicleId, vehicleId)).orderBy(desc(routeHistory.recordedAt)).limit(limit);
}

export async function addRoutePoint(data: { vehicleId: number; latitude: string; longitude: string; speed?: number; heading?: number; address?: string }) {
  const db = await getDb();
  if (!db) return;
  return db.insert(routeHistory).values(data);
}

// Trip helpers
export async function getVehicleTrips(vehicleId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trips).where(eq(trips.vehicleId, vehicleId)).orderBy(desc(trips.startedAt)).limit(limit);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Km percorridos somando as posições do histórico (fallback quando não há trips). */
async function kmFromRouteHistory(ids: number[], since: Date, startOfToday: Date): Promise<{ week: number; today: number }> {
  const db = await getDb();
  if (!db) return { week: 0, today: 0 };
  const pts = await db.select({ vehicleId: routeHistory.vehicleId, latitude: routeHistory.latitude, longitude: routeHistory.longitude, recordedAt: routeHistory.recordedAt })
    .from(routeHistory)
    .where(and(inArray(routeHistory.vehicleId, ids), gte(routeHistory.recordedAt, since)))
    .orderBy(routeHistory.vehicleId, routeHistory.recordedAt)
    .limit(20000);
  let week = 0, today = 0;
  let prev: { vId: number; lat: number; lng: number } | null = null;
  for (const p of pts) {
    const lat = parseFloat(String(p.latitude)), lng = parseFloat(String(p.longitude));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (prev && prev.vId === p.vehicleId) {
      const d = haversineKm({ lat: prev.lat, lng: prev.lng }, { lat, lng });
      if (d < 200) { // ignora saltos absurdos (GPS ruim)
        week += d;
        if (p.recordedAt && new Date(p.recordedAt) >= startOfToday) today += d;
      }
    }
    prev = { vId: p.vehicleId, lat, lng };
  }
  return { week, today };
}

/** Resumo de uso (km) do usuário: hoje e últimos 7 dias. */
export async function getDriveSummary(userId: number) {
  const empty = { kmToday: 0, kmWeek: 0, tripsToday: 0, tripsWeek: 0 };
  const db = await getDb();
  if (!db) return empty;
  const vs = await db.select({ id: vehicles.id }).from(vehicles)
    .where(and(eq(vehicles.userId, userId), eq(vehicles.isDemo, false)));
  const ids = vs.map((v) => v.id);
  if (ids.length === 0) return empty;
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const rows = await db.select().from(trips)
    .where(and(inArray(trips.vehicleId, ids), gte(trips.startedAt, weekAgo)));
  let kmToday = 0, kmWeek = 0, tripsToday = 0, tripsWeek = 0;
  for (const t of rows) {
    const km = parseFloat(String(t.distanceKm ?? 0)) || 0;
    kmWeek += km; tripsWeek++;
    if (new Date(t.startedAt) >= startOfToday) { kmToday += km; tripsToday++; }
  }
  // Sem trips com distância → estima pelas posições recebidas (telemetria GO360).
  if (kmWeek <= 0) {
    const rh = await kmFromRouteHistory(ids, weekAgo, startOfToday);
    kmWeek = rh.week; kmToday = rh.today;
  }
  return {
    kmToday: Math.round(kmToday * 10) / 10,
    kmWeek: Math.round(kmWeek * 10) / 10,
    tripsToday,
    tripsWeek,
  };
}

export async function getTripById(tripId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  return result[0] || null;
}

export async function getTripRoutePoints(vehicleId: number, startedAt: Date, endedAt: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(routeHistory)
    .where(and(
      eq(routeHistory.vehicleId, vehicleId),
      gte(routeHistory.recordedAt, startedAt),
      lte(routeHistory.recordedAt, endedAt)
    ))
    .orderBy(routeHistory.recordedAt);
}

export async function createTrip(data: Omit<InsertTrip, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(trips).values(data as any);
}

// ========== Share Links ==========

export async function createShareLink(data: Omit<InsertShareLink, 'id' | 'createdAt' | 'viewCount' | 'lastViewedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(shareLinks).values(data as any);
}

export async function getShareLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  return result[0] || null;
}

export async function getUserShareLinks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareLinks).where(eq(shareLinks.userId, userId)).orderBy(desc(shareLinks.createdAt));
}

export async function revokeShareLink(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(shareLinks).set({ active: false }).where(and(eq(shareLinks.id, id), eq(shareLinks.userId, userId)));
}

export async function countActiveShareLinksForVehicle(vehicleId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(shareLinks).where(
    and(
      eq(shareLinks.vehicleId, vehicleId),
      eq(shareLinks.active, true),
      gte(shareLinks.expiresAt, new Date())
    )
  );
  return result.length;
}

export async function incrementShareLinkView(id: number) {
  const db = await getDb();
  if (!db) return;
  const link = await db.select().from(shareLinks).where(eq(shareLinks.id, id)).limit(1);
  if (link[0]) {
    await db.update(shareLinks).set({ 
      viewCount: (link[0].viewCount || 0) + 1,
      lastViewedAt: new Date()
    }).where(eq(shareLinks.id, id));
  }
}

// === JORNADA DE CUIDADO ===
import { servicePoints, serviceAppointments, vehicleOfflineReasons, paymentMethods, paymentChangeHistory } from "../drizzle/schema";

export async function createOfflineReason(data: {
  userId: number;
  vehicleId: number;
  reason: "all_ok" | "garage" | "workshop" | "maintenance" | "other";
  details: string | null;
  needsService: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(vehicleOfflineReasons).values({
    userId: data.userId,
    vehicleId: data.vehicleId,
    reason: data.reason,
    details: data.details,
    needsService: data.needsService,
  });
}

export async function getServicePoints(city?: string) {
  const db = await getDb();
  if (!db) return [];
  if (city) {
    return db.select().from(servicePoints).where(and(eq(servicePoints.active, true), eq(servicePoints.city, city)));
  }
  return db.select().from(servicePoints).where(eq(servicePoints.active, true));
}

export async function createServiceAppointment(data: {
  userId: number;
  vehicleId: number;
  servicePointId: number;
  scheduledDate: Date;
  serviceType: string;
  notes: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(serviceAppointments).values({
    userId: data.userId,
    vehicleId: data.vehicleId,
    servicePointId: data.servicePointId,
    scheduledDate: data.scheduledDate,
    serviceType: data.serviceType,
    notes: data.notes,
  });
  return { id: result[0].insertId };
}

export async function getUserAppointments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceAppointments)
    .where(eq(serviceAppointments.userId, userId))
    .orderBy(desc(serviceAppointments.createdAt));
}

export async function cancelAppointment(appointmentId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(serviceAppointments)
    .set({ status: "cancelled" })
    .where(and(eq(serviceAppointments.id, appointmentId), eq(serviceAppointments.userId, userId)));
}

// === GESTÃO DE PAGAMENTO ===

export async function getCurrentPaymentMethod(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isActive, true)))
    .orderBy(desc(paymentMethods.createdAt))
    .limit(1);
  return result[0] || null;
}

export async function setPaymentMethod(data: {
  userId: number;
  type: "boleto" | "credit_card" | "debit_card" | "pix" | "recurring_card";
  cardLast4: string | null;
  cardBrand: string | null;
  billingDay: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  // Desativar métodos anteriores
  await db.update(paymentMethods)
    .set({ isActive: false })
    .where(eq(paymentMethods.userId, data.userId));
  // Criar novo método ativo
  await db.insert(paymentMethods).values({
    userId: data.userId,
    type: data.type,
    isActive: true,
    cardLast4: data.cardLast4,
    cardBrand: data.cardBrand,
    billingDay: data.billingDay,
  });
}

export async function createPaymentChangeHistory(data: {
  userId: number;
  previousMethod: string;
  newMethod: string;
  incentiveType: "discount" | "marketplace_product" | "none";
  incentiveValue: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(paymentChangeHistory).values({
    userId: data.userId,
    previousMethod: data.previousMethod,
    newMethod: data.newMethod,
    incentiveType: data.incentiveType,
    incentiveValue: data.incentiveValue,
  });
}

export async function getPaymentChangeHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentChangeHistory)
    .where(eq(paymentChangeHistory.userId, userId))
    .orderBy(desc(paymentChangeHistory.createdAt));
}

// === FATURAS / HISTÓRICO DE PAGAMENTOS ===
import { invoices } from "../drizzle/schema";
import type { InsertInvoice } from "../drizzle/schema";

export async function getInvoices(userId: number, options?: { status?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(invoices.userId, userId)];
  if (options?.status && options.status !== "all") {
    conditions.push(eq(invoices.status, options.status as any));
  }

  const whereClause = and(...conditions);
  const items = await db.select().from(invoices)
    .where(whereClause)
    .orderBy(desc(invoices.dueDate))
    .limit(limit)
    .offset(offset);

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(invoices)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  return { items, total };
}

export async function getInvoiceById(invoiceId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .limit(1);
  return result[0] || null;
}

export async function createInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) return;
  await db.insert(invoices).values(data);
}


// Emergency Contacts
export async function getUserEmergencyContacts(userId: number): Promise<EmergencyContact[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId));
  } catch (error) {
    console.error("[Database] Error fetching emergency contacts:", error);
    return [];
  }
}

export async function createEmergencyContact(data: InsertEmergencyContact): Promise<EmergencyContact | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const result = await db.insert(emergencyContacts).values(data);
    const id = result[0].insertId;
    return await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, id as number)).then(r => r[0] || null);
  } catch (error) {
    console.error("[Database] Error creating emergency contact:", error);
    throw error;
  }
}

export async function updateEmergencyContact(id: number, userId: number, data: Partial<InsertEmergencyContact>): Promise<EmergencyContact | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.update(emergencyContacts).set(data).where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, userId)));
    return await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, id)).then(r => r[0] || null);
  } catch (error) {
    console.error("[Database] Error updating emergency contact:", error);
    throw error;
  }
}

export async function deleteEmergencyContact(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.delete(emergencyContacts).where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Error deleting emergency contact:", error);
    throw error;
  }
}

export async function setPrimaryEmergencyContact(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    // Remove primary from all contacts
    await db.update(emergencyContacts).set({ isPrimary: false }).where(eq(emergencyContacts.userId, userId));
    // Set new primary
    await db.update(emergencyContacts).set({ isPrimary: true }).where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, userId)));
  } catch (error) {
    console.error("[Database] Error setting primary emergency contact:", error);
    throw error;
  }
}

export async function getPrimaryEmergencyContact(userId: number): Promise<EmergencyContact | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(emergencyContacts).where(and(eq(emergencyContacts.userId, userId), eq(emergencyContacts.isPrimary, true))).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error fetching primary emergency contact:", error);
    return null;
  }
}

// --- App feedback (rating + suggestion) & help queries ---
import { appFeedback, helpQueries } from "../drizzle/schema";

export async function createAppFeedback(data: { userId: number; rating: number; message?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(appFeedback).values({ userId: data.userId, rating: data.rating, message: data.message ?? null });
}

export async function createHelpQuery(data: { userId?: number | null; query: string; matched: boolean }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(helpQueries).values({ userId: data.userId ?? null, query: data.query.slice(0, 500), matched: data.matched });
}

// --- Contracts (DocuSign-ready) & legal consent logs ---
import { contracts, consentLogs } from "../drizzle/schema";

/** Returns the user's contract, creating a default (pending) one if none exists. */
export async function getOrCreateUserContract(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await db.select().from(contracts).where(eq(contracts.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(contracts).values({
    userId,
    title: "Contrato de Adesão GO",
    status: "pending",
    provider: "docusign",
  });
  const created = await db.select().from(contracts).where(eq(contracts.userId, userId)).limit(1);
  return created[0];
}

export async function createConsentLog(data: {
  userId: number;
  docType: "termos_uso" | "privacidade_lgpd" | "confidencialidade";
  version: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(consentLogs).values({
    userId: data.userId,
    docType: data.docType,
    version: data.version,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  });
}

export async function getUserConsents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consentLogs).where(eq(consentLogs.userId, userId)).orderBy(desc(consentLogs.acceptedAt));
}

/** Summary of open/late invoices for the gentle overdue reminder. */
export async function getOpenInvoicesSummary(userId: number) {
  const db = await getDb();
  if (!db) return { count: 0, totalAmount: 0, oldestDueDate: null as Date | null, invoiceId: null as number | null, daysLate: 0 };
  // Cliente GO360: cobrança real vem do /cobranca deles. Faturas locais são
  // resíduo de demonstração — não mostrar (evita banner de R$ 89,90 falso).
  const u = await getUserById(userId);
  if ((u as any)?.go360ClienteId) {
    return { count: 0, totalAmount: 0, oldestDueDate: null as Date | null, invoiceId: null as number | null, daysLate: 0 };
  }
  const now = new Date();
  const open = await db.select().from(invoices)
    .where(and(eq(invoices.userId, userId), inArray(invoices.status, ["overdue", "pending"])))
    .orderBy(invoices.dueDate);
  const late = open.filter((i) => i.status === "overdue" || (i.status === "pending" && new Date(i.dueDate) < now));
  const totalAmount = late.reduce((s, i) => s + parseFloat(String(i.amount)), 0);
  const oldest = late[0]?.dueDate ?? null;
  const daysLate = oldest ? Math.max(0, Math.floor((now.getTime() - new Date(oldest).getTime()) / 86400000)) : 0;
  return {
    count: late.length,
    totalAmount,
    oldestDueDate: oldest,
    invoiceId: late[0]?.id ?? null,
    daysLate,
  };
}

/** Users with late invoices (for the scheduled billing reminder push). */
export async function getUsersWithLateInvoices() {
  const db = await getDb();
  if (!db) return [] as Array<{ userId: number; totalAmount: number; daysLate: number; lastBillingReminderAt: Date | null }>;
  const now = new Date();
  const rows = await db.select().from(invoices).where(inArray(invoices.status, ["overdue", "pending"]));
  const late = rows.filter((i) => i.status === "overdue" || (i.status === "pending" && new Date(i.dueDate) < now));

  const byUser = new Map<number, { userId: number; totalAmount: number; oldest: Date }>();
  for (const i of late) {
    const amt = parseFloat(String(i.amount));
    const cur = byUser.get(i.userId);
    if (!cur) byUser.set(i.userId, { userId: i.userId, totalAmount: amt, oldest: new Date(i.dueDate) });
    else { cur.totalAmount += amt; if (new Date(i.dueDate) < cur.oldest) cur.oldest = new Date(i.dueDate); }
  }
  if (byUser.size === 0) return [];

  const ids = Array.from(byUser.keys());
  const us = await db.select({ id: users.id, lastBillingReminderAt: users.lastBillingReminderAt, go360ClienteId: users.go360ClienteId }).from(users).where(inArray(users.id, ids));
  const lastMap = new Map(us.map((u) => [u.id, u.lastBillingReminderAt]));
  const go360Ids = new Set(us.filter((u) => u.go360ClienteId).map((u) => u.id));

  return Array.from(byUser.values()).filter((v) => !go360Ids.has(v.userId)).map((v) => ({
    userId: v.userId,
    totalAmount: v.totalAmount,
    daysLate: Math.max(0, Math.floor((now.getTime() - v.oldest.getTime()) / 86400000)),
    lastBillingReminderAt: lastMap.get(v.userId) ?? null,
  }));
}

export async function markBillingReminderSent(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastBillingReminderAt: new Date() }).where(eq(users.id, userId));
}

// --- Reengajamento: usuários inativos há vários dias ---
export type InactiveUser = { userId: number; name: string | null };

export async function getInactiveUsersForNudge(days: number, cooldownMs: number): Promise<InactiveUser[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - days * 86400000);
  const coolCutoff = new Date(Date.now() - cooldownMs);
  const rows = await db.select({ id: users.id, name: users.name, lastSignedIn: users.lastSignedIn, lastEngagementAt: users.lastEngagementAt })
    .from(users)
    .where(lt(users.lastSignedIn, cutoff));
  return rows
    .filter((u) => !u.lastEngagementAt || new Date(u.lastEngagementAt) < coolCutoff)
    .map((u) => ({ userId: u.id, name: u.name }));
}

export async function markEngagementNudgeSent(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastEngagementAt: new Date() }).where(eq(users.id, userId));
}

// --- Manutenção: rastreadores sem posicionar há muitos dias ---
import { notificationLog, alertAcks, vehicleModelImages, drivingEvents } from "../drizzle/schema";

/** Registra um evento de comportamento de direção (telemetria GO360). */
export async function insertDrivingEvent(data: {
  vehicleId: number; type: string; severity?: "leve" | "media" | "alta";
  latitude?: string | null; longitude?: string | null; speed?: number | null; eventAt?: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(drivingEvents).values({
    vehicleId: data.vehicleId,
    type: data.type,
    severity: data.severity ?? "media",
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    speed: data.speed ?? null,
    eventAt: data.eventAt ?? new Date(),
  } as any);
}

/**
 * Score de direção (0–100) dos últimos 30 dias, a partir dos eventos de
 * comportamento normalizados pela distância. Retorna null quando ainda não há
 * dados (sem eventos e sem km) — aí o card nem aparece.
 */
export async function getDrivingScore(userId: number): Promise<{ score: number; events: number; km: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const vs = await db.select({ id: vehicles.id }).from(vehicles)
    .where(and(eq(vehicles.userId, userId), eq(vehicles.isDemo, false)));
  const ids = vs.map((v) => v.id);
  if (ids.length === 0) return null;
  const since = new Date(Date.now() - 30 * 86400000);
  const [evs, tps] = await Promise.all([
    db.select().from(drivingEvents).where(and(inArray(drivingEvents.vehicleId, ids), gte(drivingEvents.eventAt, since))),
    db.select().from(trips).where(and(inArray(trips.vehicleId, ids), gte(trips.startedAt, since))),
  ]);
  let km = tps.reduce((s, t) => s + (parseFloat(String(t.distanceKm ?? 0)) || 0), 0);
  if (km <= 0) {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    km = (await kmFromRouteHistory(ids, since, startOfToday)).week;
  }
  if (evs.length === 0 && km <= 0) return null; // sem dados ainda
  const weight = (sev: string | null) => (sev === "alta" ? 10 : sev === "leve" ? 2 : 5);
  const penalty = evs.reduce((s, e) => s + weight(e.severity), 0);
  let score: number;
  if (km >= 20) {
    score = 100 - penalty / (km / 100); // penalidade por 100 km
  } else {
    score = 100 - penalty; // pouca distância → penalidade bruta
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, events: evs.length, km: Math.round(km * 10) / 10 };
}

// --- Biblioteca de imagens de modelos (cache por marca|modelo|ano) ---
/** Busca a imagem de um modelo: ano exato > sem ano (genérico) > qualquer. */
export async function getModelImage(make: string, model: string, year: number | null) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(vehicleModelImages)
    .where(and(eq(vehicleModelImages.make, make), eq(vehicleModelImages.model, model)));
  if (rows.length === 0) return undefined;
  return rows.find((r) => r.year === year) ?? rows.find((r) => r.year == null) ?? rows[0];
}

/** Lista a biblioteca de imagens, com filtro opcional por marca/modelo (admin). */
export async function getModelImages(filter?: { make?: string; model?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conds = [] as any[];
  if (filter?.make) conds.push(like(vehicleModelImages.make, `%${filter.make.trim().toLowerCase()}%`));
  if (filter?.model) conds.push(like(vehicleModelImages.model, `%${filter.model.trim().toLowerCase()}%`));
  const base = db.select().from(vehicleModelImages);
  const q = conds.length ? base.where(and(...conds)) : base;
  return q.orderBy(desc(vehicleModelImages.updatedAt)).limit(500);
}

/**
 * Acrescenta/atualiza um parâmetro de versão na URL. Como a curadoria às vezes
 * troca a IMAGEM mantendo o MESMO link (ex.: remover o fundo → PNG), isso força
 * o navegador/CDN a baixar a versão nova em vez de exibir a do cache.
 */
function withCacheBust(url: string): string {
  const v = Date.now().toString(36);
  try {
    const u = new URL(url);
    u.searchParams.set("v", v);
    return u.toString();
  } catch {
    return url + (url.includes("?") ? "&" : "?") + "v=" + v;
  }
}

export async function updateModelImageById(id: number, imageUrl: string) {
  const db = await getDb();
  if (!db) return;
  const busted = withCacheBust(imageUrl);
  const rows = await db.select().from(vehicleModelImages).where(eq(vehicleModelImages.id, id)).limit(1);
  await db.update(vehicleModelImages).set({ imageUrl: busted, source: "manual" }).where(eq(vehicleModelImages.id, id));
  if (rows[0]) await applyModelImageToVehicles(rows[0].make, rows[0].model, busted);
}

/**
 * Propaga uma imagem de modelo para os veículos já cadastrados que casam
 * (marca + família do modelo), para a curadoria do admin aparecer na hora,
 * sem esperar a próxima sincronização.
 */
export async function applyModelImageToVehicles(make: string, model: string, imageUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(vehicles).set({ imageUrl }).where(and(
    sql`LOWER(${vehicles.brand}) LIKE ${`%${make}%`}`,
    sql`LOWER(${vehicles.model}) LIKE ${`${model}%`}`,
  ));
}

export async function deleteModelImage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(vehicleModelImages).where(eq(vehicleModelImages.id, id));
}

export async function upsertModelImage(data: {
  make: string; model: string; year: number | null; imageUrl: string; source?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const source = data.source ?? "manual";
  // Curadoria manual: cache-bust para refletir troca de imagem no mesmo link.
  const finalUrl = source === "manual" ? withCacheBust(data.imageUrl) : data.imageUrl;
  const existing = await db.select().from(vehicleModelImages)
    .where(and(eq(vehicleModelImages.make, data.make), eq(vehicleModelImages.model, data.model)));
  const match = existing.find((r) => r.year === data.year);
  if (match) {
    await db.update(vehicleModelImages)
      .set({ imageUrl: finalUrl, source })
      .where(eq(vehicleModelImages.id, match.id));
  } else {
    await db.insert(vehicleModelImages).values({
      make: data.make, model: data.model, year: data.year,
      imageUrl: finalUrl, source,
    });
  }
  // Curadoria manual reflete imediatamente nos veículos já cadastrados.
  if (source === "manual") {
    await applyModelImageToVehicles(data.make, data.model, finalUrl);
  }
}

/** Registra a ciência do cliente ("Estou ciente") sobre um alerta crítico. */
export async function createAlertAck(entry: {
  userId: number; vehicleId?: number | null; type: string;
  daysAtAck?: number | null; ip?: string | null; userAgent?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(alertAcks).values({
    userId: entry.userId,
    vehicleId: entry.vehicleId ?? null,
    type: entry.type,
    daysAtAck: entry.daysAtAck ?? null,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
  });
}

/** Última ciência registrada para um veículo/tipo (estado do botão "Estou ciente"). */
export async function getLatestAlertAck(userId: number, vehicleId: number, type: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(alertAcks)
    .where(and(eq(alertAcks.userId, userId), eq(alertAcks.vehicleId, vehicleId), eq(alertAcks.type, type)))
    .orderBy(desc(alertAcks.createdAt))
    .limit(1);
  return rows[0];
}

export type StaleVehicle = {
  userId: number; vehicleId: number; plate: string; model: string;
  lastSignalAt: Date | null; lastStaleAlertAt: Date | null; daysStale: number;
};

/**
 * Real trackers (com serial) cuja última posição é mais antiga que `thresholdDays`.
 * Ignora veículos demo. Usado para avisar o cliente que pode precisar de manutenção.
 */
export async function getStaleTrackedVehicles(thresholdDays = 3): Promise<StaleVehicle[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - thresholdDays * 86400000);
  const rows = await db.select().from(vehicles).where(and(
    isNotNull(vehicles.trackerSerial),
    eq(vehicles.isDemo, false),
    isNotNull(vehicles.lastSignalAt),
    lt(vehicles.lastSignalAt, cutoff),
  ));
  return rows.map((v) => ({
    userId: v.userId,
    vehicleId: v.id,
    plate: v.plate,
    model: v.model,
    lastSignalAt: v.lastSignalAt ?? null,
    lastStaleAlertAt: v.lastStaleAlertAt ?? null,
    daysStale: v.lastSignalAt
      ? Math.max(0, Math.floor((Date.now() - new Date(v.lastSignalAt).getTime()) / 86400000))
      : 0,
  }));
}

export async function markStaleAlertSent(vehicleId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(vehicles).set({ lastStaleAlertAt: new Date() }).where(eq(vehicles.id, vehicleId));
}

/**
 * Registra um disparo de aviso na trilha de auditoria imutável (prova legal de
 * que informamos o cliente, com data/hora e canal). Nunca sobrescreve.
 */
export async function logNotificationDispatch(entry: {
  userId: number; vehicleId?: number | null; type: string;
  channel: "push" | "inapp" | "email" | "sms" | "whatsapp";
  severity?: "info" | "warning" | "critical";
  title?: string; message?: string; meta?: unknown; delivered?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notificationLog).values({
    userId: entry.userId,
    vehicleId: entry.vehicleId ?? null,
    type: entry.type,
    channel: entry.channel,
    severity: entry.severity ?? "info",
    title: entry.title ?? null,
    message: entry.message ?? null,
    meta: (entry.meta ?? null) as any,
    delivered: entry.delivered ?? true,
  });
}

/** Histórico de avisos enviados a um usuário (para CS/auditoria). */
export async function getNotificationLog(userId: number, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationLog)
    .where(eq(notificationLog.userId, userId))
    .orderBy(desc(notificationLog.createdAt))
    .limit(limit);
}

export type AlertHistoryEntry = {
  id: string; createdAt: Date; channel: string; severity: string;
  type: string; title: string | null; message: string | null; delivered: boolean;
};

/**
 * Histórico de avisos para o cliente: une a trilha de auditoria multi-canal
 * (notificationLog) com a caixa de avisos do app (notifications), sem duplicar.
 * Assim a tela mostra os avisos recebidos mesmo antes da auditoria diária encher.
 */
export async function getAlertHistory(userId: number, limit = 200): Promise<AlertHistoryEntry[]> {
  const db = await getDb();
  if (!db) return [];
  const [logs, notifs] = await Promise.all([
    db.select().from(notificationLog).where(eq(notificationLog.userId, userId))
      .orderBy(desc(notificationLog.createdAt)).limit(limit),
    db.select().from(notifications).where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt)).limit(limit),
  ]);

  const dayKey = (d: Date, type: string) => `${new Date(d).toISOString().slice(0, 10)}|${type}`;
  const inappLoggedDays = new Set<string>();
  const entries: AlertHistoryEntry[] = [];

  for (const l of logs) {
    entries.push({
      id: `log-${l.id}`, createdAt: l.createdAt, channel: l.channel, severity: l.severity,
      type: l.type, title: l.title, message: l.message, delivered: l.delivered,
    });
    if (l.channel === "inapp") inappLoggedDays.add(dayKey(l.createdAt, l.type));
  }

  for (const n of notifs) {
    const ntype = n.type ?? "sistema";
    // Evita duplicar o card "no app" já representado na auditoria do mesmo dia.
    if (inappLoggedDays.has(dayKey(n.createdAt, ntype))) continue;
    const severity = ["sos", "furto_roubo"].includes(ntype)
      ? "critical"
      : ["manutencao", "offline", "bateria_baixa", "velocidade_excessiva"].includes(ntype)
      ? "warning"
      : "info";
    entries.push({
      id: `ntf-${n.id}`, createdAt: n.createdAt, channel: "inapp", severity,
      type: ntype, title: n.title, message: n.message ?? null, delivered: true,
    });
  }

  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return entries.slice(0, limit);
}

// --- Retention (cancellation save flow) ---
import { retentionEvents } from "../drizzle/schema";

export async function createRetentionEvent(data: {
  userId: number;
  reason?: string | null;
  action: "offer_shown" | "offer_accepted" | "support" | "cancelled";
  offer?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(retentionEvents).values({
    userId: data.userId,
    reason: data.reason ?? null,
    action: data.action,
    offer: data.offer ?? null,
  });
}

/** Find a vehicle by its tracker serial (for external telemetry ingestion). */
export async function getVehicleBySerial(serial: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vehicles).where(eq(vehicles.trackerSerial, serial)).limit(1);
  return result[0];
}
