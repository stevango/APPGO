import * as db from "./db";
import { sendPushToUser } from "./pushService";

// Alerta de manutenção: rastreador parou de posicionar.
const STALE_THRESHOLD_DAYS = 3;           // a partir de quando avisamos
const REMINDER_COOLDOWN_MS = 20 * 60 * 60 * 1000; // ~1x/dia (avisa todo dia com a contagem atualizada)

function maintenanceBody(plate: string, days: number): string {
  if (days <= 7) {
    return `Seu rastreador (${plate}) está há ${days} dias sem posicionar. Pode ser sinal ou energia — vamos verificar juntos?`;
  }
  return `Seu rastreador (${plate}) está há ${days} dias sem comunicar. Recomendamos uma manutenção para voltar a proteger seu bem. 💛`;
}

/**
 * Avisa (push + notificação no app) todo cliente cujo rastreador está há vários
 * dias sem posicionar, sugerindo manutenção. Repete 1x/dia enquanto seguir
 * parado, com a contagem de dias atualizada (49, 50, 51...). Pensado para um
 * agendador diário (/api/cron/maintenance-reminders).
 */
export async function sendMaintenanceReminders(
  thresholdDays = STALE_THRESHOLD_DAYS,
): Promise<{ sent: number; skipped: number; total: number }> {
  const stale = await db.getStaleTrackedVehicles(thresholdDays);
  let sent = 0;
  let skipped = 0;

  for (const v of stale) {
    const recentlyWarned =
      v.lastStaleAlertAt && Date.now() - new Date(v.lastStaleAlertAt).getTime() < REMINDER_COOLDOWN_MS;
    if (recentlyWarned) { skipped++; continue; }

    const body = maintenanceBody(v.plate, v.daysStale);

    await sendPushToUser(v.userId, {
      title: "GO • Rastreador sem posicionar",
      body,
      tag: `go-maintenance-${v.vehicleId}`,
      data: { url: "/vehicle-care" },
    });
    // Notificação no app (aparece em "Alertas" mesmo sem push habilitado).
    await db.createNotification({
      userId: v.userId,
      vehicleId: v.vehicleId,
      type: "manutencao",
      title: "Rastreador sem posicionar",
      message: body,
    });
    await db.markStaleAlertSent(v.vehicleId);
    sent++;
  }

  return { sent, skipped, total: stale.length };
}
