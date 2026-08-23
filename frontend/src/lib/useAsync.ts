"use client";

import { useEffect, useState } from "react";

type AsyncState<T> = { loading: boolean; data: T | null; error: string | null };

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    // Resets to loading on every dep change (re-fetch), not just mount —
    // intentionally synchronous so a stale result never flashes first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ loading: true, data: null, error: null });
    fn()
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ loading: false, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
