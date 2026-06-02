/**
 * Demo mode — a simulated vehicle that drives a loop in real time with
 * realistic telemetry. Lets the product be fully showcased (tracking, route,
 * alerts, geofences) without real tracker hardware.
 *
 * Position is a pure function of time, so the vehicle keeps "moving" whenever
 * the app reads/ticks — no always-on background job required.
 */
import * as db from "./db";

// A driveable loop around Av. Paulista / Jardins, São Paulo. [lat, lng]
const ROUTE: Array<[number, number]> = [
  [-23.561414, -46.655881],
  [-23.563900, -46.652000],
  [-23.566800, -46.648200],
  [-23.569900, -46.644300],
  [-23.568500, -46.640000],
  [-23.565000, -46.639000],
  [-23.561000, -46.641000],
  [-23.558500, -46.645000],
  [-23.557500, -46.650000],
  [-23.559000, -46.654500],
  [-23.561414, -46.655881],
];

const FULL_LOOP_MS = 6 * 60 * 1000; // a full lap every ~6 minutes
const DEG2RAD = Math.PI / 180;

function haversineKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const y = Math.sin((lon2 - lon1) * DEG2RAD) * Math.cos(lat2 * DEG2RAD);
  const x =
    Math.cos(lat1 * DEG2RAD) * Math.sin(lat2 * DEG2RAD) -
    Math.sin(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.cos((lon2 - lon1) * DEG2RAD);
  return (Math.atan2(y, x) / DEG2RAD + 360) % 360;
}

const SEGMENTS = (() => {
  const segs: Array<{ from: [number, number]; to: [number, number]; len: number; acc: number }> = [];
  let acc = 0;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const len = haversineKm(ROUTE[i], ROUTE[i + 1]);
    segs.push({ from: ROUTE[i], to: ROUTE[i + 1], len, acc });
    acc += len;
  }
  return { segs, total: acc };
})();

export type LivePosition = {
  latitude: string;
  longitude: string;
  speed: number;
  heading: number;
};

/** Current simulated position derived purely from the clock. */
export function livePosition(now: number = Date.now()): LivePosition {
  const frac = (now % FULL_LOOP_MS) / FULL_LOOP_MS;
  const target = frac * SEGMENTS.total;

  let seg = SEGMENTS.segs[SEGMENTS.segs.length - 1];
  for (const s of SEGMENTS.segs) {
    if (target >= s.acc && target < s.acc + s.len) {
      seg = s;
      break;
    }
  }
  const f = seg.len > 0 ? (target - seg.acc) / seg.len : 0;
  const lat = seg.from[0] + (seg.to[0] - seg.from[0]) * f;
  const lng = seg.from[1] + (seg.to[1] - seg.from[1]) * f;
  const heading = bearingDeg(seg.from, seg.to);

  // Speed ebbs and flows like city traffic (occasional near-stops at "lights").
  const wave = Math.sin(frac * Math.PI * 16);
  const speed = Math.max(0, Math.round(38 + wave * 28));

  return {
    latitude: lat.toFixed(7),
    longitude: lng.toFixed(7),
    speed,
    heading: Math.round(heading),
  };
}

/** Full telemetry snapshot for the demo vehicle at a given time. */
export function liveTelemetry(now: number = Date.now()) {
  const pos = livePosition(now);
  const batteryMain = (12.6 + Math.sin(now / 300000) * 0.4).toFixed(2);
  return {
    ...pos,
    ignition: pos.speed > 3,
    batteryMain,
    batteryBackup: "4.1",
    gpsSatellites: 9 + (Math.floor(now / 12000) % 4),
    gpsSignal: 82,
    trackerMode: "active" as const,
    simStatus: "active" as const,
    simSignal: 88,
  };
}

/**
 * Seed a demo vehicle (and supporting data) for a user if they don't have one.
 * Returns the demo vehicle id.
 */
