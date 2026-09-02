import { useCallback, useEffect, useState } from "react";
import { getOutcomes } from "../lib/api";
import { useLatestRequestGuard } from "./use-latest-request-guard";

// Fetches the opt-in quality-per-dollar / Effective-Tokens join from the local
// outcomes endpoint. Inert until `enabled` is true, so users who never opt in
// pay no fetch cost. Returns the raw endpoint payload
// ({ available, by_model, by_tool, totals }) plus loading/error.
export function useQualityPerDollar({
  enabled = false,
  from,
  to,
  deviceId = null,
}: any = {}) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const beginRequest = useLatestRequestGuard([enabled, from, to, deviceId]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const isCurrent = beginRequest();
    setLoading(true);
    setError(null);
    try {
      const res = await getOutcomes({ from, to, device: deviceId });
      if (!isCurrent()) return;
      setData(res || null);
    } catch (e: any) {
      if (!isCurrent()) return;
      setError(e?.message || String(e));
      setData(null);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [enabled, from, to, deviceId, beginRequest]);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setData(null);
    setError(null);
    setLoading(true);
    refresh();
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
