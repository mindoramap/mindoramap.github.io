import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";

export function useUsageTracker(enabled: boolean) {
  const { recordUsage } = useAuth();
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      startedAtRef.current = null;
      return;
    }

    const flush = () => {
      if (!enabled || startedAtRef.current === null) return;
      const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      startedAtRef.current = Date.now();
      if (elapsedSeconds > 0) {
        void recordUsage(elapsedSeconds);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
        return;
      }

      startedAtRef.current = Date.now();
    };

    startedAtRef.current = Date.now();
    const intervalId = window.setInterval(flush, 30000);

    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      flush();
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, recordUsage]);
}
