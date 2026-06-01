export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Legacy helper kept for compatibility with the framework's `useAuth`.
 *
 * The app now uses its own in-app email/password login (see Onboarding), so
 * there is no external OAuth portal. When `VITE_OAUTH_PORTAL_URL` is not set
 * (the normal case on our own infra), we return "/" — which renders the login
 * screen for unauthenticated users — instead of throwing on `new URL(...)`.
 */
export const getLoginUrl = (): string => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL as string | undefined;
  const appId = import.meta.env.VITE_APP_ID as string | undefined;

  if (!oauthPortalUrl) return "/";

  try {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId ?? "");
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch {
    return "/";
  }
};
