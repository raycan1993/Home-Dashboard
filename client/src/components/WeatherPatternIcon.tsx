import { WeatherPattern } from '@home-dashboard/shared';

export const WEATHER_PATTERN_LABELS: Record<WeatherPattern, string> = {
  [WeatherPattern.Sunny]: 'Sunny',
  [WeatherPattern.MostlySunny]: 'Mostly sunny',
  [WeatherPattern.PartlyCloudy]: 'Partly cloudy',
  [WeatherPattern.Cloudy]: 'Cloudy',
  [WeatherPattern.Overcast]: 'Overcast',
  [WeatherPattern.LightRain]: 'Light rain',
  [WeatherPattern.Rain]: 'Rain',
  [WeatherPattern.HeavyRain]: 'Heavy rain',
  [WeatherPattern.Thunderstorm]: 'Thunderstorm',
  [WeatherPattern.Snow]: 'Snow',
  [WeatherPattern.Sleet]: 'Sleet',
  [WeatherPattern.Fog]: 'Fog',
  [WeatherPattern.LowStratus]: 'Low stratus',
  [WeatherPattern.Windy]: 'Windy',
  [WeatherPattern.Hail]: 'Hail',
  [WeatherPattern.ClearNight]: 'Clear night',
  [WeatherPattern.PartlyCloudyNight]: 'Partly cloudy night',
  [WeatherPattern.Unknown]: 'Unknown',
};

export const WEATHER_PATTERN_EXAMPLES = Object.values(WeatherPattern).map((pattern, i) => ({
  weatherCode: pattern === WeatherPattern.Unknown ? 999 : i + 1,
  pattern,
  label: WEATHER_PATTERN_LABELS[pattern],
}));

export function weatherCodeToPattern(code: number | null | undefined, isNight = false): {
  pattern: WeatherPattern;
  fallbackReason: string | null;
} {
  if (code == null) {
    return {
      pattern: isNight ? WeatherPattern.PartlyCloudyNight : WeatherPattern.PartlyCloudy,
      fallbackReason: 'No weather code available; using a readable cloudy fallback.',
    };
  }
  const day = code > 50 ? code - 50 : code;
  const nightVariant = isNight || code > 50;
  if (day === 1) return { pattern: nightVariant ? WeatherPattern.ClearNight : WeatherPattern.Sunny, fallbackReason: null };
  if (day === 2 || day === 26) return { pattern: nightVariant ? WeatherPattern.PartlyCloudyNight : WeatherPattern.MostlySunny, fallbackReason: null };
  if (day === 3 || day === 27) return { pattern: nightVariant ? WeatherPattern.PartlyCloudyNight : WeatherPattern.PartlyCloudy, fallbackReason: null };
  if (day === 4 || day === 28) return { pattern: WeatherPattern.Cloudy, fallbackReason: null };
  if (day === 5) return { pattern: WeatherPattern.Overcast, fallbackReason: null };
  if (day === 6) return { pattern: WeatherPattern.LowStratus, fallbackReason: null };
  if (day >= 7 && day <= 9) return { pattern: WeatherPattern.Fog, fallbackReason: null };
  if (day === 10 || day === 11) return { pattern: WeatherPattern.LightRain, fallbackReason: null };
  if (day >= 12 && day <= 14) return { pattern: WeatherPattern.Rain, fallbackReason: null };
  if (day === 15 || day === 16) return { pattern: WeatherPattern.HeavyRain, fallbackReason: null };
  if (day >= 17 && day <= 19) return { pattern: WeatherPattern.Snow, fallbackReason: null };
  if (day === 20 || day === 21) return { pattern: WeatherPattern.Sleet, fallbackReason: null };
  if (day >= 22 && day <= 24) return { pattern: WeatherPattern.Thunderstorm, fallbackReason: null };
  if (day === 25) return { pattern: WeatherPattern.Hail, fallbackReason: null };
  return {
    pattern: nightVariant ? WeatherPattern.PartlyCloudyNight : WeatherPattern.PartlyCloudy,
    fallbackReason: `Unknown weather code ${code}; using a readable cloudy fallback.`,
  };
}

export function weatherPatternLabel(pattern: WeatherPattern | undefined): string {
  return WEATHER_PATTERN_LABELS[pattern ?? WeatherPattern.Unknown] ?? WEATHER_PATTERN_LABELS[WeatherPattern.Unknown];
}

