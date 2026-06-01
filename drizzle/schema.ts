import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, decimal } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  cpf: varchar("cpf", { length: 14 }),
  phone: varchar("phone", { length: 20 }),
  plan: varchar("plan", { length: 64 }).default("basico"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  plate: varchar("plate", { length: 10 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  brand: varchar("brand", { length: 100 }),
  color: varchar("color", { length: 50 }),
  year: int("year"),
  trackerStatus: mysqlEnum("trackerStatus", ["online", "offline", "alert"]).default("online"),
  ignition: boolean("ignition").default(false),
  blocked: boolean("blocked").default(false),
  batteryLevel: int("batteryLevel").default(100),
  lastLatitude: decimal("lastLatitude", { precision: 10, scale: 7 }),
  lastLongitude: decimal("lastLongitude", { precision: 10, scale: 7 }),
  lastAddress: text("lastAddress"),
  lastSignalAt: timestamp("lastSignalAt").defaultNow(),
  // Telemetria do rastreador
  speed: int("speed").default(0),
  heading: int("heading").default(0),
  odometer: decimal("odometer", { precision: 10, scale: 2 }).default("0"),
  hourmeter: decimal("hourmeter", { precision: 8, scale: 2 }).default("0"),
  batteryBackup: decimal("batteryBackup", { precision: 4, scale: 1 }).default("0"),
  batteryMain: decimal("batteryMain", { precision: 5, scale: 2 }).default("0"),
  gpsSignal: int("gpsSignal").default(0),
  gpsSatellites: int("gpsSatellites").default(0),
  trackerMode: mysqlEnum("trackerMode", ["active", "sleep", "deep_sleep", "emergency"]).default("active"),
  trackerModel: varchar("trackerModel", { length: 50 }),
  trackerSerial: varchar("trackerSerial", { length: 50 }),
  simStatus: mysqlEnum("simStatus", ["active", "inactive", "no_signal"]).default("active"),
  simSignal: int("simSignal").default(0),
  lastGpsAt: timestamp("lastGpsAt").defaultNow(),
  lastGprsAt: timestamp("lastGprsAt").defaultNow(),
  speedLimit: int("speedLimit").default(120),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const geofences = mysqlTable("geofences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["casa", "trabalho", "escola", "oficina", "garagem", "cidade", "personalizada"]).default("personalizada"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  radius: int("radius").default(200),
  active: boolean("active").default(true),
  alertOnEntry: boolean("alertOnEntry").default(true),
  alertOnExit: boolean("alertOnExit").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const occurrences = mysqlTable("occurrences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  type: mysqlEnum("type", ["furto", "roubo", "apropriacao", "golpe", "outro"]).notNull(),
  status: mysqlEnum("status", ["aberta", "central_acionada", "monitoramento", "equipe_designada", "em_diligencia", "localizado", "recuperado", "finalizada"]).default("aberta"),
  protocol: varchar("protocol", { length: 20 }).notNull(),
  description: text("description"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  address: text("address"),
  boDocument: text("boDocument"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId"),
  type: mysqlEnum("type", ["cerca_entrada", "cerca_saida", "bloqueio", "desbloqueio", "sos", "bateria_baixa", "velocidade_excessiva", "ignição_ligada", "ignição_desligada", "offline", "furto_roubo", "sistema"]).default("sistema"),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message"),
  read: boolean("read").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const blockLogs = mysqlTable("blockLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  action: mysqlEnum("action", ["block", "unblock"]).notNull(),
  status: mysqlEnum("status", ["requested", "sent", "confirmed", "failed"]).default("requested"),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  reason: text("reason"),
  vehicleSpeed: int("vehicleSpeed").default(0),
  vehicleIgnition: boolean("vehicleIgnition").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const sosAlerts = mysqlTable("sosAlerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId"),
  type: mysqlEnum("type", ["furto_roubo", "acidente", "pane", "guincho", "chaveiro", "pneu", "bateria", "pane_seca", "emergencia", "central"]).notNull(),
  status: mysqlEnum("status", ["acionado", "em_atendimento", "finalizado", "cancelado"]).default("acionado"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const routeHistory = mysqlTable("routeHistory", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: int("vehicleId").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  speed: int("speed").default(0),
  heading: int("heading").default(0),
  address: text("address"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: int("vehicleId").notNull(),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt"),
  startAddress: text("startAddress"),
  endAddress: text("endAddress"),
  startLatitude: decimal("startLatitude", { precision: 10, scale: 7 }),
  startLongitude: decimal("startLongitude", { precision: 10, scale: 7 }),
  endLatitude: decimal("endLatitude", { precision: 10, scale: 7 }),
  endLongitude: decimal("endLongitude", { precision: 10, scale: 7 }),
  distanceKm: decimal("distanceKm", { precision: 8, scale: 2 }),
  maxSpeed: int("maxSpeed").default(0),
  avgSpeed: int("avgSpeed").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;
export type Geofence = typeof geofences.$inferSelect;
export type InsertGeofence = typeof geofences.$inferInsert;
export type Occurrence = typeof occurrences.$inferSelect;
export type InsertOccurrence = typeof occurrences.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type BlockLog = typeof blockLogs.$inferSelect;
export type SosAlert = typeof sosAlerts.$inferSelect;
export type RouteHistory = typeof routeHistory.$inferSelect;
export const shareLinks = mysqlTable("shareLinks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 100 }),
  expiresAt: timestamp("expiresAt").notNull(),
  active: boolean("active").default(true),
  viewCount: int("viewCount").default(0),
  lastViewedAt: timestamp("lastViewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = typeof shareLinks.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// Pontos de instalação/manutenção
export const servicePoints = mysqlTable("servicePoints", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  phone: varchar("phone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  openHours: varchar("openHours", { length: 100 }),
  services: text("services"), // JSON array of services offered
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Agendamentos de manutenção
export const serviceAppointments = mysqlTable("serviceAppointments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  servicePointId: int("servicePointId").notNull(),
  scheduledDate: timestamp("scheduledDate").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled"]).default("pending").notNull(),
  serviceType: varchar("serviceType", { length: 100 }).notNull(), // "maintenance", "installation", "repair"
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Registro de motivos de veículo offline (jornada de cuidado)
export const vehicleOfflineReasons = mysqlTable("vehicleOfflineReasons", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  reason: mysqlEnum("reason", ["all_ok", "garage", "workshop", "maintenance", "other"]).notNull(),
  details: text("details"),
  needsService: boolean("needsService").default(false),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ServicePoint = typeof servicePoints.$inferSelect;
export type InsertServicePoint = typeof servicePoints.$inferInsert;
export type ServiceAppointment = typeof serviceAppointments.$inferSelect;
export type InsertServiceAppointment = typeof serviceAppointments.$inferInsert;
export type VehicleOfflineReason = typeof vehicleOfflineReasons.$inferSelect;
export type InsertVehicleOfflineReason = typeof vehicleOfflineReasons.$inferInsert;

// Preferências de pagamento do usuário
export const paymentMethods = mysqlTable("paymentMethods", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["boleto", "credit_card", "debit_card", "pix", "recurring_card"]).notNull(),
  isActive: boolean("isActive").default(true),
  cardLast4: varchar("cardLast4", { length: 4 }),
  cardBrand: varchar("cardBrand", { length: 30 }),
  billingDay: int("billingDay"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Histórico de mudanças de pagamento com incentivos
export const paymentChangeHistory = mysqlTable("paymentChangeHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  previousMethod: varchar("previousMethod", { length: 30 }).notNull(),
  newMethod: varchar("newMethod", { length: 30 }).notNull(),
  incentiveType: mysqlEnum("incentiveType", ["discount", "marketplace_product", "none"]).default("none"),
  incentiveValue: varchar("incentiveValue", { length: 200 }), // "10%" ou "Rastreador PET grátis"
  incentiveClaimed: boolean("incentiveClaimed").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Faturas / histórico de pagamentos
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  vehicleId: int("vehicleId"),
  description: varchar("description", { length: 200 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidAt: timestamp("paidAt"),
  status: mysqlEnum("status", ["paid", "pending", "overdue", "cancelled"]).default("pending").notNull(),
  method: mysqlEnum("method", ["boleto", "credit_card", "debit_card", "pix", "recurring_card"]).default("boleto").notNull(),
  boletoUrl: text("boletoUrl"),
  boletoBarcode: varchar("boletoBarcode", { length: 60 }),
  referenceMonth: varchar("referenceMonth", { length: 7 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;
export type PaymentChangeHistory = typeof paymentChangeHistory.$inferSelect;
export type InsertPaymentChangeHistory = typeof paymentChangeHistory.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// Contatos de emergência favoritos
export const emergencyContacts = mysqlTable("emergencyContacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  relationship: varchar("relationship", { length: 50 }),
  isPrimary: boolean("isPrimary").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type InsertEmergencyContact = typeof emergencyContacts.$inferInsert;
