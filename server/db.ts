import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, vehicles, geofences, notifications, occurrences, blockLogs, sosAlerts, routeHistory, trips, shareLinks, emergencyContacts, pushSubscriptions } from "../drizzle/schema";
import type { InsertTrip, InsertShareLink, InsertEmergencyContact, EmergencyContact } from "../drizzle/schema";
import type { InsertVehicle, InsertGeofence, InsertOccurrence, InsertNotification } from "../drizzle/schema";
import { ENV } from './_core/env';

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
  await db.update(users).set({ go360Token: token }).where(eq(users.id, userId));
}

/** Upsert a vehicle synced from GO360 (matched by user + plate). */
export async function upsertGo360Vehicle(userId: number, data: {
  plate: string; brand?: string | null; model: string; color?: string | null; year?: number | null;
  trackerSerial?: string | null; trackerModel?: string | null; trackerStatus?: "online" | "offline" | "alert";
  go360AtivoId?: string | null;
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
    trackerSerial: data.trackerSerial ?? null,
    trackerModel: data.trackerModel ?? null,
    trackerStatus: data.trackerStatus ?? "online",
    go360AtivoId: data.go360AtivoId ?? null,
    isDemo: false,
  };
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

export async function setUserAddress(userId: number, data: { address: string; lat?: string | null; lng?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    address: data.address,
    addressLat: data.lat ?? null,
    addressLng: data.lng ?? null,
  }).where(eq(users.id, userId));
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

export async function updateVehicleIconType(vehicleId: number, userId: number, iconType: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vehicles).set({ iconType }).where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId)));
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
  const us = await db.select({ id: users.id, lastBillingReminderAt: users.lastBillingReminderAt }).from(users).where(inArray(users.id, ids));
  const lastMap = new Map(us.map((u) => [u.id, u.lastBillingReminderAt]));

  return Array.from(byUser.values()).map((v) => ({
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
