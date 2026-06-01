import webpush from "web-push";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { pushSubscriptions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Configurar VAPID
const VAPID_SUBJECT = "mailto:contato@godirection.com.br";

function initWebPush() {
  if (ENV.vapidPublicKey && ENV.vapidPrivateKey) {
    webpush.setVapidDetails(VAPID_SUBJECT, ENV.vapidPublicKey, ENV.vapidPrivateKey);
    return true;
  }
  console.warn("[Push] VAPID keys not configured, push notifications disabled");
  return false;
}

const pushReady = initWebPush();

// Registrar subscription de um usuário
export async function registerPushSubscription(
  userId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar se já existe essa subscription (mesmo endpoint)
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
    .limit(1);

  if (existing.length > 0) {
    // Atualizar userId e reativar se necessário
    await db
      .update(pushSubscriptions)
      .set({ userId, active: true, userAgent })
      .where(eq(pushSubscriptions.id, existing[0].id));
    return existing[0].id;
  }

  // Criar nova subscription
  const [result] = await db.insert(pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent,
    active: true,
  });
  return result.insertId;
}

// Remover subscription
export async function unregisterPushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(pushSubscriptions)
    .set({ active: false })
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

// Enviar push notification para um usuário específico
export async function sendPushToUser(
  userId: number,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
    actions?: Array<{ action: string; title: string }>;
  }
) {
  if (!pushReady) return { sent: 0, failed: 0 };

  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.active, true)));

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 } // 1 hora
      );
      sent++;
    } catch (error: any) {
      // Se subscription expirou ou foi revogada (410 Gone, 404 Not Found)
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db
          .update(pushSubscriptions)
          .set({ active: false })
          .where(eq(pushSubscriptions.id, sub.id));
      }
      failed++;
    }
  }

  return { sent, failed };
}

// Enviar push para múltiplos usuários
export async function sendPushToUsers(
  userIds: number[],
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  }
) {
  const results = await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(userId, payload))
  );
  return results;
}
