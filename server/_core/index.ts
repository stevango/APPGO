import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { sendOverdueReminders } from "../billing";
import { ingestTelemetry } from "../telemetry";
import { syncGo360 } from "../integrations/go360";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Baseline security headers (safe defaults; no CSP to avoid breaking maps/fonts).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
    next();
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Scheduled job endpoint (call daily from a scheduler, e.g. Railway Cron):
  //   GET /api/cron/billing-reminders?token=CRON_SECRET
  app.get("/api/cron/billing-reminders", async (req, res) => {
    const token = (req.query.token as string) || (req.headers["x-cron-secret"] as string);
    if (!ENV.cronSecret || token !== ENV.cronSecret) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const result = await sendOverdueReminders();
      res.json({ ok: true, ...result });
    } catch (error) {
      console.error("[Cron] billing-reminders failed", error);
      res.status(500).json({ error: "failed" });
    }
  });

  // GO360 sync (pull): fetch positions from the GO360 API and feed the app.
  //   GET /api/cron/go360-sync?token=CRON_SECRET[&debug=1]
  // Schedule it (e.g. every 1-2 min). debug=1 returns the raw first record so we
  // can confirm the field mapping against the real API response.
  app.get("/api/cron/go360-sync", async (req, res) => {
    const token = (req.query.token as string) || (req.headers["x-cron-secret"] as string);
    if (!ENV.cronSecret || token !== ENV.cronSecret) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const result = await syncGo360({ debug: req.query.debug === "1" });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      console.error("[GO360] sync failed", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Real tracker telemetry ingestion (Fase 3). The tracker platform/hardware
  // POSTs position + telemetry here, authenticated by INGEST_API_KEY.
  //   POST /api/ingest/telemetry   header: x-api-key: INGEST_API_KEY
  //   body: { trackerSerial|imei, latitude, longitude, speed, batteryMain, ... }
  app.post("/api/ingest/telemetry", async (req, res) => {
    const key = (req.headers["x-api-key"] as string) || (req.query.key as string);
    if (!ENV.ingestApiKey || key !== ENV.ingestApiKey) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const result = await ingestTelemetry(req.body ?? {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      console.error("[Ingest] telemetry failed", error);
      res.status(500).json({ error: "failed" });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production (e.g. Railway), bind to the injected PORT directly so the
  // platform can route to us. Only scan for a free port during local dev.
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
