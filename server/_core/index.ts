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
import { sendMaintenanceReminders } from "../maintenance";
import { startScheduler } from "../scheduler";
import { ingestTelemetry } from "../telemetry";
import { go360Login, go360Me, go360Equipamento, go360Contrato, go360Cobranca, go360Jornada } from "../integrations/go360";
import { getCampaignTheme } from "../integrations/campanhas";
import { go360ApiEnabled, go360Health, go360MetodosPagamento, go360PromocaoPagamento } from "../integrations/go360api";
import { sdk } from "./sdk";
import * as db from "../db";

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

  // Daily job: warn customers whose tracker stopped positioning (needs service).
  //   GET /api/cron/maintenance-reminders?token=CRON_SECRET[&days=3]
  app.get("/api/cron/maintenance-reminders", async (req, res) => {
    const token = (req.query.token as string) || (req.headers["x-cron-secret"] as string);
    if (!ENV.cronSecret || token !== ENV.cronSecret) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const days = req.query.days ? Math.max(1, parseInt(String(req.query.days), 10)) : undefined;
      const result = await sendMaintenanceReminders(days);
      res.json({ ok: true, ...result });
    } catch (error) {
      console.error("[Cron] maintenance-reminders failed", error);
      res.status(500).json({ error: "failed" });
    }
  });

  // GO360 discovery probe: logs in with a test customer and dumps the real
  // response shapes so we can finalize the UI mapping. Guarded by CRON_SECRET.
  //   GET /api/cron/go360-probe?token=CRON_SECRET&email=...&senha=...
  app.get("/api/cron/go360-probe", async (req, res) => {
    const token = (req.query.token as string) || (req.headers["x-cron-secret"] as string);
    if (!ENV.cronSecret || token !== ENV.cronSecret) { res.status(401).json({ error: "unauthorized" }); return; }
    const email = req.query.email as string;
    const senha = req.query.senha as string;
    if (!email || !senha) { res.status(400).json({ error: "email & senha required" }); return; }
    const safe = async (fn: () => Promise<any>) => { try { return await fn(); } catch (e: any) { return { error: e?.status || String(e), body: e?.body }; } };
    try {
      const login = await go360Login(email, senha);
      const t = login.token;
      const out = {
        login: { mustChangePassword: login.mustChangePassword, cliente: login.cliente },
        me: await safe(() => go360Me(t)),
        equipamento: await safe(() => go360Equipamento(t)),
        contrato: await safe(() => go360Contrato(t)),
        cobranca: await safe(() => go360Cobranca(t)),
        jornada: await safe(() => go360Jornada(t)),
      };
      res.json(out);
    } catch (e: any) {
      res.status(e?.status || 500).json({ error: "login failed", status: e?.status, body: e?.body });
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
  // Proxy autenticado da ficha técnica: serve a página da GO360 pelo nosso
  // domínio (sem X-Frame-Options/CSP que bloqueiam o iframe) para exibir DENTRO
  // do app. Só serve a URL salva no veículo do próprio usuário (não é open proxy).
  app.get("/api/ficha/:vehicleId", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) { res.status(401).send("Faça login para ver a ficha."); return; }
      const id = Number(req.params.vehicleId);
      const vehicles = await db.getUserVehicles(user.id);
      const vehicle = vehicles.find((v) => v.id === id);
      const raw = (vehicle as any)?.fichaUrl as string | undefined;
      if (!raw || !/^https?:\/\//.test(raw)) { res.status(404).send("Ficha não disponível."); return; }
      // Servimos por HTTPS; busca e referências precisam ser HTTPS (evita Mixed Content).
      const url = raw.replace(/^http:\/\//i, "https://");
      const host = new URL(url).host;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 GOApp", Accept: "text/html,*/*" }, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      const ct = upstream.headers.get("content-type") || "text/html; charset=utf-8";
      // Permite o embed no nosso próprio domínio (o middleware global já põe SAMEORIGIN).
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.setHeader("Content-Type", ct);

      if (ct.includes("text/html")) {
        let html = await upstream.text();
        const baseTag = `<base href="${url}">`; // assets/links relativos resolvem na origem (https)
        html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + baseTag) : baseTag + html;
        // Sobe os assets http→https do mesmo host (senão o navegador bloqueia por Mixed Content).
        html = html.split(`http://${host}`).join(`https://${host}`);
        res.status(upstream.status).send(html);
      } else {
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.status(upstream.status).send(buf);
      }
    } catch (e) {
      console.error("[Ficha] proxy failed", e);
      res.status(502).send("Não foi possível carregar a ficha agora.");
    }
  });

  // Resumo p/ o widget nativo (sem sessão; autenticado pelo token de widget).
  //   GET /api/widget/summary?token=WIDGET_TOKEN
  app.get("/api/widget/summary", async (req, res) => {
    try {
      const token = String(req.query.token || "");
      if (!token) { res.status(401).json({ error: "token" }); return; }
      const user = await db.getUserByWidgetToken(token);
      if (!user) { res.status(401).json({ error: "invalid" }); return; }
      const vehicles = await db.getUserVehicles(user.id);
      const v = vehicles.find((x) => !x.isDemo) ?? vehicles[0];
      if (!v) { res.json({ empty: true }); return; }
      const ageH = v.lastSignalAt ? (Date.now() - new Date(v.lastSignalAt).getTime()) / 3600000 : Infinity;
      const status = ageH >= 72 ? "offline" : ageH >= 24 ? "standby" : "online";
      res.setHeader("Cache-Control", "private, max-age=60");
      res.json({
        plate: v.plate, brand: v.brand, model: v.model, status,
        lastAddress: v.lastAddress ?? null,
        lat: v.lastLatitude ?? null, lng: v.lastLongitude ?? null,
        lastSignalAt: v.lastSignalAt ?? null,
      });
    } catch (e) {
      console.error("[Widget] summary failed", e);
      res.status(500).json({ error: "failed" });
    }
  });

  // ---- Tema de campanha vigente (sazonal, compartilhado com a GO360) --------
  //   GET /api/campanhas/tema-vigente   (público, sem auth, cache 5min)
  // Proxy same-origin do endpoint público da GO360 — evita CORS no app e
  // permite trocar a URL upstream por env sem rebuild do cliente.
  app.get("/api/campanhas/tema-vigente", async (_req, res) => {
    try {
      const theme = await getCampaignTheme();
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(theme);
    } catch (e) {
      console.error("[Campanhas] tema-vigente failed", e);
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({ vigente: false });
    }
  });

  // ---- Diagnóstico da GO360 API v1 (verifica se a GO360_API_KEY funciona) ----
  //   GET /api/diag/go360v1?token=CRON_SECRET
  // Chama /health e lista métodos com a chave — confirma conectividade + scope.
  app.get("/api/diag/go360v1", async (req, res) => {
    const token = (req.query.token as string) || (req.headers["x-cron-secret"] as string);
    if (!ENV.cronSecret || token !== ENV.cronSecret) {
      res.status(401).json({ error: "unauthorized", hint: "defina CRON_SECRET e use ?token=" });
      return;
    }
    const out: Record<string, unknown> = { keyConfigured: go360ApiEnabled() };
    if (!go360ApiEnabled()) {
      res.json({ ...out, ok: false, hint: "GO360_API_KEY não está definida no backend." });
      return;
    }
    try {
      out.healthOk = await go360Health();
      const metodos = await go360MetodosPagamento();
      out.metodosCount = metodos.length;
      out.metodos = metodos.map((m) => ({ codigo: m.codigo, nome: m.nome, badge: m.badge }));
      const promo = await go360PromocaoPagamento("boleto");
      out.promocaoBoleto = promo.promocao ? { id: promo.promocao.id, destino: promo.promocao.metodoDestino, beneficios: promo.beneficios.length } : null;
      res.json({ ...out, ok: out.healthOk === true });
    } catch (e: any) {
      res.json({ ...out, ok: false, error: e?.message || String(e), status: e?.status });
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
    // Daily reminders (cobrança + manutenção) run in-process in production.
    if (process.env.NODE_ENV === "production") startScheduler();
  });
}

startServer().catch(console.error);
