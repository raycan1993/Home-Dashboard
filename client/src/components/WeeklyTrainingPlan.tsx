// Weekly training plan. Static for now — when a /api/training endpoint
// exists, swap trainingPlan for a hook.

import { Card, SectionTitle } from './Card';
import { trainingPlan, todayIdx } from '../mockData';

function typeColor(type: 'Strength' | 'Cardio' | 'Rest'): string {
  if (type === 'Strength') return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
  if (type === 'Cardio') return 'text-sky-400 bg-sky-400/10 border-sky-400/30';
  return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';
}

export function WeeklyTrainingPlan() {
  const today = todayIdx();
  return (
    <Card>
      <SectionTitle>Weekly training plan</SectionTitle>
      <div className="space-y-2">
        {trainingPlan.map((session, i) => {
          const isToday = i === today;
          return (
            <div
              key={session.day}
              className={
                'flex items-center gap-4 p-3 rounded-xl border transition-colors ' +
                (isToday
                  ? 'bg-zinc-700/60 border-sky-500/30'
                  : session.done
                    ? 'bg-zinc-900/30 border-zinc-700/20 opacity-60'
                    : 'bg-zinc-900/40 border-zinc-700/30')
              }
            >
              <div
                className={
                  'w-10 text-center text-[11px] font-bold ' +
                  (isToday ? 'text-sky-400' : 'text-zinc-500')
                }
              >
                {session.day}
                {isToday && <div className="text-[9px] text-sky-500">TODAY</div>}
              </div>
              <span
                className={
                  'text-[10px] font-semibold px-2 py-0.5 rounded-md border ' +
                  typeColor(session.type)
                }
              >
                {session.type}
              </span>
              <div className="flex-1">
                <div className="text-sm text-zinc-200">{session.label}</div>
                {(session.sets || session.duration) && (
                  <div className="text-[11px] text-zinc-500">
                    {session.sets ?? session.duration}
                  </div>
                )}
              </div>
              {session.done ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 10 10">
                    <path
                      d="M1.5 5l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-zinc-600" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