export function WeatherPatternIcon({
  pattern,
  size = 112,
  animated = false,
  forceNight = false,
  className = '',
}: {
  pattern: WeatherPattern;
  size?: number;
  animated?: boolean;
  forceNight?: boolean;
  className?: string;
}) {
  const resolved = forceNight ? nightPattern(pattern) : pattern;
  return (
    <span
      className={'weather-pattern-icon ' + (animated ? 'weather-pattern-icon-animated ' : '') + className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 96 96" fill="none">
        {renderPattern(resolved)}
      </svg>
    </span>
  );
}

function renderPattern(pattern: WeatherPattern) {
  switch (pattern) {
    case WeatherPattern.Sunny:
      return <Sunny mostly={false} />;
    case WeatherPattern.MostlySunny:
      return <Sunny mostly />;
    case WeatherPattern.PartlyCloudy:
      return <PartlyCloudy night={false} />;
    case WeatherPattern.Cloudy:
      return <Cloud cover={0.75} />;
    case WeatherPattern.Overcast:
      return <Cloud cover={1} />;
    case WeatherPattern.LightRain:
      return <Rain drops={2} heavy={false} />;
    case WeatherPattern.Rain:
      return <Rain drops={3} heavy={false} />;
    case WeatherPattern.HeavyRain:
      return <Rain drops={5} heavy />;
    case WeatherPattern.Thunderstorm:
      return <Thunderstorm />;
    case WeatherPattern.Snow:
      return <Snow />;
    case WeatherPattern.Sleet:
      return <Sleet />;
    case WeatherPattern.Fog:
      return <Fog low={false} />;
    case WeatherPattern.LowStratus:
      return <Fog low />;
    case WeatherPattern.Windy:
      return <Windy />;
    case WeatherPattern.Hail:
      return <Hail />;
    case WeatherPattern.ClearNight:
      return <ClearNight />;
    case WeatherPattern.PartlyCloudyNight:
      return <PartlyCloudy night />;
    case WeatherPattern.Unknown:
    default:
      return <PartlyCloudy night={false} />;
  }
}

function Sunny({ mostly }: { mostly: boolean }) {
  return (
    <>
      <g className="wp-rays" stroke="#FDE047" strokeWidth="5" strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line key={deg} x1="48" y1="8" x2="48" y2="18" transform={`rotate(${deg} 48 48)`} />
        ))}
      </g>
      <circle className="wp-sun" cx="48" cy="48" r={mostly ? 22 : 24} fill="#FBBF24" />
      <circle cx="39" cy="38" r="7" fill="#FEF3C7" opacity="0.55" />
      {mostly && <CloudShape x={43} y={51} scale={0.78} dark={false} />}
    </>
  );
}

function PartlyCloudy({ night }: { night: boolean }) {
  return (
    <>
      {night ? <Moon /> : <Sunny mostly={false} />}
      <CloudShape x="28" y="46" scale={1} dark={false} />
    </>
  );
}

function Cloud({ cover }: { cover: number }) {
  return (
    <>
      {cover >= 1 && <rect x="12" y="25" width="72" height="41" rx="18" fill="#475569" opacity="0.72" />}
      <CloudShape x="20" y="37" scale={1.12} dark={cover >= 1} />
      <CloudShape x="37" y="45" scale={0.92} dark={false} />
    </>
  );
}

function Rain({ drops, heavy }: { drops: number; heavy: boolean }) {
  return (
    <>
      <Cloud cover={heavy ? 1 : 0.75} />
      <RainDrops count={drops} heavy={heavy} />
    </>
  );
}

function Thunderstorm() {
  return (
    <>
      <Cloud cover={1} />
      <path className="wp-lightning" d="M50 55h13L53 74h9L45 92l5-24h-9z" fill="#FACC15" />
      <RainDrops count={3} heavy />
    </>
  );
}

function Snow() {
  return (
    <>
      <Cloud cover={0.85} />
      {[28, 43, 58, 73].map((x, i) => (
        <text key={x} x={x} y={76 + (i % 2) * 6} textAnchor="middle" className="wp-snow" fill="#E0F2FE" fontSize="18">*</text>
      ))}
    </>
  );
}

