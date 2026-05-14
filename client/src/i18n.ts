// Minimal i18n: context + translation helper used across the whole app.
import { createContext, useContext } from 'react';

export type Lang = 'en' | 'de';

export const LangContext = createContext<Lang>('en');
export const useLang = () => useContext(LangContext);

const T = {
  // ── Weather ──────────────────────────────────────────────────────────────────
  weatherLoading:    { en: 'Loading...',                       de: 'Lädt...' },
  feelsLike:         { en: 'Feels like',                       de: 'Gefühlte' },
  today:             { en: 'Today',                            de: 'Heute' },
  next24h:           { en: 'Next 24 hours',                    de: 'Nächste 24 Stunden' },
  next7days:         { en: 'Next 7 days',                      de: 'Nächsten 7 Tage' },
  changeLocation:    { en: 'Change location',                  de: 'Ort ändern' },
  searchPlaceholder: { en: 'Search city or postcode...',       de: 'Stadt oder PLZ suchen...' },
  searching:         { en: 'Searching...',                     de: 'Sucht...' },
  searchFailed:      { en: 'Search failed',                    de: 'Suche fehlgeschlagen' },
  noResults:         { en: 'No results.',                      de: 'Keine Treffer.' },
  descSunny:         { en: 'Sunny',                            de: 'Sonnig' },
  descRainy:         { en: 'Rainy',                            de: 'Regnerisch' },
  descCloudy:        { en: 'Partly cloudy',                    de: 'Teilweise bewölkt' },
  // ── Trains ───────────────────────────────────────────────────────────────────
  from:              { en: 'From...',                          de: 'Von...' },
  to:                { en: 'To...',                            de: 'Nach...' },
  direction:         { en: 'Direction',                        de: 'Richtung' },
  platform:          { en: 'Pl.',                              de: 'Gl.' },
  cancelled:         { en: 'Cancelled',                        de: 'Ausfall' },
  loadingConn:       { en: 'Loading connections…',             de: 'Verbindungen werden geladen…' },
  noConn:            { en: 'No connections found.',            de: 'Keine Verbindungen gefunden.' },
  // ── Rocky ────────────────────────────────────────────────────────────────────
  rockyTitle:        { en: 'Rocky the Assistant',              de: 'Rocky der Assistent' },
  rockyLoading:      { en: 'Rocky is analyzing atmosphere...', de: 'Rocky analysiert die Atmosphäre...' },
  rockyOffline:      { en: 'Rocky offline. Possibly napping.', de: 'Rocky offline. Schläft vielleicht.' },
} as const;

type TKey = keyof typeof T;
export function tr(lang: Lang, key: TKey): string {
  return T[key][lang];
}