export async function seedDemoVehicle(userId: number): Promise<number> {
  const existing = await db.getUserDemoVehicle(userId);
  if (existing) return existing.id;

  const now = Date.now();
  const t = liveTelemetry(now);

  await db.createVehicle({
    userId,
    plate: "GOD3M0",
    model: "Onix Plus",
    brand: "Chevrolet",
    color: "Prata",
    year: 2023,
    isDemo: true,
    iconType: "car",
    trackerStatus: "online",
    ignition: t.ignition,
    blocked: false,
    lastLatitude: t.latitude,
    lastLongitude: t.longitude,
    lastAddress: "Avenida Paulista, São Paulo - SP",
    speed: t.speed,
    heading: t.heading,
    odometer: "45231.00",
    hourmeter: "1240.5",
    batteryMain: t.batteryMain,
    batteryBackup: t.batteryBackup,
    batteryLevel: 100,
    gpsSatellites: t.gpsSatellites,
    gpsSignal: t.gpsSignal,
    trackerMode: "active",
    trackerModel: "ST310U",
    trackerSerial: "DEMO-0001",
    simStatus: "active",
    simSignal: t.simSignal,
    speedLimit: 80,
  });

  const vehicle = await db.getUserDemoVehicle(userId);
  if (!vehicle) throw new Error("Failed to create demo vehicle");
  const vehicleId = vehicle.id;

  // Seed an initial route trail (so "Rota" shows immediately).
  for (let i = 0; i < 24; i++) {
    const p = livePosition(now - (24 - i) * 15000);
    await db.addRoutePoint({
      vehicleId,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed,
      heading: p.heading,
    });
  }

  // Geofences
  await db.createGeofence({
    userId, vehicleId, name: "Casa", type: "casa",
    latitude: "-23.561414", longitude: "-46.655881", radius: 250,
    active: true, alertOnEntry: true, alertOnExit: true,
  });
  await db.createGeofence({
    userId, vehicleId, name: "Trabalho", type: "trabalho",
    latitude: "-23.569900", longitude: "-46.644300", radius: 300,
    active: true, alertOnEntry: true, alertOnExit: true,
  });

  // Notifications
  const notif = [
    { type: "cerca_saida" as const, title: "Saída da cerca: Casa", message: "O veículo saiu da área 'Casa' às 08:12.", read: false },
    { type: "velocidade_excessiva" as const, title: "Velocidade excessiva", message: "Veículo atingiu 92 km/h (limite 80 km/h).", read: false },
    { type: "cerca_entrada" as const, title: "Entrada na cerca: Trabalho", message: "O veículo chegou em 'Trabalho' às 08:39.", read: true },
    { type: "sistema" as const, title: "Bem-vindo ao GO!", message: "Modo demonstração ativo. Acompanhe o veículo em tempo real.", read: true },
  ];
  for (const n of notif) {
    await db.createNotification({ userId, vehicleId, ...n });
  }

  // Trips (last few days)
  const day = 24 * 60 * 60 * 1000;
  const trips = [
    { startedAt: new Date(now - 1 * day - 3600000), endedAt: new Date(now - 1 * day - 1800000), startAddress: "Casa - Av. Paulista", endAddress: "Trabalho - Jardins", distanceKm: "8.40", maxSpeed: 78, avgSpeed: 32 },
    { startedAt: new Date(now - 2 * day - 7200000), endedAt: new Date(now - 2 * day - 5400000), startAddress: "Trabalho - Jardins", endAddress: "Shopping - Pinheiros", distanceKm: "12.10", maxSpeed: 89, avgSpeed: 41 },
    { startedAt: new Date(now - 3 * day - 3600000), endedAt: new Date(now - 3 * day - 2100000), startAddress: "Casa - Av. Paulista", endAddress: "Aeroporto - Congonhas", distanceKm: "15.70", maxSpeed: 95, avgSpeed: 38 },
  ];
  for (const tr of trips) {
    await db.createTrip({
      vehicleId,
      startedAt: tr.startedAt,
      endedAt: tr.endedAt,
      startAddress: tr.startAddress,
      endAddress: tr.endAddress,
      startLatitude: "-23.561414", startLongitude: "-46.655881",
      endLatitude: "-23.569900", endLongitude: "-46.644300",
      distanceKm: tr.distanceKm,
      maxSpeed: tr.maxSpeed,
      avgSpeed: tr.avgSpeed,
    });
  }

  // Emergency contact
  await db.createEmergencyContact({
    userId, name: "Central GO (demo)", phone: "+5511999999999",
    email: "central@godirection.app", relationship: "Assistência", isPrimary: true,
  });

  // Extra demo assets to show the GO tracks anything: a pet and an instrument.
  await db.createVehicle({
    userId, plate: "REX", model: "Golden Retriever", brand: "Pet", color: "Caramelo",
    isDemo: true, iconType: "dog", trackerStatus: "online", ignition: false,
    lastLatitude: "-23.587400", lastLongitude: "-46.657600",
    lastAddress: "Parque Ibirapuera, São Paulo - SP",
    speed: 0, heading: 0, batteryMain: "12.40", batteryBackup: "4.1", batteryLevel: 92,
    gpsSatellites: 8, gpsSignal: 75, trackerMode: "active",
    trackerModel: "GO-PET", trackerSerial: "PET-REX-01", simStatus: "active", simSignal: 80,
    speedLimit: 80,
  });
  await db.createVehicle({
    userId, plate: "GTR-001", model: "Stratocaster", brand: "Fender", color: "Sunburst",
    isDemo: true, iconType: "guitarra", trackerStatus: "online", ignition: false,
    lastLatitude: "-23.561100", lastLongitude: "-46.642000",
    lastAddress: "Estúdio - Bela Vista, São Paulo - SP",
    speed: 0, heading: 0, batteryMain: "12.60", batteryBackup: "4.1", batteryLevel: 100,
    gpsSatellites: 7, gpsSignal: 70, trackerMode: "sleep",
    trackerModel: "GO-TAG", trackerSerial: "TAG-GTR-01", simStatus: "active", simSignal: 72,
    speedLimit: 80,
  });

  return vehicleId;
}

/** Advance the moving demo asset (the car) to its current simulated position. */
export async function tickDemoVehicle(userId: number): Promise<LivePosition | null> {
  const demos = await db.getUserDemoVehicles(userId);
  const vehicle = demos.find((v) => v.iconType === "car") ?? demos[0];
  if (!vehicle) return null;

  const t = liveTelemetry(Date.now());
  await db.updateVehicleTelemetry(vehicle.id, {
    latitude: t.latitude,
    longitude: t.longitude,
    speed: t.speed,
    heading: t.heading,
    ignition: t.ignition,
    batteryMain: t.batteryMain,
    batteryBackup: t.batteryBackup,
    gpsSatellites: t.gpsSatellites,
    gpsSignal: t.gpsSignal,
    trackerMode: t.trackerMode,
    simStatus: t.simStatus,
    simSignal: t.simSignal,
  });
  await db.addRoutePoint({
    vehicleId: vehicle.id,
    latitude: t.latitude,
    longitude: t.longitude,
    speed: t.speed,
    heading: t.heading,
  });
  return { latitude: t.latitude, longitude: t.longitude, speed: t.speed, heading: t.heading };
}
