/**
 * Canais de notificação além do push web: e-mail (Resend) e SMS/WhatsApp (Twilio).
 * Todos são ATIVADOS POR CONFIGURAÇÃO (env). Sem credenciais, retornam
 * { delivered:false, skipped:true } e o app segue funcionando — o disparo ainda
 * é registrado na trilha de auditoria como "tentado/não entregue".
 *
 *   E-mail (Resend):   RESEND_API_KEY, EMAIL_FROM="GO <alertas@seudominio>"
 *   SMS (Twilio):      TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM
 *   WhatsApp (Twilio): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 */

export type ChannelResult = { delivered: boolean; skipped?: boolean; error?: string };

export const emailEnabled = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
export const smsEnabled = () =>
  !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_SMS_FROM;
export const whatsappEnabled = () =>
  !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_WHATSAPP_FROM;

/** Normaliza telefone para E.164 BR (+55...) de forma tolerante. */
export function toE164BR(phone: string): string | null {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (phone.trim().startsWith("+")) return "+" + digits;
  if (digits.startsWith("55") && digits.length >= 12) return "+" + digits;
  if (digits.length === 10 || digits.length === 11) return "+55" + digits; // DDD + número
  return "+" + digits;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<ChannelResult> {
  if (!emailEnabled()) return { delivered: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    });
    if (!res.ok) return { delivered: false, error: `resend ${res.status}` };
    return { delivered: true };
  } catch (e: any) {
    return { delivered: false, error: String(e?.message || e) };
  }
}

async function twilioSend(to: string, from: string, body: string): Promise<ChannelResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const tokenAuth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${tokenAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    if (!res.ok) return { delivered: false, error: `twilio ${res.status}` };
    return { delivered: true };
  } catch (e: any) {
    return { delivered: false, error: String(e?.message || e) };
  }
}

export async function sendSms(phone: string, body: string): Promise<ChannelResult> {
  if (!smsEnabled()) return { delivered: false, skipped: true };
  const to = toE164BR(phone);
  if (!to) return { delivered: false, error: "telefone inválido" };
  return twilioSend(to, process.env.TWILIO_SMS_FROM!, body);
}

export async function sendWhatsapp(phone: string, body: string): Promise<ChannelResult> {
  if (!whatsappEnabled()) return { delivered: false, skipped: true };
  const to = toE164BR(phone);
  if (!to) return { delivered: false, error: "telefone inválido" };
  return twilioSend(`whatsapp:${to}`, `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, body);
}
