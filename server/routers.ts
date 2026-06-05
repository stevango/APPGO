import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import * as db from "./db";
import { hashPassword, verifyPassword, generateEmailOpenId, issueSessionCookie } from "./auth";
import { rateLimit, getClientIp } from "./rateLimit";
import { seedDemoVehicle, tickDemoVehicle } from "./demo";

// Auth abuse protection (per-instance, in-memory).
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min
const REGISTER_MAX = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type Go360Result<T> = { ok: true; data: T } | { ok: false; reason: "no_token" | "unavailable" };

/**
 * Calls a GO360 endpoint tolerantly: real auth failures (401/403) force a
 * re-login, but anything else (endpoint not ready yet, 404, 5xx, network) is
 * returned as { ok:false } so the app degrades gracefully instead of breaking.
 */
async function withGo360Token<T>(ctx: any, fn: (token: string) => Promise<T>): Promise<Go360Result<T>> {
  const token = ctx?.user?.go360Token as string | undefined;
  if (!token) return { ok: false, reason: "no_token" };
  try {
    return { ok: true, data: await fn(token) };
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão GO360 expirada. Entre novamente." });
    }
    console.warn("[GO360] endpoint indisponível", err?.status, err?.body);
    return { ok: false, reason: "unavailable" };
  }
}

