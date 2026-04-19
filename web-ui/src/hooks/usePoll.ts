import { useEffect, useRef, useState } from "react";
import type { FetchState } from "../api/types";

interface Options {
  intervalMs: number;
  /** Stop polling while the tab is hidden; resume on focus. */
  pauseOnHidden?: boolean;
  /** Dependency fingerprint — changing this restarts the poll. */
  key?: string;
  enabled?: boolean;
}

/**
 * Small, dependency-free polling primitive. Keeps the most recent success
 * payload available while a follow-up refetch is in flight so charts don't
 * flicker back to a loading state on every tick.
 */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  { intervalMs, pauseOnHidden = true, key = "", enabled = true }: Options,
): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    status: "idle",
    data: null,
    error: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let handle: number | undefined;
    let cancelled = false;

    const tick = async () => {
      setState((prev) =>
        prev.status === "ok"
          ? { status: "loading", data: prev.data, error: null }
          : { status: "loading", data: prev.data, error: null },
      );
      try {
        const data = await fetcherRef.current();
        if (cancelled || !mountedRef.current) return;
        setState({ status: "ok", data, error: null });
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        setState((prev) => ({
          status: "error",
          data: prev.data,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
    };

    const schedule = () => {
      handle = window.setTimeout(async () => {
        if (pauseOnHidden && document.hidden) {
          schedule();
          return;
        }
        await tick();
        if (!cancelled) schedule();
      }, intervalMs);
    };

    // Kick off immediately, then schedule recurring polls.
    tick().finally(() => {
      if (!cancelled) schedule();
    });

    return () => {
      cancelled = true;
      if (handle != null) clearTimeout(handle);
    };
  }, [intervalMs, pauseOnHidden, key, enabled]);

  const refetch = () => {
    fetcherRef.current().then(
      (data) => mountedRef.current && setState({ status: "ok", data, error: null }),
      (err) =>
        mountedRef.current &&
        setState((prev) => ({
          status: "error",
          data: prev.data,
          error: err instanceof Error ? err : new Error(String(err)),
        })),
    );
  };

  return { ...state, refetch };
}
