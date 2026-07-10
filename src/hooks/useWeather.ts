import { useState, useEffect, useCallback } from 'react';
import type { WeatherContext } from '@/types';
import { getLocationAndWeather } from '@/services/weatherService';

export function useWeather() {
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLocationAndWeather();
      setWeather(data);
      setPermissionDenied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取天气失败');
      if (e instanceof Error && e.message.includes('denied')) {
        setPermissionDenied(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { weather, loading, error, permissionDenied, refresh };
}
