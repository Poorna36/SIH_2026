/**
 * sih-dashboard/src/hooks/useBackendData.ts
 * -------------------------------------------
 * React hook that fetches live data from the backend API and
 * gracefully falls back to mock data when the backend is offline.
 *
 * Provides:
 *  - isBackendOnline: boolean
 *  - backendPairs: pair manifest data
 *  - datasetStats: aggregate statistics
 *  - matcherConfig: full matcher registry from matchers.yaml
 *  - runPipelineOnPair: trigger pipeline execution on backend
 *  - refreshData: manually refetch all data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  checkHealth,
  listPairs,
  getDatasetStats,
  getMatchersConfig,
  getPipelineHistory,
  getSensorConfig,
  runPipeline,
  type PairSummary,
  type DatasetStats,
  type MatchersConfig,
  type PipelineResult,
  type PipelineRunRequest,
} from '../services/api';

export interface BackendData {
  isBackendOnline: boolean;
  isLoading: boolean;
  backendLatencyMs: number | null;
  backendPairs: PairSummary[];
  datasetStats: DatasetStats | null;
  matcherConfig: MatchersConfig | null;
  pipelineHistory: PipelineResult[];
  lastPipelineResult: PipelineResult | null;
  fetchSensorConfig: (sensorName: string) => Promise<Record<string, unknown> | null>;
  runPipelineOnPair: (request: PipelineRunRequest) => Promise<PipelineResult | null>;
  refreshData: () => void;
}

export function useBackendData(): BackendData {
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [backendLatencyMs, setBackendLatencyMs] = useState<number | null>(null);
  const [backendPairs, setBackendPairs] = useState<PairSummary[]>([]);
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null);
  const [matcherConfig, setMatcherConfig] = useState<MatchersConfig | null>(null);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineResult[]>([]);
  const [lastPipelineResult, setLastPipelineResult] = useState<PipelineResult | null>(null);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);

    const t0 = performance.now();
    const health = await checkHealth();
    const elapsed = Math.round(performance.now() - t0);
    const online = health?.status === 'online';

    if (!mountedRef.current) return;
    setIsBackendOnline(online);
    setBackendLatencyMs(online ? elapsed : null);

    if (online) {
      // Fetch all data in parallel
      const [pairs, stats, matchers, history] = await Promise.all([
        listPairs(),
        getDatasetStats(),
        getMatchersConfig(),
        getPipelineHistory(),
      ]);

      if (!mountedRef.current) return;

      if (pairs) setBackendPairs(pairs);
      if (stats) setDatasetStats(stats);
      if (matchers) setMatcherConfig(matchers);
      if (history) setPipelineHistory(history);
    }

    if (mountedRef.current) setIsLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();

    // Re-check backend health every 15 seconds
    const interval = setInterval(async () => {
      const t0 = performance.now();
      const health = await checkHealth();
      const elapsed = Math.round(performance.now() - t0);
      const online = health?.status === 'online';
      if (mountedRef.current) {
        setIsBackendOnline(online);
        setBackendLatencyMs(online ? elapsed : null);
      }
    }, 15000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchAll]);

  const runPipelineOnPair = useCallback(async (request: PipelineRunRequest) => {
    const result = await runPipeline(request);
    if (result && mountedRef.current) {
      setLastPipelineResult(result);
      // Prepend to history
      setPipelineHistory((prev) => [result, ...prev.filter((p) => p.run_id !== result.run_id)]);
    }
    return result;
  }, []);

  const fetchSensorConfig = useCallback(async (sensorName: string) => {
    return getSensorConfig(sensorName);
  }, []);

  return {
    isBackendOnline,
    isLoading,
    backendLatencyMs,
    backendPairs,
    datasetStats,
    matcherConfig,
    pipelineHistory,
    lastPipelineResult,
    fetchSensorConfig,
    runPipelineOnPair,
    refreshData: fetchAll,
  };
}