function enforceRateLimit(key: string, max: number, windowMs: number) {
  const { allowed, retryAfterMs } = rateLimit(key, { max, windowMs });
  if (!allowed) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Muitas tentativas. Tente novamente em ${minutes} min.`,
    });
  }
}
import { notifyOwner } from "./_core/notification";
import { registerPushSubscription, unregisterPushSubscription, sendPushToUser } from "./pushService";
import { reverseGeocode, searchAddress } from "./geocode";
import { processTelemetry } from "./telemetry";
import { go360Enabled, go360Login, go360Me, go360Equipamento, go360Contrato, go360Cobranca, go360Jornada, go360FirstAccess, syncGo360Equipment, go360Historico } from "./integrations/go360";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2, "Informe seu nome").max(120),
        email: z.string().trim().toLowerCase().email("E-mail inválido"),
        password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        enforceRateLimit(`register:${getClientIp(ctx.req)}`, REGISTER_MAX, REGISTER_WINDOW_MS);
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });
        }
        const passwordHash = await hashPassword(input.password);
        const openId = generateEmailOpenId();
        const user = await db.createUserWithPassword({
          openId,
          name: input.name,
          email: input.email,
          passwordHash,
        });
        if (!user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar a conta." });
        }
        await issueSessionCookie(ctx.req, ctx.res, user);
        return { success: true } as const;
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().trim().toLowerCase().email("E-mail inválido"),
        password: z.string().min(1, "Informe sua senha"),
      }))
      .mutation(async ({ ctx, input }) => {
        enforceRateLimit(`login:${getClientIp(ctx.req)}:${input.email}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
        enforceRateLimit(`login-ip:${getClientIp(ctx.req)}`, LOGIN_MAX_ATTEMPTS * 5, LOGIN_WINDOW_MS);

        // When GO360 is enabled, it is the source of truth for authentication.
        if (go360Enabled()) {
          try {
            const r = await go360Login(input.email, input.password);
            const user = await db.upsertGo360User({ clienteId: r.cliente.id, name: r.cliente.nome ?? null, email: r.cliente.email ?? input.email });
            if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao sincronizar usuário." });
            await db.setUserGo360Token(user.id, r.token);
            // Best-effort: sync the customer's vehicles/equipment right away.
            await syncGo360Equipment(user.id, r.token).catch((e) => console.warn("[GO360] equip sync (login)", e?.status));
            await issueSessionCookie(ctx.req, ctx.res, user);
            return { success: true, mustChangePassword: r.mustChangePassword ?? false } as const;
          } catch (err: any) {
            if (err?.status === 401) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
            if (err?.status === 403) throw new TRPCError({ code: "FORBIDDEN", message: "Conta suspensa. Fale com a central." });
            console.error("[GO360] login error", err?.status, err?.body);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível entrar agora. Tente novamente." });
          }
        }

        // Local email/password (demo / GO360 disabled)
        const user = await db.getUserByEmail(input.email);
        const ok = await verifyPassword(input.password, user?.passwordHash ?? null);
        if (!user || !ok) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
        }
        await issueSessionCookie(ctx.req, ctx.res, user);
        return { success: true, mustChangePassword: false } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  account: router({
    setAddress: protectedProcedure
      .input(z.object({
        address: z.string().trim().min(3).max(300),
        lat: z.string().optional(),
        lng: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.setUserAddress(ctx.user.id, { address: input.address, lat: input.lat ?? null, lng: input.lng ?? null });
        return { success: true } as const;
      }),
    // LGPD / app-store requirement: lets the user permanently delete their
    // account and all associated data, then ends the session.
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteUserAccount(ctx.user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  demo: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const vehicle = await db.getUserDemoVehicle(ctx.user.id);
      return { enabled: !!vehicle, vehicleId: vehicle?.id ?? null };
    }),
    enable: protectedProcedure.mutation(async ({ ctx }) => {
      const vehicleId = await seedDemoVehicle(ctx.user.id);
      return { success: true, vehicleId } as const;
    }),
    disable: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteDemoVehicleData(ctx.user.id);
      return { success: true } as const;
    }),
    // Advances the simulated vehicle; called periodically by the client while
    // a map screen is open so the marker and route move in real time.
    tick: protectedProcedure.mutation(async ({ ctx }) => {
      const pos = await tickDemoVehicle(ctx.user.id);
      return { success: !!pos, position: pos } as const;
    }),
  }),

  feedback: router({
    submit: protectedProcedure
      .input(z.object({
        rating: z.number().int().min(1).max(5),
        message: z.string().trim().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createAppFeedback({ userId: ctx.user.id, rating: input.rating, message: input.message });
        // Let the ops team see suggestions as they arrive (best-effort).
        notifyOwner({
          title: `Avaliação do app: ${input.rating}★`,
          content: `${ctx.user.name || "Cliente"} (${ctx.user.email || "sem e-mail"}) avaliou com ${input.rating}★.${input.message ? `\nSugestão: ${input.message}` : ""}`,
        }).catch(() => {});
        return { success: true } as const;
      }),
  }),

  retention: router({
    // Logs each step of the cancellation save flow. When the customer accepts a
    // retention offer or asks for support, the ops team is notified to follow up.
    logEvent: protectedProcedure
      .input(z.object({
        reason: z.string().max(60).optional(),
        action: z.enum(["offer_shown", "offer_accepted", "support", "cancelled"]),
        offer: z.string().max(160).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createRetentionEvent({ userId: ctx.user.id, reason: input.reason ?? null, action: input.action, offer: input.offer ?? null });
        if (input.action === "offer_accepted") {
          notifyOwner({
            title: "🟢 Retenção: oferta aceita",
            content: `${ctx.user.name || "Cliente"} (${ctx.user.email || "sem e-mail"}) aceitou: ${input.offer || "(oferta)"}${input.reason ? `\nMotivo: ${input.reason}` : ""}. Aplicar/seguir contato.`,
          }).catch(() => {});
          await db.createNotification({
            userId: ctx.user.id,
            type: "sistema",
            title: "Recebemos seu pedido 💙",
            message: `Que bom que você fica com a gente! Nossa equipe vai aplicar "${input.offer}" e, se precisar, entrar em contato.`,
          });
        } else if (input.action === "cancelled") {
          notifyOwner({
            title: "🔴 Cliente cancelou",
            content: `${ctx.user.name || "Cliente"} (${ctx.user.email || "sem e-mail"}) excluiu a conta.${input.reason ? `\nMotivo: ${input.reason}` : ""}`,
          }).catch(() => {});
        }
        return { success: true } as const;
      }),
  }),

  help: router({
    // Logs questions asked to the in-app assistant so the knowledge base can be
    // improved over time (especially the ones that didn't match).
    logQuery: publicProcedure
      .input(z.object({ query: z.string().trim().min(1).max(500), matched: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await db.createHelpQuery({ userId: ctx.user?.id ?? null, query: input.query, matched: input.matched });
        return { success: true } as const;
      }),
  }),

  legal: router({
    consents: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserConsents(ctx.user.id);
    }),
    accept: protectedProcedure
      .input(z.object({
        docType: z.enum(["termos_uso", "privacidade_lgpd", "confidencialidade"]),
        version: z.string().min(1).max(20),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createConsentLog({
          userId: ctx.user.id,
          docType: input.docType,
          version: input.version,
          ipAddress: getClientIp(ctx.req),
          userAgent: (ctx.req.headers["user-agent"] as string) || null,
        });
        return { success: true } as const;
      }),
  }),

  contract: router({
    // Returns the user's contract (creates a pending one if none). DocuSign
    // integration will later populate envelopeId/documentUrl/signedAt.
    get: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrCreateUserContract(ctx.user.id);
    }),
  }),

  geo: router({
    // Address / CEP autocomplete for the location picker (ViaCEP + Nominatim).
    search: protectedProcedure
      .input(z.object({ query: z.string().trim().min(3).max(160) }))
      .query(async ({ input }) => {
        return searchAddress(input.query);
      }),
  }),

  // Real customer data proxied from the GO360 portal API (when enabled).
  go360: router({
    status: publicProcedure.query(() => ({ enabled: go360Enabled() })),
    firstAccess: publicProcedure
      .input(z.object({
        email: z.string().trim().toLowerCase().email(),
        senhaTemp: z.string().min(1),
        novaSenha: z.string().min(8),
        aceites: z.array(z.enum(["lgpd", "termos", "privacidade"])).min(3),
      }))
      .mutation(async ({ input }) => {
        await go360FirstAccess(input);
        return { success: true } as const;
      }),
    me: protectedProcedure.query(({ ctx }) => withGo360Token(ctx, go360Me)),
    equipamento: protectedProcedure.query(({ ctx }) => withGo360Token(ctx, go360Equipamento)),
    // Re-sync the customer's vehicles/equipment from GO360 into our app.
    syncEquipment: protectedProcedure.mutation(async ({ ctx }) => {
      const token = (ctx.user as any)?.go360Token as string | undefined;
      if (!token) return { ok: false, synced: 0 } as const;
      try {
        const r = await syncGo360Equipment(ctx.user.id, token);
        return { ok: true, synced: r.synced } as const;
      } catch (e: any) {
        if (e?.status === 401 || e?.status === 403) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão GO360 expirada." });
        return { ok: false, synced: 0 } as const;
      }
    }),
    contrato: protectedProcedure.query(({ ctx }) => withGo360Token(ctx, go360Contrato)),
    cobranca: protectedProcedure.query(({ ctx }) => withGo360Token(ctx, go360Cobranca)),
    jornada: protectedProcedure.query(({ ctx }) => withGo360Token(ctx, go360Jornada)),
    // Position history (route) for a vehicle, from GO360.
    historico: protectedProcedure
      .input(z.object({ vehicleId: z.number(), desde: z.string().optional(), ate: z.string().optional(), limit: z.number().min(1).max(500).optional() }))
      .query(async ({ ctx, input }) => {
        const token = (ctx.user as any)?.go360Token as string | undefined;
        const vehicle = await db.getVehicleById(input.vehicleId);
        const ativoId = (vehicle as any)?.go360AtivoId as string | undefined;
        if (!token || !ativoId || vehicle?.userId !== ctx.user.id) return { ok: false as const, points: [] };
        try {
          const resp: any = await go360Historico(token, ativoId, { desde: input.desde, ate: input.ate, limit: input.limit });
          const arr: any[] = Array.isArray(resp?.posicoes) ? resp.posicoes : Array.isArray(resp) ? resp : [];
          const points = arr
            .map((p) => ({
              latitude: Number(p.latitude ?? p.lat),
              longitude: Number(p.longitude ?? p.lng ?? p.lon),
              speed: Number(p.velocidade ?? p.speed ?? 0),
              heading: Number(p.direcao_graus ?? p.heading ?? 0),
              ignition: Boolean(p.ignicao ?? p.ignition),
              address: p.endereco ?? p.address ?? null,
              at: p.data ?? p.evento_em ?? p.capturado_em ?? null,
            }))
            .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
          return { ok: true as const, points, total: resp?.total ?? points.length };
        } catch (e: any) {
          if (e?.status === 401 || e?.status === 403) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão GO360 expirada." });
          return { ok: false as const, points: [] };
        }
      }),
  }),

  // Avisos críticos: ciência do cliente ("Estou ciente") e histórico/auditoria.
  alerts: router({
    // Histórico de avisos enviados ao cliente (transparência + prova de envio).
    history: protectedProcedure.query(async ({ ctx }) => {
      return db.getAlertHistory(ctx.user.id);
    }),
    // Estado do botão "Estou ciente" para um veículo/tipo.
    lastAck: protectedProcedure
      .input(z.object({ vehicleId: z.number(), type: z.string().default("manutencao") }))
      .query(async ({ ctx, input }) => {
        const ack = await db.getLatestAlertAck(ctx.user.id, input.vehicleId, input.type);
        return ack ?? null;
      }),
    // Registra a ciência do cliente sobre o alerta crítico.
    acknowledge: protectedProcedure
      .input(z.object({ vehicleId: z.number(), type: z.string().default("manutencao"), daysStale: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const vehicle = await db.getVehicleById(input.vehicleId);
        if (!vehicle || vehicle.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Veículo não pertence ao usuário." });
        }
        const ip = getClientIp(ctx.req) || null;
        const userAgent = String(ctx.req.headers?.["user-agent"] ?? "").slice(0, 255) || null;
        await db.createAlertAck({
          userId: ctx.user.id, vehicleId: input.vehicleId, type: input.type,
          daysAtAck: input.daysStale ?? null, ip, userAgent,
        });
        await db.logNotificationDispatch({
          userId: ctx.user.id, vehicleId: input.vehicleId, type: `${input.type}_ciente`,
          channel: "inapp", severity: "info",
          title: "Cliente marcou ciência", message: `Ciência registrada${input.daysStale != null ? ` (${input.daysStale} dias sem posicionar)` : ""}.`,
          meta: { ip, userAgent },
        });
        return { ok: true };
      }),
  }),

  vehicles: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserVehicles(ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getVehicleById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      plate: z.string(),
      model: z.string(),
      brand: z.string().optional(),
      color: z.string().optional(),
      year: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.createVehicle({
        userId: ctx.user.id,
        plate: input.plate,
        model: input.model,
        brand: input.brand,
        color: input.color,
        year: input.year,
      });
      return { success: true };
    }),
    updatePosition: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      latitude: z.string(),
      longitude: z.string(),
      address: z.string().optional(),
      speed: z.number().optional(),
      heading: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updateVehiclePosition(input.vehicleId, {
        latitude: input.latitude,
        longitude: input.longitude,
        address: input.address,
      });
      await db.addRoutePoint({
        vehicleId: input.vehicleId,
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed,
        heading: input.heading,
        address: input.address,
      });
      return { success: true };
    }),
    updateTelemetry: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      address: z.string().optional(),
      speed: z.number().optional(),
      heading: z.number().optional(),
      odometer: z.string().optional(),
      hourmeter: z.string().optional(),
      batteryMain: z.string().optional(),
      batteryBackup: z.string().optional(),
      ignition: z.boolean().optional(),
      gpsSatellites: z.number().optional(),
      gpsSignal: z.number().optional(),
      trackerMode: z.enum(["active", "sleep", "deep_sleep", "emergency"]).optional(),
      simStatus: z.enum(["active", "inactive", "no_signal"]).optional(),
      simSignal: z.number().optional(),
      trackerModel: z.string().optional(),
      trackerSerial: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { vehicleId, ...data } = input;
      await processTelemetry(ctx.user.id, vehicleId, data);
      return { success: true };
    }),
    setSpeedLimit: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      speedLimit: z.number().min(20).max(200),
    })).mutation(async ({ input }) => {
      await db.updateVehicleSpeedLimit(input.vehicleId, input.speedLimit);
      return { success: true };
    }),
    setIconType: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      iconType: z.string().min(1).max(32),
    })).mutation(async ({ ctx, input }) => {
      await db.updateVehicleIconType(input.vehicleId, ctx.user.id, input.iconType);
      return { success: true };
    }),
    block: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      action: z.enum(["block", "unblock"]),
      termsAccepted: z.boolean(),
      reason: z.string().optional(),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      // Exigir aceite dos termos para bloquear
      if (input.action === "block" && !input.termsAccepted) {
        throw new Error("Você deve aceitar os termos de responsabilidade para bloquear o veículo.");
      }
      // Buscar dados atuais do veículo para registrar no log
      const vehicle = await db.getVehicleById(input.vehicleId);
      const blocked = input.action === "block";
      await db.updateVehicleBlock(input.vehicleId, blocked);
      const logResult = await db.createBlockLog({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        action: input.action,
        termsAcceptedAt: input.termsAccepted ? new Date() : undefined,
        ipAddress: input.ipAddress || (ctx.req.headers["x-forwarded-for"] as string) || ctx.req.socket.remoteAddress || null,
        userAgent: input.userAgent || (ctx.req.headers["user-agent"] as string) || null,
        reason: input.reason || null,
        vehicleSpeed: vehicle?.speed || 0,
        vehicleIgnition: vehicle?.ignition || false,
      });
      // Simulate command processing
      const logId = (logResult as any)[0]?.insertId;
      if (logId) {
        await db.updateBlockLogStatus(logId, "confirmed");
      }
      // Create notification
      await db.createNotification({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        type: blocked ? "bloqueio" : "desbloqueio",
        title: blocked ? "Veículo bloqueado" : "Veículo desbloqueado",
        message: blocked ? "O bloqueio do veículo foi confirmado com sucesso." : "O desbloqueio do veículo foi confirmado com sucesso.",
      });
      return { success: true, status: "confirmed" };
    }),
    // Registrar aceite de termos independente (antes de confirmar bloqueio)
    acceptBlockTerms: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.createBlockLog({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        action: "block",
        termsAcceptedAt: new Date(),
        ipAddress: input.ipAddress || (ctx.req.headers["x-forwarded-for"] as string) || ctx.req.socket.remoteAddress || null,
        userAgent: input.userAgent || (ctx.req.headers["user-agent"] as string) || null,
        reason: "Aceite de termos de responsabilidade (sem comando enviado)",
        vehicleSpeed: 0,
        vehicleIgnition: false,
      });
      return { success: true };
    }),
    // Histórico de comandos de bloqueio com paginação
    blockHistory: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      page: z.number().default(1),
      limit: z.number().default(20),
    })).query(async ({ ctx, input }) => {
      return db.getBlockHistory(input.vehicleId, ctx.user.id, input.page, input.limit);
    }),
  }),

  geofences: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserGeofences(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      name: z.string(),
      type: z.enum(["casa", "trabalho", "escola", "oficina", "garagem", "cidade", "personalizada"]).optional(),
      latitude: z.string(),
      longitude: z.string(),
      radius: z.number().optional(),
      alertOnEntry: z.boolean().optional(),
      alertOnExit: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.createGeofence({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        name: input.name,
        type: input.type || "personalizada",
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radius || 200,
        alertOnEntry: input.alertOnEntry ?? true,
        alertOnExit: input.alertOnExit ?? true,
      });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteGeofence(input.id);
      return { success: true };
    }),
  }),

  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserNotifications(ctx.user.id);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.markNotificationRead(input.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  occurrences: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserOccurrences(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      type: z.enum(["furto", "roubo", "apropriacao", "golpe", "outro"]),
      description: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      address: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const protocol = `GO${Date.now().toString(36).toUpperCase()}${nanoid(4).toUpperCase()}`;
      await db.createOccurrence({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        type: input.type,
        protocol,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        address: input.address,
      });
      // Create notification
      await db.createNotification({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        type: "furto_roubo",
        title: "Ocorrência registrada",
        message: `Protocolo ${protocol} - ${input.type.charAt(0).toUpperCase() + input.type.slice(1)} comunicado. Central GO acionada.`,
      });
      // Notify Central GO (owner)
      let centralNotified = false;
      try {
        centralNotified = await notifyOwner({
          title: `🚨 ALERTA: ${input.type.toUpperCase()} - Protocolo ${protocol}`,
          content: `Ocorrência de ${input.type} registrada pelo cliente ${ctx.user.name || ctx.user.openId}.\nVeículo ID: ${input.vehicleId}\nDescrição: ${input.description || 'Não informada'}\nProtocolo: ${protocol}`,
        });
      } catch (e) {
        console.warn('[Occurrences] Failed to notify central:', e);
      }
      return { success: true, protocol, centralNotified };
    }),
  }),

  routeHistory: router({
    list: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      limit: z.number().optional(),
    })).query(async ({ input }) => {
      return db.getVehicleRouteHistory(input.vehicleId, input.limit || 50);
    }),
  }),

  trips: router({
    list: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      limit: z.number().optional(),
    })).query(async ({ input }) => {
      return db.getVehicleTrips(input.vehicleId, input.limit || 30);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getTripById(input.id);
    }),
    getRoutePoints: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      startedAt: z.date(),
      endedAt: z.date(),
    })).query(async ({ input }) => {
      return db.getTripRoutePoints(input.vehicleId, input.startedAt, input.endedAt);
    }),
  }),

  sos: router({
    trigger: protectedProcedure.input(z.object({
      vehicleId: z.number().optional(),
      type: z.enum(["furto_roubo", "acidente", "pane", "guincho", "chaveiro", "pneu", "bateria", "pane_seca", "emergencia", "central"]),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.createSosAlert({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        type: input.type,
        latitude: input.latitude,
        longitude: input.longitude,
      });
      await db.createNotification({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        type: "sos",
        title: "SOS Acionado",
        message: `Alerta de emergência (${input.type}) enviado para a Central GO.`,
      });
      return { success: true };
    }),
    cancel: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await db.cancelSosAlert(ctx.user.id);
      if (result.cancelled) {
        await db.createNotification({
          userId: ctx.user.id,
          type: "sos",
          title: "SOS Cancelado",
          message: "O acionamento de emergência foi cancelado pelo usuário.",
        });
      }
      return result;
    }),
    reverseGeocode: protectedProcedure.input(z.object({
      latitude: z.string(),
      longitude: z.string(),
    })).query(async ({ input }) => {
      try {
        const address = await reverseGeocode(input.latitude, input.longitude);
        if (address) {
          return { success: true, address };
        }
        return { success: false, address: null, error: "ZERO_RESULTS" };
      } catch (error) {
        console.error("[Reverse Geocode] Error:", error);
        return { success: false, address: null, error: "Failed to geocode" };
      }
    }),
  }),

  push: router({
    register: protectedProcedure.input(z.object({
      endpoint: z.string(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
    })).mutation(async ({ ctx, input }) => {
      const userAgent = (ctx.req.headers["user-agent"] as string) || undefined;
      const id = await registerPushSubscription(
        ctx.user.id,
        { endpoint: input.endpoint, keys: input.keys },
        userAgent
      );
      return { success: true, id };
    }),
    unregister: protectedProcedure.input(z.object({
      endpoint: z.string(),
    })).mutation(async ({ ctx, input }) => {
      await unregisterPushSubscription(ctx.user.id, input.endpoint);
      return { success: true };
    }),
    test: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await sendPushToUser(ctx.user.id, {
        title: "GO Direction 🚀",
        body: "Notificações ativas! Você receberá alertas de bateria, velocidade e cerca aqui.",
        tag: "go-test",
        data: { url: "/" },
      });
      return result; // { sent, failed }
    }),
  }),

  sharing: router({
    create: protectedProcedure.input(z.object({
      vehicleId: z.number(),
      label: z.string().optional(),
      duration: z.enum(["1h", "4h", "12h", "24h", "48h"]),
    })).mutation(async ({ ctx, input }) => {
      // Validar que o veículo pertence ao usuário
      const vehicle = await db.getVehicleById(input.vehicleId);
      if (!vehicle || vehicle.userId !== ctx.user.id) {
        throw new Error("Veículo não encontrado ou não autorizado");
      }
      // Limite máximo de 5 links ativos simultâneos por veículo
      const MAX_ACTIVE_LINKS = 5;
      const activeCount = await db.countActiveShareLinksForVehicle(input.vehicleId);
      if (activeCount >= MAX_ACTIVE_LINKS) {
        throw new Error(`Limite atingido: máximo de ${MAX_ACTIVE_LINKS} links ativos por veículo. Revogue um link existente para criar um novo.`);
      }
      const { nanoid } = await import("nanoid");
      const token = nanoid(32);
      const durationMap: Record<string, number> = {
        "1h": 1, "4h": 4, "12h": 12, "24h": 24, "48h": 48,
      };
      const hours = durationMap[input.duration] || 1;
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      await db.createShareLink({
        userId: ctx.user.id,
        vehicleId: input.vehicleId,
        token,
        label: input.label || null,
        expiresAt,
        active: true,
      });
      return { token, expiresAt };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserShareLinks(ctx.user.id);
    }),
    revoke: protectedProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await db.revokeShareLink(input.id, ctx.user.id);
      return { success: true };
    }),
    // Pública: qualquer pessoa com o token pode ver a localização
    view: publicProcedure.input(z.object({
      token: z.string(),
    })).query(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link) return { error: "Link não encontrado" };
      if (!link.active) return { error: "Link desativado" };
      if (new Date() > link.expiresAt) return { error: "Link expirado" };
      // Incrementar visualizações
      await db.incrementShareLinkView(link.id);
      // Buscar dados do veículo
      const vehicle = await db.getVehicleById(link.vehicleId);
      if (!vehicle) return { error: "Veículo não encontrado" };
      return {
        vehicle: {
          model: vehicle.model,
          brand: vehicle.brand,
          plate: vehicle.plate.slice(0, 3) + "****", // Mascarar placa
          latitude: vehicle.lastLatitude,
          longitude: vehicle.lastLongitude,
          address: vehicle.lastAddress,
          speed: vehicle.speed,
          lastSignalAt: vehicle.lastSignalAt,
          trackerStatus: vehicle.trackerStatus,
        },
        expiresAt: link.expiresAt,
        label: link.label,
      };
    }),
  }),

  // === JORNADA DE CUIDADO (Veículo Offline) ===
  care: router({
    // Registrar motivo do veículo offline
    reportOfflineReason: protectedProcedure
      .input(z.object({
        vehicleId: z.number(),
        reason: z.enum(["all_ok", "garage", "workshop", "maintenance", "other"]),
        details: z.string().optional(),
        needsService: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createOfflineReason({
          userId: ctx.user!.id,
          vehicleId: input.vehicleId,
          reason: input.reason,
          details: input.details || null,
          needsService: input.needsService || false,
        });
        return { success: true };
      }),

    // Listar pontos de instalação/manutenção
    listServicePoints: protectedProcedure
      .input(z.object({ city: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getServicePoints(input?.city);
      }),

    // Criar agendamento de manutenção
    createAppointment: protectedProcedure
      .input(z.object({
        vehicleId: z.number(),
        servicePointId: z.number(),
        scheduledDate: z.string(), // ISO string
        serviceType: z.enum(["maintenance", "installation", "repair"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const appointment = await db.createServiceAppointment({
          userId: ctx.user!.id,
          vehicleId: input.vehicleId,
          servicePointId: input.servicePointId,
          scheduledDate: new Date(input.scheduledDate),
          serviceType: input.serviceType,
          notes: input.notes || null,
        });
        return appointment;
      }),

    // Listar agendamentos do usuário
    listAppointments: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserAppointments(ctx.user!.id);
    }),

    // Cancelar agendamento
    cancelAppointment: protectedProcedure
      .input(z.object({ appointmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.cancelAppointment(input.appointmentId, ctx.user!.id);
        return { success: true };
      }),
  }),

  // === GESTÃO DE PAGAMENTO ===
  payment: router({
    // Obter método de pagamento atual
    getCurrent: protectedProcedure.query(async ({ ctx }) => {
      return db.getCurrentPaymentMethod(ctx.user!.id);
    }),

    // Listar incentivos disponíveis para mudança de método
    getIncentives: protectedProcedure
      .input(z.object({ newMethod: z.string() }))
      .query(async ({ input }) => {
        // Incentivos dinâmicos baseados no método escolhido
        const incentives = [];
        if (input.newMethod === "recurring_card") {
          incentives.push(
            { type: "discount" as const, value: "15%", description: "15% de desconto na próxima mensalidade" },
            { type: "marketplace_product" as const, value: "Rastreador PET", description: "Rastreador PET grátis para seu animal de estimação" },
          );
        } else if (input.newMethod === "credit_card" || input.newMethod === "debit_card") {
          incentives.push(
            { type: "discount" as const, value: "10%", description: "10% de desconto na próxima mensalidade" },
            { type: "marketplace_product" as const, value: "Telemedicina 1 mês", description: "1 mês grátis de Telemedicina para você e sua família" },
          );
        } else if (input.newMethod === "pix") {
          incentives.push(
            { type: "discount" as const, value: "5%", description: "5% de desconto permanente via PIX" },
          );
        }
        return incentives;
      }),

    // Alterar método de pagamento
    changeMethod: protectedProcedure
      .input(z.object({
        newMethod: z.enum(["boleto", "credit_card", "debit_card", "pix", "recurring_card"]),
        cardLast4: z.string().optional(),
        cardBrand: z.string().optional(),
        billingDay: z.number().optional(),
        incentiveType: z.enum(["discount", "marketplace_product", "none"]).optional(),
        incentiveValue: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const current = await db.getCurrentPaymentMethod(ctx.user!.id);
        const previousMethod = current?.type || "boleto";

        // Criar novo método
        await db.setPaymentMethod({
          userId: ctx.user!.id,
          type: input.newMethod,
          cardLast4: input.cardLast4 || null,
          cardBrand: input.cardBrand || null,
          billingDay: input.billingDay || null,
        });

        // Registrar histórico com incentivo
        await db.createPaymentChangeHistory({
          userId: ctx.user!.id,
          previousMethod,
          newMethod: input.newMethod,
          incentiveType: input.incentiveType || "none",
          incentiveValue: input.incentiveValue || null,
        });

        return { success: true, incentiveType: input.incentiveType };
      }),

    // Histórico de mudanças de método
    getChangeHistory: protectedProcedure.query(async ({ ctx }) => {
      return db.getPaymentChangeHistory(ctx.user!.id);
    }),

    // Histórico de faturas (invoices) com paginação e filtro
    getInvoices: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        page: z.number().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getInvoices(ctx.user!.id, {
          status: input?.status,
          page: input?.page || 1,
          limit: input?.limit || 20,
        });
      }),

    // Detalhe de uma fatura específica
    getInvoiceDetail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getInvoiceById(input.id, ctx.user!.id);
      }),

    // Resumo de faturas em aberto/atrasadas (aviso amigável de cobrança)
    openSummary: protectedProcedure.query(async ({ ctx }) => {
      return db.getOpenInvoicesSummary(ctx.user!.id);
    }),
  }),

  // === CONTATOS DE EMERGÊNCIA ===
  emergencyContacts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserEmergencyContacts(ctx.user.id);
    }),

    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      phone: z.string().min(10),
      email: z.string().email().optional(),
      relationship: z.string().optional(),
      isPrimary: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
      return db.createEmergencyContact({
        userId: ctx.user.id,
        name: input.name,
        phone: input.phone,
        email: input.email,
        relationship: input.relationship,
        isPrimary: input.isPrimary,
      });
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      phone: z.string().min(10).optional(),
      email: z.string().email().optional(),
      relationship: z.string().optional(),
      isPrimary: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateEmergencyContact(id, ctx.user.id, data);
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      return db.deleteEmergencyContact(input.id, ctx.user.id);
    }),

    setPrimary: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.setPrimaryEmergencyContact(input.id, ctx.user.id);
      return { success: true };
    }),

    getPrimary: protectedProcedure.query(async ({ ctx }) => {
      return db.getPrimaryEmergencyContact(ctx.user.id);
    }),

    sendAlert: protectedProcedure.input(z.object({
      contactId: z.number(),
      sosType: z.string(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      address: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const contacts = await db.getUserEmergencyContacts(ctx.user.id);
      const contact = contacts.find(c => c.id === input.contactId);
      if (!contact) throw new Error("Contact not found");
      
      const message = `🚨 ALERTA DE EMERGÊNCIA\n\nNome: ${ctx.user?.name || "Usuário"}\nTipo: ${input.sosType}\nLocalização: ${input.address || `${input.latitude}, ${input.longitude}`}\n\nPor favor, verifique imediatamente!`;
      
      try {
        await notifyOwner({
          title: `Alerta de Emergência Enviado para ${contact.name}`,
          content: `Usuário: ${ctx.user?.name}\nContato: ${contact.name} (${contact.phone})\nTipo: ${input.sosType}\nLocal: ${input.address || `${input.latitude}, ${input.longitude}`}`,
        });
      } catch (error) {
        console.error("[Emergency Alert] Failed to notify owner:", error);
      }
      
      console.log(`[Emergency Alert] Sending to ${contact.phone}: ${message}`);
      
      return { success: true, contactId: contact.id, contactName: contact.name, contactPhone: contact.phone };
    }),
  }),
});

export type AppRouter = typeof appRouter;
