import * as db from "./db";
import { sendPushToUser } from "./pushService";

const REMINDER_COOLDOWN_MS = 20 * 60 * 60 * 1000; // ~once a day

function reminderBody(money: string, daysLate: number): string {
  if (daysLate <= 7) return `Ficou uma fatura de ${money} em aberto. Regularize em 1 toque e siga 100% protegido 💛`;
  if (daysLate <= 15) return `Sua fatura (${money}) está atrasada há ${daysLate} dias. Vamos resolver juntos?`;
  return `Mantenha sua proteção ativa: regularize ${money}. Conte com a gente para renegociar se precisar.`;
}

/**
 * Sends a gentle billing reminder (push + in-app notification) to every user
 * with a late invoice, deduped to once a day. Designed to be triggered by a
 * daily scheduler (see /api/cron/billing-reminders).
 */
export async function sendOverdueReminders(): Promise<{ sent: number; skipped: number; total: number }> {
  const users = await db.getUsersWithLateInvoices();
  let sent = 0;
  let skipped = 0;

  for (const u of users) {
    const recent = u.lastBillingReminderAt && Date.now() - new Date(u.lastBillingReminderAt).getTime() < REMINDER_COOLDOWN_MS;
    if (recent) { skipped++; continue; }

    const money = u.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const body = reminderBody(money, u.daysLate);

    await sendPushToUser(u.userId, {
      title: "GO • Fatura em aberto",
      body,
      tag: "go-billing",
      data: { url: "/payment/history" },
    });
    // In-app notification so it also shows in "Alertas" (works even without push).
    await db.createNotification({ userId: u.userId, type: "sistema", title: "Fatura em aberto", message: body });
    await db.markBillingReminderSent(u.userId);
    sent++;
  }

  return { sent, skipped, total: users.length };
}
