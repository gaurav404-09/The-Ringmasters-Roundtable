import fetch from 'node-fetch';

const FORECAST_CACHE = new Map();
const DEFAULT_CACHE_TTL_MS = Number(process.env.WEATHER_FORECAST_CACHE_TTL_MS || 15 * 60 * 1000);

const getApiKey = () => process.env.OPENWEATHER_API_KEY || process.env.VITE_OPENWEATHER_API_KEY;

const normalizeCity = (city) => (typeof city === 'string' ? city.trim() : '');

const buildCacheKey = (city) => normalizeCity(city).toLowerCase();

const shouldUseCacheEntry = (entry) => {
  if (!entry) {
    return false;
  }
  const ttl = Number.isFinite(entry.ttlMs) ? entry.ttlMs : DEFAULT_CACHE_TTL_MS;
  return Date.now() - entry.timestamp < ttl;
};

const fetchForecastFromApi = async (city) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[WeatherInsights] Missing OpenWeather API key, skipping forecast fetch.');
    return null;
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    console.warn(`[WeatherInsights] Forecast fetch failed for ${city}: ${response.status} ${response.statusText} -> ${text}`);
    return null;
  }

  try {
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('[WeatherInsights] Failed to parse forecast response for city', city, error);
    return null;
  }
};

const getForecastForCity = async (city) => {
  const normalizedCity = normalizeCity(city);
  if (!normalizedCity) {
    return null;
  }

  const key = buildCacheKey(normalizedCity);
  const cached = FORECAST_CACHE.get(key);
  if (shouldUseCacheEntry(cached)) {
    return cached.data;
  }

  const data = await fetchForecastFromApi(normalizedCity);
  if (data) {
    FORECAST_CACHE.set(key, {
      timestamp: Date.now(),
      ttlMs: DEFAULT_CACHE_TTL_MS,
      data,
    });
  }
  return data;
};

const summarizeDailyForecasts = (forecast) => {
  if (!forecast?.list?.length) {
    return [];
  }

  const byDate = new Map();
  forecast.list.forEach((entry) => {
    const timestamp = entry?.dt_txt || entry?.dt;
    if (!timestamp) {
      return;
    }
    const isoDate = typeof timestamp === 'string'
      ? timestamp.split(' ')[0]
      : new Date(entry.dt * 1000).toISOString().split('T')[0];

    if (!isoDate) {
      return;
    }

    const existing = byDate.get(isoDate) || {
      date: isoDate,
      temps: [],
      windSpeeds: [],
      conditions: new Set(),
      rain: 0,
      snow: 0,
    };

    const temp = entry?.main?.temp;
    if (Number.isFinite(temp)) {
      existing.temps.push(temp);
    }

    const weatherMain = entry?.weather?.[0]?.main;
    if (weatherMain) {
      existing.conditions.add(weatherMain.toLowerCase());
    }

    const windSpeed = entry?.wind?.speed;
    if (Number.isFinite(windSpeed)) {
      existing.windSpeeds.push(windSpeed);
    }

    const rain = entry?.rain?.['3h'];
    if (Number.isFinite(rain)) {
      existing.rain += rain;
    }

    const snow = entry?.snow?.['3h'];
    if (Number.isFinite(snow)) {
      existing.snow += snow;
    }

    byDate.set(isoDate, existing);
  });

  return Array.from(byDate.values()).map((day) => {
    const temps = day.temps.filter((value) => Number.isFinite(value));
    const winds = day.windSpeeds.filter((value) => Number.isFinite(value));

    return {
      date: day.date,
      minTemp: temps.length ? Math.min(...temps) : null,
      maxTemp: temps.length ? Math.max(...temps) : null,
      windMax: winds.length ? Math.max(...winds) : null,
      conditions: day.conditions,
      totalRain: day.rain,
      totalSnow: day.snow,
    };
  });
};

const calculateDayDiff = (date) => {
  try {
    const forecastDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(forecastDate.getTime())) {
      return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = forecastDate.getTime() - today.getTime();
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  } catch (error) {
    return null;
  }
};

