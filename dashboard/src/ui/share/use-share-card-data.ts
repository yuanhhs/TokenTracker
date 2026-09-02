import { useMemo } from "react";
import {
  buildShareCardData,
  type ShareCardData,
  type ShareCardModel,
  type ShareCardPeriod,
} from "./build-share-card-data";

interface UseShareCardDataParams {
  enabled: boolean;
  handle: string;
  startDate: string | null;
  activeDays: number;
  summary: any;
  topModels: ShareCardModel[] | null | undefined;
  period: ShareCardPeriod;
  periodFrom: string | null;
  periodTo: string | null;
  heatmap: any;
  accessToken: string | null;
  userId: string | null;
  currency?: string;
  exchangeRate?: number;
}

export function useShareCardData(params: UseShareCardDataParams): ShareCardData {
  const {
    enabled,
    handle,
    startDate,
    activeDays,
    summary,
    topModels,
    period,
    periodFrom,
    periodTo,
    heatmap,
    userId,
    currency,
    exchangeRate,
  } = params;

  const rate = exchangeRate;

  return useMemo(
    () =>
      buildShareCardData({
        handle,
        startDate,
        activeDays,
        summary,
        topModels,
        rank: null,
        period,
        periodFrom,
        periodTo,
        heatmap,
        currency,
        exchangeRate: typeof rate === "number" ? rate : undefined,
      }),
    [
      handle,
      startDate,
      activeDays,
      summary,
      topModels,
      period,
      periodFrom,
      periodTo,
      heatmap,
      currency,
      rate,
    ],
  );
}
