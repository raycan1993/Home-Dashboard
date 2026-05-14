// Inline SVG icons keyed by the backend's stable weather-code names
// (sunny | partly-cloudy | rainy). The backend's describeCode() maps WMO codes
// to these three buckets so the frontend doesn't need its own mapping.

interface WeatherIconProps {
  code: string;
  size?: number;
  className?: string;
  animated?: boolean;
}

export function WeatherIcon({ code, size = 28, className = '', animated = false }: WeatherIconProps) {
  const wrapperClass = 'weather-icon weather-icon-' + code + (animated ? ' weather-icon-animated' : '') + (className ? ' ' + className : '');

  switch (code) {
    case 'sunny':
      return (
        <span className={wrapperClass} style={{ width: size, height: size }} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <g className="weather-layer weather-layer-back weather-rays">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <line
                  key={deg}
                  x1="12"
                  y1="3"
                  x2="12"
                  y2="0.9"
                  stroke="#FDE68A"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  transform={`rotate(${deg} 12 12)`}
                />
              ))}
            </g>
            <g className="weather-layer weather-sun-sparkles">
              <circle cx="18.4" cy="5.4" r="0.7" fill="#FEF3C7" />
              <circle cx="5.2" cy="17.8" r="0.55" fill="#FEF3C7" />
              <circle cx="19.2" cy="17.6" r="0.45" fill="#FDE68A" />
            </g>
            <g className="weather-layer weather-layer-front weather-orb">
              <circle cx="12" cy="12" r="5.6" fill="#FBBF24" />
              <circle cx="9.8" cy="9.6" r="2.1" fill="#FDE68A" opacity="0.7" />
            </g>
          </svg>
        </span>
      );
    case 'rainy':
      return (
        <span className={wrapperClass} style={{ width: size, height: size }} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <g className="weather-layer weather-layer-back weather-cloud-back">
              <ellipse cx="13" cy="9.5" rx="7.2" ry="4.8" fill="#475569" />
            </g>
            <g className="weather-layer weather-layer-mid weather-cloud-front">
              <ellipse cx="8.2" cy="11.2" rx="4.5" ry="3.2" fill="#94A3B8" />
              <ellipse cx="13.8" cy="11.3" rx="6.4" ry="3.9" fill="#64748B" />
            </g>
            <g className="weather-layer weather-rain-mist">
              <path d="M5.4 14.2C8.3 13.5 15 13.4 18.8 14.2" stroke="#BAE6FD" strokeWidth="0.8" strokeLinecap="round" opacity="0.45" />
            </g>
            <g className="weather-layer weather-layer-front weather-rain">
              <line x1="8.5" y1="15.5" x2="6.7" y2="20.2" stroke="#60A5FA" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="12.5" y1="15.5" x2="10.7" y2="20.2" stroke="#7DD3FC" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="16.5" y1="15.5" x2="14.7" y2="20.2" stroke="#60A5FA" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          </svg>
        </span>
      );
    case 'partly-cloudy':
    default:
      return (
        <span className={wrapperClass} style={{ width: size, height: size }} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <g className="weather-layer weather-layer-back weather-orb">
              <circle cx="9.5" cy="10.5" r="4.3" fill="#FBBF24" />
              <circle cx="8" cy="9" r="1.6" fill="#FDE68A" opacity="0.65" />
            </g>
            <g className="weather-layer weather-layer-mid weather-cloud-back">
              <ellipse cx="14.2" cy="14.7" rx="6.5" ry="4.2" fill="#94A3B8" />
            </g>
            <g className="weather-layer weather-cloud-highlight">
              <path d="M8 14.7C10.2 13.2 16.2 13.4 18.5 14.9" stroke="#E2E8F0" strokeWidth="0.9" strokeLinecap="round" opacity="0.45" />
            </g>
            <g className="weather-layer weather-layer-front weather-cloud-front">
              <ellipse cx="9" cy="16" rx="4.3" ry="3.1" fill="#CBD5E1" />
              <ellipse cx="15.3" cy="16" rx="5.1" ry="3.2" fill="#AAB7C8" />
            </g>
          </svg>
        </span>
      );
  }
}
