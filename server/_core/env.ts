export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Own Google Maps key (preferred). Falls back to the Manus forge proxy when unset.
  mapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  // Webhook for ops/central alerts (Slack, email gateway, own system). Preferred
  // over the Manus notification service.
  ownerWebhookUrl: process.env.OWNER_WEBHOOK_URL ?? "",
  vapidPublicKey: process.env.VITE_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
};
