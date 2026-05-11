// Inline SVG icons keyed by the backend's stable weather-code names
// (sunny | partly-cloudy | rainy). The backend's describeCode() maps WMO codes
// to these three buckets so the frontend doesn't need its own mapping.

export function WeatherIcon({ code, size = 28 }: { code: string; size?: number }) {
  switch (code) {
    case 'sunny':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" fill="#FBBF24" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="12"
              y1="3"
              x2="12"
              y2="1"
              stroke="#FBBF24"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </svg>
      );
    case 'rainy':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="10" rx="7" ry="5" fill="#64748B" />
          <ellipse cx="7" cy="11" rx="4" ry="3" fill="#94A3B8" />
          <line x1="9" y1="16" x2="7" y2="20" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="13" y1="16" x2="11" y2="20" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17" y1="16" x2="15" y2="20" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'partly-cloudy':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="10" cy="11" r="4" fill="#FBBF24" />
          <ellipse cx="14" cy="15" rx="6" ry="4" fill="#94A3B8" />
          <ellipse cx="9" cy="16" rx="4" ry="3" fill="#CBD5E1" />
        </svg>
      );
  }
}
