import * as db from "./db";
import { sendPushToUser } from "./pushService";

// Alerta de manutenção: rastreador parou de posicionar.
//
// É NÍVEL CRÍTICO: rastreador sem posicionar = veículo sem proteção. A
// responsabilidade de informar é nossa, então avisamos TODO DIA (push + app)
// enquanto persistir, e gravamos cada disparo numa trilha de auditoria imutável
// (prova de que informamos, com data/hora e canal).
const STALE_THRESHOLD_DAYS = 3;           // a partir de quando avisamos
const DAILY_COOLDOWN_MS = 20 * 60 * 60 * 1000; // processa no máx. 1x/dia por veículo

function maintenanceBody(plate: string, days: number): string {
  if (days <= 7) {
    return `Seu rastreador (${plate}) está há ${days} dias sem posicionar. Pode ser sinal ou energia — vamos verificar juntos?`;
  }
  return `Atenção: seu rastreador (${plate}) está há ${days} dias sem comunicar e seu veículo pode estar SEM PROTEÇÃO. Agende uma manutenção o quanto antes.`;
}

/**
 * Para cada cliente cujo rastreador está há vários dias sem posicionar, avisa
 * TODO DIA, com a contagem de dias atualizada (49, 50, 51...):
 *  - 1 card no app por veículo (atualizado diariamente, sem poluir a lista);
 *  - push diário (informação crítica de segurança);
 *  - registra cada disparo na trilha de auditoria (db.notificationLog).
 * Pensado para um agendador diário (/api/cron/maintenance-reminders).
 */
export async function sendMaintenanceReminders(
  thresholdDays = STALE_THRESHOLD_DAYS,
): Promise<{ sent: number; pushed: number; skipped: number; total: number }> {
  const stale = await db.getStaleTrackedVehicles(thresholdDays);
  let sent = 0;
  let pushed = 0;
  let skipped = 0;

  for (const v of stale) {
    const processedToday =
      v.lastStaleAlertAt && Date.now() - new Date(v.lastStaleAlertAt).getTime() < DAILY_COOLDOWN_MS;
    if (processedToday) { skipped++; continue; }

    const title = "Rastreador sem posicionar";
    const body = maintenanceBody(v.plate, v.daysStale);
    const severity = v.daysStale > 7 ? "critical" : "warning";
    const meta = { daysStale: v.daysStale, plate: v.plate };

    // Card no app: um por veículo, atualizado diariamente (aparece em "Alertas"
    // mesmo sem push habilitado).
    await db.upsertMaintenanceNotification(v.userId, v.vehicleId, title, body);
    await db.logNotificationDispatch({
      userId: v.userId, vehicleId: v.vehicleId, type: "manutencao",
      channel: "inapp", severity, title, message: body, meta,
    });
    sent++;

    // Push diário (informação crítica). Registra o disparo de qualquer forma —
    // o que importa para auditoria é que tentamos informar, na data X.
    await sendPushToUser(v.userId, {
      title: "GO • Rastreador sem posicionar",
      body,
      tag: `go-maintenance-${v.vehicleId}`,
      data: { url: "/vehicle-care" },
    });
    await db.logNotificationDispatch({
      userId: v.userId, vehicleId: v.vehicleId, type: "manutencao",
      channel: "push", severity, title, message: body, meta,
    });
    pushed++;

    await db.markStaleAlertSent(v.vehicleId);
  }

  return { sent, pushed, skipped, total: stale.length };
}
