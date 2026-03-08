import { useEffect, useRef, useState } from "react";

export type ConnectivityState = "checking" | "online" | "offline";

type InternetGateState = {
  connectivityState: ConnectivityState;
  isInteractionBlocked: boolean;
  recheck: () => void;
};

const CONNECTIVITY_PROBE_URL = "https://api.openai.com";
const CONNECTIVITY_PROBE_TIMEOUT_MS = 1500;
const OFFLINE_RETRY_INTERVAL_MS = 2000;

function getInitialConnectivityState(): ConnectivityState {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "offline";
  }

  return "checking";
}

function isDocumentVisible(): boolean {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState !== "hidden";
}

export function useInternetGate(): InternetGateState {
  const [connectivityState, setConnectivityState] = useState<ConnectivityState>(
    getInitialConnectivityState,
  );
  const recheckRef = useRef<() => void>(() => {});
  const connectivityStateRef = useRef<ConnectivityState>(getInitialConnectivityState());

  useEffect(() => {
    let disposed = false;
    let retryIntervalId: number | null = null;
    let activeProbeToken = 0;
    let activeController: AbortController | null = null;

    const stopRetryLoop = (): void => {
      if (retryIntervalId === null) {
        return;
      }

      window.clearInterval(retryIntervalId);
      retryIntervalId = null;
    };

    const setConnectivity = (nextState: ConnectivityState): void => {
      if (disposed) {
        return;
      }

      connectivityStateRef.current = nextState;
      setConnectivityState((current) => (current === nextState ? current : nextState));
    };

    const syncRetryLoop = (nextState: ConnectivityState): void => {
      if (nextState !== "offline" || !isDocumentVisible()) {
        stopRetryLoop();
        return;
      }

      if (retryIntervalId !== null) {
        return;
      }

      retryIntervalId = window.setInterval(() => {
        void runConnectivityCheck(false);
      }, OFFLINE_RETRY_INTERVAL_MS);
    };

    const applyConnectivity = (nextState: ConnectivityState): void => {
      setConnectivity(nextState);
      syncRetryLoop(nextState);
    };

    const abortActiveProbe = (): void => {
      activeController?.abort();
      activeController = null;
    };

    const runConnectivityCheck = async (enterChecking: boolean): Promise<boolean> => {
      if (disposed) {
        return false;
      }

      const browserReportsOffline = navigator.onLine === false;
      const shouldTrustOfflineSignal =
        browserReportsOffline && connectivityStateRef.current !== "offline";

      if (shouldTrustOfflineSignal) {
        activeProbeToken += 1;
        abortActiveProbe();
        applyConnectivity("offline");
        return false;
      }

      const shouldEnterChecking =
        enterChecking && connectivityStateRef.current !== "offline";

      if (shouldEnterChecking) {
        setConnectivity("checking");
      }

      stopRetryLoop();
      activeProbeToken += 1;
      const probeToken = activeProbeToken;
      abortActiveProbe();

      const controller = new AbortController();
      activeController = controller;
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, CONNECTIVITY_PROBE_TIMEOUT_MS);

      try {
        await fetch(CONNECTIVITY_PROBE_URL, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });

        if (disposed || activeProbeToken !== probeToken) {
          return false;
        }

        applyConnectivity("online");
        return true;
      } catch {
        if (disposed || activeProbeToken !== probeToken) {
          return false;
        }

        applyConnectivity("offline");
        return false;
      } finally {
        window.clearTimeout(timeoutId);

        if (activeController === controller) {
          activeController = null;
        }
      }
    };

    const handleOnline = (): void => {
      void runConnectivityCheck(true);
    };

    const handleOffline = (): void => {
      activeProbeToken += 1;
      abortActiveProbe();
      applyConnectivity("offline");
    };

    const handleFocus = (): void => {
      void runConnectivityCheck(true);
    };

    const handlePageShow = (): void => {
      void runConnectivityCheck(true);
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void runConnectivityCheck(true);
        return;
      }

      stopRetryLoop();
    };

    recheckRef.current = () => {
      void runConnectivityCheck(true);
    };

    void runConnectivityCheck(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      recheckRef.current = () => {};
      stopRetryLoop();
      activeProbeToken += 1;
      abortActiveProbe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    connectivityState,
    isInteractionBlocked: connectivityState !== "online",
    recheck: () => {
      recheckRef.current();
    },
  };
}