function Sleet() {
  return (
    <>
      <Cloud cover={0.85} />
      <RainDrops count={2} heavy={false} />
      <text x="64" y="79" textAnchor="middle" className="wp-snow" fill="#E0F2FE" fontSize="18">*</text>
    </>
  );
}

function Fog({ low }: { low: boolean }) {
  return (
    <>
      {low && <CloudShape x="20" y="24" scale={0.95} dark={false} />}
      {[38, 50, 62, 74].map((y, i) => (
        <path key={y} className="wp-fog" d={`M16 ${y} C30 ${y - 6}, 43 ${y + 6}, 58 ${y} S76 ${y - 1}, 84 ${y}`} stroke={i % 2 ? '#CBD5E1' : '#94A3B8'} strokeWidth="5" strokeLinecap="round" fill="none" />
      ))}
    </>
  );
}

function Windy() {
  return (
    <>
      {[34, 48, 63].map((y, i) => (
        <path key={y} className="wp-wind" d={`M12 ${y}h48c13 0 13-17 0-17-6 0-10 3-12 8M20 ${y + 12}h54c10 0 10 13 0 13-5 0-8-2-10-6`} stroke={i === 1 ? '#BAE6FD' : '#E0F2FE'} strokeWidth="5" strokeLinecap="round" fill="none" opacity={0.9 - i * 0.15} />
      ))}
    </>
  );
}

function Hail() {
  return (
    <>
      <Cloud cover={1} />
      {[29, 43, 57, 71].map((x) => <circle key={x} cx={x} cy="75" r="5" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="2" />)}
    </>
  );
}

function ClearNight() {
  return (
    <>
      <Moon />
      <circle className="wp-star" cx="70" cy="26" r="2.2" fill="#E0F2FE" />
      <circle className="wp-star" cx="25" cy="34" r="1.8" fill="#E0F2FE" />
      <circle className="wp-star" cx="65" cy="68" r="1.5" fill="#E0F2FE" />
    </>
  );
}

function Moon() {
  return (
    <g className="wp-moon">
      <circle cx="46" cy="43" r="25" fill="#CBD5E1" />
      <circle cx="57" cy="34" r="24" fill="#1E293B" />
      <circle cx="37" cy="36" r="3" fill="#94A3B8" opacity="0.75" />
      <circle cx="44" cy="54" r="4" fill="#94A3B8" opacity="0.55" />
    </g>
  );
}

function CloudShape({ x, y, scale, dark }: { x: number | string; y: number | string; scale: number; dark: boolean }) {
  const tx = typeof x === 'number' ? x : Number(x);
  const ty = typeof y === 'number' ? y : Number(y);
  return (
    <g className="wp-cloud" transform={`translate(${tx} ${ty}) scale(${scale})`}>
      <ellipse cx="22" cy="20" rx="18" ry="14" fill={dark ? '#64748B' : '#CBD5E1'} />
      <ellipse cx="39" cy="16" rx="17" ry="17" fill={dark ? '#475569' : '#94A3B8'} />
      <ellipse cx="54" cy="23" rx="20" ry="13" fill={dark ? '#64748B' : '#CBD5E1'} />
      <rect x="16" y="21" width="47" height="18" rx="9" fill={dark ? '#64748B' : '#CBD5E1'} />
      <path d="M20 27h41" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" opacity="0.26" />
    </g>
  );
}

function RainDrops({ count, heavy }: { count: number; heavy: boolean }) {
  const xs = count === 5 ? [24, 36, 48, 60, 72] : count === 3 ? [32, 48, 64] : [38, 58];
  return (
    <g className="wp-rain" stroke={heavy ? '#38BDF8' : '#7DD3FC'} strokeWidth={heavy ? 5 : 4} strokeLinecap="round">
      {xs.map((x, i) => <line key={x} x1={x} y1={64 + (i % 2) * 2} x2={x - 6} y2={82 + (i % 2) * 2} />)}
    </g>
  );
}

function nightPattern(pattern: WeatherPattern): WeatherPattern {
  if (pattern === WeatherPattern.Sunny || pattern === WeatherPattern.MostlySunny) return WeatherPattern.ClearNight;
  if (pattern === WeatherPattern.PartlyCloudy) return WeatherPattern.PartlyCloudyNight;
  return pattern;
}
