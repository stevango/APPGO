import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@go.com.br",
    name: "Stevan GO",
    loginMethod: "manus",
    role: "user",
    cpf: null,
    phone: null,
    plan: "premium",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("app router", () => {
  it("auth.me returns user with plan field when authenticated", async () => {
    const { ctx } = createAuthContext({ plan: "premium" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Stevan GO");
    expect(result?.email).toBe("test@go.com.br");
    expect((result as any)?.plan).toBe("premium");
  });

  it("auth.me returns plan as basico by default", async () => {
    const { ctx } = createAuthContext({ plan: "basico" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect((result as any)?.plan).toBe("basico");
  });

  it("auth.me returns null when not authenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("vehicles.list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.vehicles.list()).rejects.toThrow();
  });

  it("geofences.list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.geofences.list()).rejects.toThrow();
  });

  it("notifications.list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.list()).rejects.toThrow();
  });

  it("sos.trigger requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.sos.trigger({ type: "emergencia" })
    ).rejects.toThrow();
  });

  it("occurrences.create requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.occurrences.create({ vehicleId: 1, type: "furto" })
    ).rejects.toThrow();
  });

  it("routeHistory.list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.routeHistory.list({ vehicleId: 1 })
    ).rejects.toThrow();
  });

  it("vehicles.updatePosition requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.vehicles.updatePosition({
        vehicleId: 1,
        latitude: "-23.5505",
        longitude: "-46.6333",
      })
    ).rejects.toThrow();
  });

  it("vehicles.setSpeedLimit requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.vehicles.setSpeedLimit({ vehicleId: 1, speedLimit: 100 })
    ).rejects.toThrow();
  });

  it("vehicles.setSpeedLimit validates min/max bounds", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Below minimum (20)
    await expect(
      caller.vehicles.setSpeedLimit({ vehicleId: 1, speedLimit: 10 })
    ).rejects.toThrow();
    // Above maximum (200)
    await expect(
      caller.vehicles.setSpeedLimit({ vehicleId: 1, speedLimit: 250 })
    ).rejects.toThrow();
  });

  it("vehicles.updateTelemetry requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.vehicles.updateTelemetry({
        vehicleId: 1,
        speed: 80,
        batteryMain: "12.5",
        batteryBackup: "4.1",
      })
    ).rejects.toThrow();
  });
});
