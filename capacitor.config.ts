import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.godirection.app",
  appName: "GO",
  webDir: "dist/public",
  backgroundColor: "#243FF7",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#243FF7",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
