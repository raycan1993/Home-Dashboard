// SBB-style train departures, driven by /api/dashboard.trains.
import type { TrainConnection } from '@home-dashboard/shared';

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

function durationMinutes(t: TrainConnection): string {
  const fromIso = new Date(t.departure).getTime();
  const toIso = new Date(t.arrival).getTime();
  if (!isNaN(fromIso) && !isNaN(toIso) && toIso >= fromIso) {
    return Math.round((toIso - fromIso) / 60_000) + ' min';
  }
  const parts = t.duration.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return t.duration || '-- min';
  const hours = parts.length === 3 ? parts[0] ?? 0 : 0;
  const minutes = parts.length === 3 ? parts[1] ?? 0 : parts[1] ?? 0;
  return hours * 60 + minutes + ' min';
}

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
      ? 'border border-slate-300 bg-slate-950 text-slate-100'
      : kind === 'red'
        ? 'bg-[#e00000] text-white italic'
        : 'bg-slate-950 text-white';
  return (
    <span className={'inline-flex h-3.5 min-w-10 items-center rounded-[2px] px-1.5 text-[10px] font-extrabold leading-none ' + classes}>
      {compact}
    </span>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 8 18" aria-hidden="true" className={'h-3 w-1.5 ' + (active ? 'text-sky-300' : 'text-slate-600')}>
      <circle cx="4" cy="3" r="2" fill="currentColor" />
      <path fill="currentColor" d="M2 6h4l.8 5H5.6V18H2.4v-7H1.2L2 6Z" />
    </svg>
  );
}

function Capacity({ value }: { value?: number | null }) {
  const active = value && value > 0 ? Math.min(3, Math.max(1, Math.round(value))) : 0;
  return (
    <span className="inline-flex items-center gap-[1px] align-middle" aria-label={active ? `Auslastung ${active} von 3` : 'Auslastung unbekannt'}>
      {[0, 1, 2].map((i) => (
        <PersonIcon key={i} active={i < active} />
      ))}
    </span>
  );
}

function CapacityBlock({ first, second }: { first?: number | null; second?: number | null }) {
  return (
    <div className="flex items-center justify-center gap-2 text-[11px] text-slate-200">
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold">1.</span>
        <Capacity value={first} />
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold">2.</span>
        <Capacity value={second} />
      </span>
    </div>
  );
}

function Timeline() {
  return (
    <div className="relative h-3 w-full">
      <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-slate-200" />
      <div className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-slate-200" />
      <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-slate-200" />
    </div>
  );
}

function DepartureRow({ train }: { train: TrainConnection }) {
  const mins = minsUntil(train.departure);
  const line = trainLabel(train);
  const departed = mins !== null && mins < 0;

  return (
    <article className="rounded-md bg-slate-950/80 px-2.5 py-1.5 text-slate-100 shadow-sm ring-1 ring-slate-700/70">
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-2 gap-y-1">
        <div className="col-span-2 flex min-w-0 items-center gap-2">
          <TrainPictogram />
          <LineBadge label={line} />
          <div className="min-w-0 truncate text-[12px] leading-4 text-slate-100">
            Richtung {train.direction ?? train.to}
          </div>
        </div>

        <div className="text-right text-[13px] font-black leading-4">
          {mins === null ? '--' : departed ? 'ab' : `${mins}'`}
        </div>

        <div className="text-[12px] font-black leading-4">
          {fmtTime(train.departure)}
          {train.delay > 0 && <span className="ml-1 text-[11px] font-bold text-[#e00000]">+{train.delay}'</span>}
        </div>

        <div className="min-w-0 pt-1">
          <Timeline />
        </div>

        <div className="text-right text-[12px] font-black leading-4">{fmtTime(train.arrival)}</div>

        <div className="text-[12px] leading-4">Gl. {train.platform}</div>
        <CapacityBlock first={train.capacity1st} second={train.capacity2nd} />
        <div className="text-right text-[12px] leading-4">{durationMinutes(train)}</div>

        {train.cancelled && (
          <div className="col-span-3 rounded bg-[#e00000] px-2 py-1 text-xs font-bold text-white">
            Ausfall
          </div>
        )}
      </div>
    </article>
  );
}

export function TrainConnections({
  trains,
  onRefresh,
  lastUpdated,
}: {
  trains: TrainConnection[];
  onRefresh: () => void;
  lastUpdated: Date | null;
}) {
  const route = trains[0] ? `${trains[0].from} - ${trains[0].to}` : 'Zugverbindungen';

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/60 text-slate-100">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-700/50 bg-slate-900/50 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-black leading-4">Abfahrten</h2>
          <p className="truncate text-[10px] text-slate-500">{route}</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[11px] text-slate-500">
              {lastUpdated.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="tap-target h-7 w-7 rounded-full border border-slate-600 bg-slate-950 text-base font-bold leading-none text-slate-200 hover:border-[#e00000] hover:text-[#e00000]"
            aria-label="Zugverbindungen aktualisieren"
          >
            ↻
          </button>
        </div>
      </div>

      {trains.length === 0 ? (
        <div className="px-3 py-4 text-xs text-slate-500">Keine Verbindungen gefunden.</div>
      ) : (
        <div className="touch-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5">
          {trains.map((train) => (
            <DepartureRow key={train.id} train={train} />
          ))}
        </div>
      )}
    </section>
  );
}
