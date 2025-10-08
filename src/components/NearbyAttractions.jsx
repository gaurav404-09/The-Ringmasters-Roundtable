import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, RefreshCw, Loader2 } from 'lucide-react';
import ENV from '../config/env.js';

const STATUS = {
  IDLE: 'idle',
  LOCATING: 'locating',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
};

const NearbyAttractions = ({ focus = 'mixed', limit = 4, className = '' }) => {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const tooltip = useMemo(() => {
    if (status === STATUS.ERROR) return error || 'Unable to load nearby attractions';
    if (status === STATUS.LOCATING) return 'Locating you…';
    if (status === STATUS.LOADING) return 'Fetching nearby attractions…';
    return 'Nearby Attractions';
  }, [status, error]);

  const fetchNearby = useCallback(async () => {
    if (!coords) return;
    try {
      setError(null);
      const params = new URLSearchParams({
        lat: coords.lat.toString(),
        lon: coords.lon.toString(),
        focus,
        radius: '2000',
      });
      const baseUrl = ENV.API_BASE_URL?.replace(/\/$/, '') || '';
      const endpoint = `${baseUrl}/api/nearby?${params.toString()}`;
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textSnippet = (await response.text()).slice(0, 120);
        throw new Error(`Unexpected response format: ${textSnippet}`);
      }
      const data = await response.json();
      setSuggestions(data?.suggestions || []);
      setStatus(STATUS.SUCCESS);
    } catch (err) {
      console.error('[NearbyAttractions] Failed to fetch nearby places:', err);
      setError(err?.message || 'Failed to fetch nearby attractions.');
      setStatus(STATUS.ERROR);
    }
  }, [coords, focus]);

  useEffect(() => {
    if (status !== STATUS.IDLE || coords) return;

    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      setStatus(STATUS.ERROR);
      return;
    }

    setStatus(STATUS.LOCATING);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setStatus(STATUS.LOADING);
      },
      (geoError) => {
        console.warn('[NearbyAttractions] Geolocation error:', geoError);
        setError('Location access denied. Enable it to see nearby attractions.');
        setStatus(STATUS.ERROR);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }, [coords, status]);

  useEffect(() => {
    if (coords && status === STATUS.LOADING) {
      fetchNearby();
    }
  }, [coords, status, fetchNearby]);

  const triggerRefresh = () => {
    if (!coords) return;
    setStatus(STATUS.LOADING);
  };

  const renderContent = () => {
    if (status === STATUS.ERROR) {
      return (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p className="font-semibold">We couldn&apos;t load nearby attractions.</p>
          <p className="mt-1 opacity-80">{error}</p>
          <button
            type="button"
            onClick={fetchNearby}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-rose-100 transition hover:border-rose-100/60"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      );
    }

    if (status === STATUS.LOADING || status === STATUS.LOCATING) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
          {status === STATUS.LOCATING ? 'Pinpointing your location…' : 'Scanning nearby experiences…'}
        </div>
      );
    }

    if (!suggestions.length) {
      return (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
          No nearby attractions found within the last 2 km radius. Try refreshing in a bit.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {suggestions.slice(0, limit).map((item) => {
          const destination = item.coordinates
            ? `${item.coordinates.lat},${item.coordinates.lon}`
            : undefined;
          const query = destination
            ? new URLSearchParams({
                origin: `${coords?.lat ?? ''},${coords?.lon ?? ''}`,
                destination,
                mode: 'walking',
                label: item.name || 'Nearby spot',
              }).toString()
            : null;
          const href = query ? `/routes?${query}` : undefined;

          const card = (
            <div
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 shadow-inner shadow-slate-900/30 transition hover:border-cyan-300/60 hover:bg-cyan-500/10"
            >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-white">{item.name}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">{item.type || 'Attraction'}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/60">
                Nearby
              </span>
            </div>
            {item.description && (
              <p className="mt-2 text-sm text-white/70">{item.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
              {item.address && <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-cyan-200" />
                {item.address}
              </span>}
              {item.tags?.opening_hours && <span>Hours: {item.tags.opening_hours}</span>}
            </div>
          </div>
          );

          return href ? (
            <a
              key={item.id || `${item.name}-${item.coordinates?.lat}`}
              href={href}
              className="block"
            >
              {card}
            </a>
          ) : (
            <div
              key={item.id || `${item.name}-${item.coordinates?.lat}`}
              className="cursor-default"
            >
              {card}
            </div>
          );
        })}
        {suggestions.length > limit && (
          <p className="text-xs text-white/55">Showing {limit} of {suggestions.length} nearby spots.</p>
        )}
      </div>
    );
  };

  return (
    <section className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="group relative inline-flex">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/80 via-sky-500/70 to-indigo-500/60 text-white">
              <MapPin className="h-6 w-6" />
            </span>
            <span className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-slate-900/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white opacity-0 transition group-hover:-translate-y-[calc(100%+0.35rem)] group-hover:opacity-100">
              {tooltip}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">Live nearby pulse</p>
            <h3 className="text-xl font-semibold text-white">Spontaneous attractions around you</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchNearby}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
      <div className="mt-5">
        {renderContent()}
      </div>
    </section>
  );
};

export default NearbyAttractions;
