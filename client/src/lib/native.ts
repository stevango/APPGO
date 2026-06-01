import { Capacitor } from "@capacitor/core";

/**
 * Initialize native-only behaviors when running inside Capacitor (iOS/Android).
 * No-ops on the web. Plugins are imported lazily so the web bundle stays lean.
 */
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#243FF7" });
    }
  } catch (err) {
    console.warn("[native] StatusBar unavailable", err);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (err) {
    console.warn("[native] SplashScreen unavailable", err);
  }
}
