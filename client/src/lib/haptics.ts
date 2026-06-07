import { Capacitor } from "@capacitor/core";
import { getA11ySettings } from "@/contexts/AccessibilityContext";

/**
 * Vibração em alertas — pensada para pessoas com deficiência AUDITIVA: como o
 * som não é uma pista confiável, todo alerta crítico também VIBRA o aparelho
 * (além do banner visual). Respeita a preferência "Vibrar em alertas".
 */
export async function alertHaptic(kind: "critical" | "warning" = "critical"): Promise<void> {
  if (!getA11ySettings().hapticAlerts) return;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, NotificationType } = await import("@capacitor/haptics");
      await Haptics.notification({
        type: kind === "critical" ? NotificationType.Error : NotificationType.Warning,
      });
      return;
    } catch { /* cai no fallback web */ }
  }

  try {
    navigator.vibrate?.(kind === "critical" ? [140, 70, 140] : 120);
  } catch { /* navegador sem suporte: silencioso */ }
}
