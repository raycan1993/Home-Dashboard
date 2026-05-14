// SBB-style train departures with interactive route picker + station favourites.
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { StationLocation, TrainConnection } from '@home-dashboard/shared';
import { api, ApiError } from '../api';
import { useLang, tr } from '../i18n';

// ─── Time / duration helpers ──────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function minsUntil(iso: string): number | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 60_000);
}

// Format a duration in whole minutes, promoting to hours once ≥ 60.
function fmtMins(totalMins: number): string {
  const safeMins = Math.max(0, Math.round(totalMins));
  if (safeMins < 60) return `${safeMins} min`;
  const h = Math.floor(safeMins / 60);
  const m = safeMins % 60;
  return m > 0 ? `${h}h ${m} min` : `${h}h`;
}

// Format a countdown (e.g. "5'", "1h 22'", "dep.")
function fmtCountdown(mins: number): string {
  const safeMins = Math.max(0, Math.round(mins));
  if (safeMins < 60) return `${safeMins}'`;
  const h = Math.floor(safeMins / 60);
  const m = safeMins % 60;
  return m > 0 ? `${h}h ${m}'` : `${h}h`;
}

function durationMinutes(t: TrainConnection): string {
  const fromMs = new Date(t.departure).getTime();
  const toMs   = new Date(t.arrival).getTime();
  if (!isNaN(fromMs) && !isNaN(toMs) && toMs >= fromMs) {
    return fmtMins(Math.round((toMs - fromMs) / 60_000));
  }
  const duration = (t.duration || '').trim();
  const dayMatch = duration.match(/(?:(\d+)d)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!dayMatch) return duration || '--';
  const days = Number(dayMatch[1] ?? 0);
  const first = Number(dayMatch[2]);
  const second = Number(dayMatch[3]);
  const hasSeconds = dayMatch[4] !== undefined;
  const hours = hasSeconds ? first : 0;
  const minutes = hasSeconds ? second : first * 60 + second;
  return fmtMins(days * 24 * 60 + hours * 60 + minutes);
}

// ─── Train label / badge helpers ──────────────────────────────────────────────

function trainLabel(t: TrainConnection): string {
  const label = (t.trainType ?? t.products[0] ?? '').trim();
  return label.replace(/^([A-Z]+)\s+(\d+)$/i, '$1 $2') || '--';
}

function badgeKind(label: string): 'red' | 's' | 'dark' {
  const code = label.toUpperCase();
  if (code.startsWith('S')) return 's';
  if (code.startsWith('IR') || code.startsWith('IC') || code.startsWith('EC') || code.startsWith('ICE')) return 'red';
  return 'dark';
}

function TrainPictogram() {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] bg-[#24317f] text-white shadow-sm">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3 w-3">
        <path fill="currentColor" d="M5 2h10a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2l1.5 2H13l-.7-1H7.7L7 16H4.5L6 14a2 2 0 0 1-2-2V3a1 1 0 0 1 1-1Zm1.5 2v3h7V4h-7Zm0 4.5V11h7V8.5h-7ZM7 12.5a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Zm6 0a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Z" />
      </svg>
    </span>
  );
}

function LineBadge({ label }: { label: string }) {
  const kind = badgeKind(label);
  const compact = label.replace(/\s+/g, kind === 's' ? '' : ' ');
  const classes =
    kind === 's'
      ? 'border border-zinc-300 bg-zinc-950 text-zinc-100'
      : kind === 'red'
        ? 'bg-[#e00000] text-white italic'
        : 'bg-zinc-950 text-white';
  return (
    <span className={'inline-flex h-3.5 min-w-10 items-center rounded-[2px] px-1.5 text-[10px] font-extrabold leading-none ' + classes}>
      {compact}
    </span>
  );
}

