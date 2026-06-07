import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermissionState = "granted" | "denied" | "default" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const registerMutation = trpc.push.register.useMutation();
  const unregisterMutation = trpc.push.unregister.useMutation();

  // Verificar suporte e estado atual
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PushPermissionState);

    // Verificar se já está inscrito
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  // Registrar Service Worker
  const registerServiceWorker = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const registration = await navigator.serviceWorker.register("/sw-push.js", {
        scope: "/",
      });
      return registration;
    } catch (error) {
      console.error("[Push] SW registration failed:", error);
      return null;
    }
  }, []);

  // Solicitar permissão e inscrever
  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.error("[Push] VAPID public key not configured");
      return false;
    }

    setIsLoading(true);
    try {
      // Registrar SW
      const registration = await registerServiceWorker();
      if (!registration) {
        setIsLoading(false);
        return false;
      }

      // Solicitar permissão
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);

      if (result !== "granted") {
        setIsLoading(false);
        return false;
      }

      // Criar subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Enviar para o backend
      const subJson = subscription.toJSON();
      await registerMutation.mutateAsync({
        endpoint: subJson.endpoint!,
        keys: {
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("[Push] Subscribe failed:", error);
      setIsLoading(false);
      return false;
    }
  }, [registerMutation, registerServiceWorker]);

  // Cancelar inscrição
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unregisterMutation.mutateAsync({ endpoint });
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("[Push] Unsubscribe failed:", error);
      setIsLoading(false);
      return false;
    }
  }, [unregisterMutation]);

  return {
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    isSupported: permission !== "unsupported",
  };
}
