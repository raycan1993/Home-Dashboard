/**
 * Rocky weather assistant widget.
 *
 * Rocky is the alien from "Project Hail Mary" by Andy Weir —
 * 5-legged, amber-brown, no face, senses via sonar, speaks in terse
 * broken English, overly concerned about human survival.
 *
 * The component polls /api/rocky every 5 minutes and cycles through
 * the returned messages locally every 10 seconds with a fade transition.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { useLang, tr } from '../i18n';

const CYCLE_MS = 10_000;    // rotate message every 10 s
const REFETCH_MS = 5 * 60_000; // re-fetch pool every 5 min
const FADE_MS = 380;        // fade-out duration before swapping text

// ─── Rocky SVG illustration ───────────────────────────────────────────────────

function RockySvg() {
  const TealSpot = ({ cx, cy, r = 5 }: { cx: number; cy: number; r?: number }) => (
    <>
      <circle cx={cx} cy={cy} r={r * 1.5} fill="#20B2AA" opacity={0.15}/>
      <circle cx={cx} cy={cy} r={r}       fill="#20B2AA" opacity={0.55}/>
      <circle cx={cx} cy={cy} r={r * 0.5} fill="#7FFFD4"/>
    </>
  );

  return (
    <svg
      viewBox="0 0 120 112"
      width="106"
      height="99"
      aria-label="Rocky the alien weather assistant"
      className="flex-shrink-0 drop-shadow-lg"
    >
      {/* Upper-left arm */}
      <line x1="25" y1="44" x2="13" y2="27" stroke="#A06B35" strokeWidth="10" strokeLinecap="round"/>
      <line x1="13" y1="27" x2="8"  y2="14" stroke="#A06B35" strokeWidth="8"  strokeLinecap="round"/>
      <line x1="8"  y1="14" x2="4"  y2="6"  stroke="#A06B35" strokeWidth="6"  strokeLinecap="round"/>
      <line x1="8"  y1="14" x2="13" y2="5"  stroke="#A06B35" strokeWidth="6"  strokeLinecap="round"/>

      {/* Upper-right arm */}
      <line x1="95" y1="44" x2="107" y2="27" stroke="#A06B35" strokeWidth="10" strokeLinecap="round"/>
      <line x1="107" y1="27" x2="112" y2="14" stroke="#A06B35" strokeWidth="8"  strokeLinecap="round"/>
      <line x1="112" y1="14" x2="107" y2="5"  stroke="#A06B35" strokeWidth="6"  strokeLinecap="round"/>
      <line x1="112" y1="14" x2="116" y2="6"  stroke="#A06B35" strokeWidth="6"  strokeLinecap="round"/>

      {/* Lower-left leg */}
      <line x1="25" y1="67" x2="13"  y2="82" stroke="#A06B35" strokeWidth="11" strokeLinecap="round"/>
      <line x1="13" y1="82" x2="8"   y2="97" stroke="#A06B35" strokeWidth="9"  strokeLinecap="round"/>

      {/* Lower-right leg */}
      <line x1="95"  y1="67" x2="107" y2="82" stroke="#A06B35" strokeWidth="11" strokeLinecap="round"/>
      <line x1="107" y1="82" x2="112" y2="97" stroke="#A06B35" strokeWidth="9"  strokeLinecap="round"/>

      {/* Centre leg */}
      <line x1="60" y1="74" x2="60" y2="89"  stroke="#A06B35" strokeWidth="11" strokeLinecap="round"/>
      <line x1="60" y1="89" x2="60" y2="104" stroke="#A06B35" strokeWidth="9"  strokeLinecap="round"/>

      {/* Ball joints */}
      <circle cx="13"  cy="27" r="6.5" fill="#7A4820"/>
      <circle cx="8"   cy="14" r="5.5" fill="#7A4820"/>
      <circle cx="107" cy="27" r="6.5" fill="#7A4820"/>
      <circle cx="112" cy="14" r="5.5" fill="#7A4820"/>
      <circle cx="13"  cy="82" r="7"   fill="#7A4820"/>
      <circle cx="107" cy="82" r="7"   fill="#7A4820"/>
      <circle cx="60"  cy="89" r="6.5" fill="#7A4820"/>

      {/* Body */}
      <ellipse cx="60" cy="56" rx="38" ry="21" fill="#C08850"/>
      <path d="M 26 52 Q 60 48 94 52" stroke="#8B5A2B" strokeWidth="1.2" fill="none" opacity="0.35"/>
      <path d="M 24 58 Q 60 54 96 58" stroke="#8B5A2B" strokeWidth="1"   fill="none" opacity="0.25"/>
      <path d="M 26 64 Q 60 60 94 64" stroke="#8B5A2B" strokeWidth="0.9" fill="none" opacity="0.18"/>
      <line x1="60" y1="36" x2="60" y2="76" stroke="#8B5A2B" strokeWidth="1.2" opacity="0.25"/>
      <ellipse cx="60" cy="56" rx="38" ry="21" fill="none" stroke="#7A4820" strokeWidth="1.8"/>
      <ellipse cx="50" cy="49" rx="13" ry="7" fill="white" opacity="0.08"/>

      {/* Teal spots */}
      <TealSpot cx={38} cy={54} r={4.5}/>
      <TealSpot cx={82} cy={54} r={4.5}/>
      <TealSpot cx={60} cy={66} r={3.5}/>
      <TealSpot cx={13}  cy={27} r={3.5}/>
      <TealSpot cx={107} cy={27} r={3.5}/>
      <TealSpot cx={18}  cy={36} r={2.5}/>
      <TealSpot cx={102} cy={36} r={2.5}/>
      <TealSpot cx={13}  cy={82} r={4}/>
      <TealSpot cx={107} cy={82} r={4}/>
      <TealSpot cx={60}  cy={89} r={3.5}/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  plz?: string;
  devMessages?: string[];
}

