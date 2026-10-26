import { useEffect } from "react";

/**
 * Refresca datos cada `intervalMs` mientras la pestaña está visible.
 * Evita llamadas superpuestas y refresca al recuperar el foco.
 */
export default function usePolling(callback, intervalMs, { enabled = true, immediate = false } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;

    let disposed = false;
    let inFlight = false;
    let timer = null;

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const tick = async () => {
      if (disposed || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        await callback();
      } catch {
        // Un fallo transitorio no corta el polling: se reintenta en el próximo tick.
      } finally {
        inFlight = false;
      }
    };

    const start = () => {
      stop();
      timer = setInterval(tick, intervalMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };

    const handleFocus = () => {
      tick();
    };

    if (document.visibilityState === "visible") {
      start();
      if (immediate) tick();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [callback, intervalMs, enabled, immediate]);
}
