/**
 * 天气服务 — 浏览器定位 + Open-Meteo 免费 API
 * Open-Meteo 无需 API Key，每日 10000 次免费调用
 */

import type { WeatherContext, WeatherCondition, Season } from '@/types';

interface GeoCoords {
  latitude: number;
  longitude: number;
  city?: string;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    relative_humidity_2m: number;
  };
}

/** WMO Weather Codes → WeatherCondition */
function weatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0) return 'sunny';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'cloudy';
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snowy';
  if (code <= 82) return 'rainy';
  if (code <= 99) return 'windy';
  return 'cloudy';
}

/** 根据月份和温度判断季节 */
function getSeason(temp: number): Season {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return temp > 20 ? 'summer' : 'spring';
  if (month >= 5 && month <= 8) return 'summer';
  if (month >= 9 && month <= 10) return 'autumn';
  return temp < 5 ? 'winter' : temp < 15 ? 'autumn' : 'spring';
}

/** 获取浏览器地理位置 */
export function getCurrentPosition(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        reject(new Error(`定位失败: ${err.message}`));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 } // 10分钟缓存
    );
  });
}

/** IP 定位兜底（当 GPS 不可用时） */
export async function getIPLocation(): Promise<GeoCoords & { city: string }> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city || data.region || '未知城市',
    };
  } catch {
    // 默认杭州武林
    return { latitude: 30.2741, longitude: 120.1551, city: '杭州' };
  }
}

/** 逆地理编码：坐标→城市名 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh`
    );
    const data = await res.json();
    return data.address?.city || data.address?.town || data.address?.county || '未知城市';
  } catch {
    return '你的城市';
  }
}

/** 获取当前天气（Open-Meteo 免费 API） */
export async function getCurrentWeather(
  lat: number,
  lon: number
): Promise<WeatherContext> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`
    );
    const data: OpenMeteoResponse = await res.json();

    const temp = Math.round(data.current.temperature_2m);
    const humidity = Math.round(data.current.relative_humidity_2m);
    const condition = weatherCodeToCondition(data.current.weather_code);
    const season = getSeason(temp);
    const city = await reverseGeocode(lat, lon);

    return { temperature: temp, condition, city, season, humidity };
  } catch {
    // 兜底 mock
    const month = new Date().getMonth();
    const isSummer = month >= 5 && month <= 9;
    return {
      temperature: isSummer ? 32 : 15,
      condition: 'sunny',
      city: '杭州',
      season: isSummer ? 'summer' : 'spring',
      humidity: 65,
    };
  }
}

/** 获取位置+天气（一站式） */
export async function getLocationAndWeather(): Promise<WeatherContext> {
  try {
    // 先尝试 GPS
    const coords = await getCurrentPosition();
    return await getCurrentWeather(coords.latitude, coords.longitude);
  } catch {
    // GPS 失败，用 IP 定位
    try {
      const ipCoords = await getIPLocation();
      return await getCurrentWeather(ipCoords.latitude, ipCoords.longitude);
    } catch {
      // 完全失败，返回默认
      return {
        temperature: 25,
        condition: 'sunny',
        city: '杭州',
        season: 'summer',
        humidity: 65,
      };
    }
  }
}
