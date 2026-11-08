export type VillageWeather = {
  temperature: number;
  humidity: number;
  cloud: number;
  wind: number;
  precipitation: number;
  snow: number;
  code: number;
  isDay: boolean;
  phase: "day" | "sunset" | "night";
  description: string;
  time: number;
  fetchedAt: number;
};

export const NONSAN_WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=36.20389&longitude=127.08472&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=Asia%2FSeoul&timeformat=unixtime&wind_speed_unit=ms&forecast_days=1";

export function weatherDescription(code: number) {
  if (code === 0) return "맑음";
  if (code === 1) return "대체로 맑음";
  if (code === 2) return "구름 조금";
  if (code === 3) return "흐림";
  if (code === 45 || code === 48) return "안개";
  if (code >= 51 && code <= 57) return "이슬비";
  if (code >= 61 && code <= 67) return "비";
  if (code >= 71 && code <= 77) return "눈";
  if (code >= 80 && code <= 82) return "소나기";
  if (code === 85 || code === 86) return "눈 소나기";
  if (code >= 95) return "뇌우";
  return "현재 날씨";
}

export function watchNonsanWeather(onWeather: (weather: VillageWeather) => void, onFailure: () => void) {
  const controller = new AbortController();
  let stopped = false, lastFetch = 0, pending = false;
  const cacheKey = "strawberry-nonsan-weather-v1";
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null") as VillageWeather | null;
    if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000 && Number.isFinite(cached.temperature)) { onWeather(cached); lastFetch = cached.fetchedAt; }
  } catch { /* Weather works without browser storage. */ }

  async function refresh() {
    if (stopped || pending || Date.now() - lastFetch < 10 * 60 * 1000) return;
    pending = true;
    try {
      const response = await fetch(NONSAN_WEATHER_URL, { signal: controller.signal });
      if (!response.ok) throw new Error("weather unavailable");
      const data = await response.json() as { current: { temperature_2m: number; relative_humidity_2m: number; cloud_cover: number; wind_speed_10m: number; precipitation: number; snowfall: number; weather_code: number; is_day: number; time: number }; daily: { sunset: number[] } };
      const c = data.current;
      if (![c?.temperature_2m, c?.weather_code, c?.time, c?.cloud_cover, c?.wind_speed_10m].every(Number.isFinite)) throw new Error("invalid weather");
      const now = Date.now(), sunset = Number(data.daily?.sunset?.[0]) * 1000;
      const phase = c.is_day === 0 ? "night" : Math.abs(sunset - now) < 45 * 60 * 1000 ? "sunset" : "day";
      const weather: VillageWeather = { temperature: c.temperature_2m, humidity: c.relative_humidity_2m, cloud: c.cloud_cover, wind: c.wind_speed_10m, precipitation: c.precipitation || 0, snow: c.snowfall || 0, code: c.weather_code, isDay: c.is_day === 1, phase, description: weatherDescription(c.weather_code), time: c.time * 1000, fetchedAt: now };
      if (stopped) return;
      lastFetch = now; onWeather(weather);
      try { localStorage.setItem(cacheKey, JSON.stringify(weather)); } catch { /* Caching is optional. */ }
    } catch { if (!stopped) onFailure(); }
    finally { pending = false; }
  }
  const interval = window.setInterval(() => void refresh(), 60000);
  const visible = () => { if (!document.hidden) void refresh(); };
  document.addEventListener("visibilitychange", visible); void refresh();
  return () => { stopped = true; controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
}