const formatDayDescriptor = (date) => {
  const diff = calculateDayDiff(date);
  if (diff === null || diff < 0 || diff > 6) {
    return null;
  }

  if (diff === 0) {
    return { descriptor: 'today', displayDate: date, diffDays: diff };
  }
  if (diff === 1) {
    return { descriptor: 'tomorrow', displayDate: date, diffDays: diff };
  }
  const forecastDate = new Date(`${date}T00:00:00`);
  const readable = forecastDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return { descriptor: `on ${readable}`, displayDate: date, diffDays: diff };
};

const hasCondition = (conditions, keyword) => {
  if (!conditions?.size) {
    return false;
  }
  const lowerKeyword = keyword.toLowerCase();
  return Array.from(conditions).some((condition) => condition.includes(lowerKeyword));
};

const buildAlertForSummary = (city, summary) => {
  const descriptor = formatDayDescriptor(summary.date);
  if (!descriptor) {
    return null;
  }

  const { descriptor: dayPhrase, displayDate } = descriptor;
  const maxTemp = summary.maxTemp !== null ? Math.round(summary.maxTemp) : null;
  const minTemp = summary.minTemp !== null ? Math.round(summary.minTemp) : null;
  const windKph = summary.windMax !== null ? Math.round(summary.windMax * 3.6) : null; // convert m/s -> km/h

  if (hasCondition(summary.conditions, 'thunderstorm') || (summary.windMax && summary.windMax >= 15) || summary.totalRain >= 15) {
    return {
      code: 'storm',
      severity: 'high',
      date: displayDate,
      title: `Storm incoming for ${city} ⚠️`,
      message: `Thunderstorms expected ${dayPhrase} in ${city}. Consider shifting activities indoors and have rain gear ready.`,
    };
  }

  if (hasCondition(summary.conditions, 'snow') || summary.totalSnow >= 2) {
    return {
      code: 'snow',
      severity: 'high',
      date: displayDate,
      title: `Snow likely in ${city} ❄️`,
      message: `Snow is in the forecast ${dayPhrase} in ${city}. Pack warm layers and plan for slower travel.`,
    };
  }

  if (hasCondition(summary.conditions, 'rain') || summary.totalRain >= 5) {
    return {
      code: 'rain',
      severity: 'medium',
      date: displayDate,
      title: `Rain ahead in ${city} ☔️`,
      message: `Expect showers ${dayPhrase} in ${city}. Bring a waterproof layer and backup indoor plans.`,
    };
  }

  if (maxTemp !== null && maxTemp >= 32) {
    return {
      code: 'heat',
      severity: 'medium',
      date: displayDate,
      title: `Heat wave alert for ${city} 🔥`,
      message: `Highs near ${maxTemp}°C are expected ${dayPhrase} in ${city}. Schedule breaks and stay hydrated.`,
    };
  }

  if (minTemp !== null && minTemp <= 5) {
    return {
      code: 'cold',
      severity: 'medium',
      date: displayDate,
      title: `Cold snap in ${city} 🧣`,
      message: `Temperatures may drop to ${minTemp}°C ${dayPhrase} in ${city}. Pack extra warm layers.`,
    };
  }

  if (windKph !== null && windKph >= 45) {
    return {
      code: 'wind',
      severity: 'medium',
      date: displayDate,
      title: `Windy conditions in ${city} 💨`,
      message: `Gusts up to ${windKph} km/h expected ${dayPhrase} in ${city}. Secure outdoor plans and gear.`,
    };
  }

  return null;
};

export const getWeatherAlertsForCity = async (city) => {
  const normalizedCity = normalizeCity(city);
  if (!normalizedCity) {
    return [];
  }

  try {
    const forecast = await getForecastForCity(normalizedCity);
    if (!forecast) {
      return [];
    }

    const summaries = summarizeDailyForecasts(forecast);
    const alerts = [];
    for (const summary of summaries) {
      const alert = buildAlertForSummary(normalizedCity, summary);
      if (alert) {
        alerts.push(alert);
      }
      if (alerts.length >= 3) {
        break; // avoid overwhelming with too many alerts per city
      }
    }

    return alerts;
  } catch (error) {
    console.error('[WeatherInsights] Failed to compute alerts for city:', normalizedCity, error);
    return [];
  }
};