// ─── Capacity display ─────────────────────────────────────────────────────────
// SBB API values: 1 = low, 2 = medium, 3 = high occupancy, null/0 = no data.
// Icons filled left-to-right: value=3 → all 3 prominent; 0/null → all dim.

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 12 18"
      aria-hidden="true"
      className="h-4 w-2.5 transition-opacity"
    >
      <circle
        cx="6"
        cy="4"
        r="2.4"
        fill={active ? '#E4E4E7' : 'transparent'}
        stroke={active ? '#F4F4F5' : '#71717A'}
        strokeWidth="1.3"
      />
      <path
        d="M2.5 16v-4.9C2.5 8.8 4 7.4 6 7.4s3.5 1.4 3.5 3.7V16"
        fill={active ? '#D4D4D8' : 'transparent'}
        stroke={active ? '#F4F4F5' : '#71717A'}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CapacityBar({ value }: { value?: number | null }) {
  // Map API value (1–3) to number of lit icons. null/0/undefined = 0 lit.
  const lit = value != null && value >= 1 ? Math.min(3, Math.round(value)) : 0;
  return (
    <span className="inline-flex items-end gap-[2px] rounded-full bg-zinc-900/60 px-1 py-0.5 ring-1 ring-zinc-700/60">
      {[0, 1, 2].map((i) => <PersonIcon key={i} active={i < lit} />)}
    </span>
  );
}

function CapacityBlock({ first, second }: { first?: number | null; second?: number | null }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="inline-flex items-center gap-1">
        <span className="text-[10px] font-semibold text-zinc-500">1.</span>
        <CapacityBar value={first} />
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="text-[10px] font-semibold text-zinc-500">2.</span>
        <CapacityBar value={second} />
      </span>
    </div>
  );
}

// ─── Transfer timeline ────────────────────────────────────────────────────────

function Timeline({ legDurations }: { legDurations?: number[] }) {
  const legs  = legDurations && legDurations.length > 1 ? legDurations : null;
  const total = legs ? legs.reduce((a, b) => a + b, 0) || 1 : 1;

  if (!legs) {
    return (
      <div className="flex items-center w-full h-3">
        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-zinc-200" />
        <div className="flex-1 h-[2px] bg-zinc-200" />
        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-zinc-200" />
      </div>
    );
  }

  return (
    <div className="flex items-center w-full h-3">
      <div className="h-2 w-2 flex-shrink-0 rounded-full bg-zinc-200" />
      {legs.map((dur, i) => (
        <Fragment key={i}>
          <div className="h-[2px] bg-zinc-200" style={{ flex: dur / total }} />
          <div className={
            'flex-shrink-0 rounded-full border-2 ' +
            (i < legs.length - 1
              ? 'h-2.5 w-2.5 border-zinc-400 bg-zinc-900'
              : 'h-2   w-2   border-0   bg-zinc-200')
          } />
        </Fragment>
      ))}
    </div>
  );
}

// ─── Departure row ────────────────────────────────────────────────────────────