export function RockyAssistant({ plz, devMessages }: Props) {
  const lang = useLang();
  const [messages, setMessages] = useState<string[]>([]);
  const [idx, setIdx]           = useState(0);
  const [visible, setVisible]   = useState(true);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (devMessages) return;
    try {
      const msgs = await api.rocky(plz);
      if (msgs.length > 0) {
        setMessages(msgs);
        setIdx(0);
        setVisible(true);
        setFetchError(null);
      }
    } catch (e) {
      setFetchError(e instanceof ApiError ? e.message : tr(lang, 'rockyOffline'));
    } finally {
      setLoading(false);
    }
  }, [devMessages, plz]);

  useEffect(() => {
    if (devMessages) {
      setMessages(devMessages);
      setIdx(0);
      setVisible(true);
      setLoading(false);
      setFetchError(null);
      return;
    }
    void fetchMessages();
    const id = setInterval(() => void fetchMessages(), REFETCH_MS);
    return () => clearInterval(id);
  }, [devMessages, fetchMessages]);

  useEffect(() => {
    if (messages.length < 2) return;
    const id = setInterval(() => {
      setVisible(false);
      swapTimerRef.current = setTimeout(() => {
        setIdx((i) => (i + 1) % messages.length);
        setVisible(true);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => {
      clearInterval(id);
      if (swapTimerRef.current !== null) clearTimeout(swapTimerRef.current);
    };
  }, [messages.length]);

  const currentMessage = messages[idx] ?? null;

  return (
    <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/60 px-3 py-2.5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {tr(lang, 'rockyTitle')}
      </div>

      <div className="flex items-center gap-3 min-h-[104px]">
        <div className="flex-shrink-0">
          <RockySvg />
        </div>

        <div className="relative flex-1 min-w-0">
          <div
            className="absolute -left-2 top-1/2 -tranzinc-y-1/2 h-0 w-0"
            style={{
              borderTop:    '7px solid transparent',
              borderBottom: '7px solid transparent',
              borderRight:  '9px solid rgba(51,65,85,0.7)',
            }}
          />
          <div className="rounded-2xl rounded-tl-sm border border-zinc-600/50 bg-zinc-900/70 px-3.5 py-3 shadow-inner">
            {loading && (
              <p className="text-[12px] italic text-zinc-500">
                {tr(lang, 'rockyLoading')}
              </p>
            )}
            {!loading && fetchError && (
              <p className="text-[12px] text-rose-400">{fetchError}</p>
            )}
            {!loading && !fetchError && currentMessage && (
              <p
                className="text-[12.5px] leading-relaxed text-zinc-100"
                style={{
                  opacity:    visible ? 1 : 0,
                  transition: `opacity ${FADE_MS}ms ease-in-out`,
                }}
              >
                {currentMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