function DepartureRow({ train, animDelay }: { train: TrainConnection; animDelay: number }) {
  const lang = useLang();
  const mins     = minsUntil(train.departure);
  const line     = trainLabel(train);
  const departed = mins !== null && mins < 0;

  return (
    <article
      className="rounded-md bg-zinc-950/80 px-2.5 py-1.5 text-zinc-100 shadow-sm ring-1 ring-zinc-700/70 animate-fade-in-up"
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">

        {/* Row 1: line badge + direction | countdown */}
        <div className="col-span-2 flex min-w-0 items-center gap-2">
          <TrainPictogram />
          <LineBadge label={line} />
          <div className="min-w-0 truncate text-[12px] leading-4 text-zinc-100">
            {tr(lang, 'direction')} {train.direction ?? train.to}
          </div>
        </div>
        <div className="text-right text-[13px] font-black leading-4 tabular-nums">
          {mins === null ? '--' : departed ? 'dep.' : fmtCountdown(mins)}
        </div>

        {/* Row 2: departure | timeline | arrival */}
        <div className="text-[12px] font-black leading-4 tabular-nums">
          {fmtTime(train.departure)}
          {train.delay > 0 && (
            <span className="ml-1 text-[11px] font-bold text-[#e00000]">+{train.delay}'</span>
          )}
        </div>
        <div className="min-w-0 pt-1">
          <Timeline legDurations={train.legDurations} />
        </div>
        <div className="text-right text-[12px] font-black leading-4 tabular-nums">
          {fmtTime(train.arrival)}
        </div>

        {/* Row 3: platform | capacity (centred) | duration */}
        <div className="text-[11px] leading-4 text-zinc-400">
          {tr(lang, 'platform')} {train.platform}
        </div>
        <div className="flex justify-center">
          <CapacityBlock first={train.capacity1st} second={train.capacity2nd} />
        </div>
        <div className="text-right text-[11px] leading-4 text-zinc-400 tabular-nums">
          {durationMinutes(train)}
        </div>

        {train.cancelled && (
          <div className="col-span-3 rounded bg-[#e00000] px-2 py-1 text-xs font-bold text-white">
            {tr(lang, 'cancelled')}
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Star icon ────────────────────────────────────────────────────────────────

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Favourites helpers ───────────────────────────────────────────────────────

const FAV_KEY = 'train_favourites';

function loadFavourites(): StationLocation[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as StationLocation[];
  } catch { /* ignore */ }
  return [];
}

function saveFavourites(favs: StationLocation[]): void {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch { /* ignore */ }
}

// ─── Station typeahead input ──────────────────────────────────────────────────

interface StationInputProps {
  value: string;
  placeholder: string;
  onQueryChange: (v: string) => void;
  onSelect: (station: StationLocation) => void;
  favourites: StationLocation[];
  onToggleFavourite: (station: StationLocation) => void;
}

function StationInput({
  value,
  placeholder,
  onQueryChange,
  onSelect,
  favourites,
  onToggleFavourite,
}: StationInputProps) {
  const [results, setResults]               = useState<StationLocation[]>([]);
  const [open, setOpen]                     = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const ref          = useRef<HTMLDivElement>(null);
  const userTypedRef = useRef(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!userTypedRef.current) return;
    if (value.length < 2) {
      setResults([]);
      if (favourites.length > 0) { setShowFavourites(true); setOpen(true); }
      else setOpen(false);
      return;
    }
    const id = setTimeout(() => {
      api.trainSearch(value)
        .then((r) => { setResults(r); setShowFavourites(false); setOpen(r.length > 0); })
        .catch(() => { setResults([]); setOpen(false); });
    }, 250);
    return () => clearTimeout(id);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    userTypedRef.current = true;
    onQueryChange(e.target.value);
  };

  const handleFocus = () => {
    if (favourites.length > 0) { setShowFavourites(true); setOpen(true); }
  };

  const isFav = (s: StationLocation) => favourites.some((f) => f.id === s.id);
  const dropdownItems: StationLocation[] = showFavourites ? favourites : results;

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <input
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="w-full bg-zinc-950/70 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 transition-colors"
      />
      {open && dropdownItems.length > 0 && (
        <div className="absolute left-0 top-full mt-0.5 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-30 overflow-hidden animate-fade-in-up">
          {showFavourites && (
            <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              Favourites
            </div>
          )}
          {dropdownItems.map((s) => (
            <div key={s.id} className="flex items-center hover:bg-zinc-800 transition-colors">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  userTypedRef.current = false;
                  onSelect(s);
                  setOpen(false);
                  setResults([]);
                  setShowFavourites(false);
                }}
                className="flex-1 min-w-0 text-left text-[11px] text-zinc-200 px-3 py-1.5 truncate"
              >
                {s.name}
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); onToggleFavourite(s); }}
                className="flex-shrink-0 px-2.5 py-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                aria-label={isFav(s) ? 'Remove from favourites' : 'Add to favourites'}
              >
                <StarIcon filled={isFav(s)} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TrainConnections({
  trains,
  onRefresh,
  lastUpdated,
}: {
  trains: TrainConnection[];
  onRefresh: () => void;
  lastUpdated: Date | null;
}) {
  const lang = useLang();

  // ── Favourites ──
  const [favourites, setFavourites] = useState<StationLocation[]>(loadFavourites);

  const toggleFavourite = useCallback((station: StationLocation) => {
    setFavourites((prev) => {
      const exists = prev.some((f) => f.id === station.id);
      const next   = exists ? prev.filter((f) => f.id !== station.id) : [...prev, station];
      const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name, 'de'));
      saveFavourites(sorted);
      return sorted;
    });
  }, []);

  // ── Route state ──
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery]     = useState('');

  // StationLocation is set only after the user explicitly selects a suggestion.
  // The query strings always hold the latest text and are used as fallback for
  // the fetch so that picking one field while the other already has text works
  // immediately without requiring both to be "selected" StationLocations.
  const [selectedFrom, setSelectedFrom] = useState<StationLocation | null>(null);
  const [selectedTo, setSelectedTo]     = useState<StationLocation | null>(null);

  const [customTrains, setCustomTrains]   = useState<TrainConnection[] | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  const [listVersion, setListVersion] = useState(0);
  const customFetchSeq = useRef(0);

  // Pre-fill text inputs from the server-provided default trains (programmatic,
  // must NOT fire the search effect).
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || trains.length === 0) return;
    initializedRef.current = true;
    setFromQuery(trains[0]?.from ?? '');
    setToQuery(trains[0]?.to ?? '');
  }, [trains]);

  // Bump list animation key when the parent refreshes the default trains.
  const prevTrainsRef = useRef(trains);
  useEffect(() => {
    if (trains !== prevTrainsRef.current && customTrains === null) {
      prevTrainsRef.current = trains;
      setListVersion((v) => v + 1);
    }
  }, [trains, customTrains]);

  const fetchCustom = useCallback(async (from: string, to: string) => {
    const seq = customFetchSeq.current + 1;
    customFetchSeq.current = seq;
    setCustomLoading(true);
    try {
      const data = await api.trainConnections(from, to);
      if (seq !== customFetchSeq.current) return;
      setCustomTrains(data);
      setListVersion((v) => v + 1);
    } catch (e) {
      if (seq !== customFetchSeq.current) return;
      if (e instanceof ApiError) console.error(e.message);
      setCustomTrains([]);
    } finally {
      if (seq === customFetchSeq.current) setCustomLoading(false);
    }
  }, []);

  // ── Station selection handlers ──
  // Fetch immediately using the just-selected station + whatever text is already
  // in the other field (selectedStation?.name falls back to raw query string).
  // This means the list updates the moment either station is chosen, even if the
  // other field was pre-filled from the server default and not "selected" yet.

  const handleFromSelect = (s: StationLocation) => {
    setFromQuery(s.name);
    setSelectedFrom(s);
    const dest = selectedTo?.name ?? toQuery;
    if (dest.trim()) void fetchCustom(s.name, dest.trim());
  };

  const handleToSelect = (s: StationLocation) => {
    setToQuery(s.name);
    setSelectedTo(s);
    const origin = selectedFrom?.name ?? fromQuery;
    if (origin.trim()) void fetchCustom(origin.trim(), s.name);
  };

  const handleRefresh = () => {
    const from = selectedFrom?.name ?? fromQuery;
    const to   = selectedTo?.name ?? toQuery;
    if (from.trim() && to.trim() && customTrains !== null) {
      void fetchCustom(from.trim(), to.trim());
    } else {
      onRefresh();
    }
  };

  const displayedTrains = customTrains ?? trains;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-800/60 text-zinc-100">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-zinc-700/50 bg-zinc-900/50 px-3 py-2">
        <div className="flex flex-1 min-w-0 items-center gap-1.5">
          <StationInput
            value={fromQuery}
            placeholder={tr(lang, 'from')}
            onQueryChange={(v) => { setFromQuery(v); if (v !== selectedFrom?.name) setSelectedFrom(null); }}
            onSelect={handleFromSelect}
            favourites={favourites}
            onToggleFavourite={toggleFavourite}
          />
          <span className="text-zinc-500 text-sm flex-shrink-0">→</span>
          <StationInput
            value={toQuery}
            placeholder={tr(lang, 'to')}
            onQueryChange={(v) => { setToQuery(v); if (v !== selectedTo?.name) setSelectedTo(null); }}
            onSelect={handleToSelect}
            favourites={favourites}
            onToggleFavourite={toggleFavourite}
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastUpdated && (
            <span className="text-[11px] text-zinc-500">
              {lastUpdated.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="tap-target h-7 w-7 rounded-full border border-zinc-600 bg-zinc-950 text-base font-bold leading-none text-zinc-200 hover:border-[#e00000] hover:text-[#e00000]"
            aria-label="Refresh connections"
          >
            ↻
          </button>
        </div>
      </div>

      {customLoading ? (
        <div className="px-3 py-4 text-xs text-zinc-500 animate-pulse">{tr(lang, 'loadingConn')}</div>
      ) : displayedTrains.length === 0 ? (
        <div className="px-3 py-4 text-xs text-zinc-500">{tr(lang, 'noConn')}</div>
      ) : (
        <div key={listVersion} className="touch-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5">
          {displayedTrains.map((train, i) => (
            <DepartureRow key={train.id} train={train} animDelay={i * 40} />
          ))}
        </div>
      )}
    </section>
  );
}
