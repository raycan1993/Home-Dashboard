// Static training data. When a /api/training endpoint exists, replace these
// exports with a backend call.

export interface TrainingSession {
  day: string;
  type: 'Strength' | 'Cardio' | 'Rest';
  label: string;
  sets?: string;
  duration?: string;
  done: boolean;
}

export const trainingPlan: TrainingSession[] = [
  { day: 'Mon', type: 'Strength', label: 'Upper body push', sets: '4x8', done: true },
  { day: 'Tue', type: 'Cardio', label: 'Easy run 5 km', duration: '30 min', done: true },
  { day: 'Wed', type: 'Strength', label: 'Lower body squat focus', sets: '4x6', done: true },
  { day: 'Thu', type: 'Rest', label: 'Active recovery / walk', done: true },
  { day: 'Fri', type: 'Strength', label: 'Upper body pull', sets: '4x8', done: false },
  { day: 'Sat', type: 'Cardio', label: 'Long run 12 km', duration: '65 min', done: false },
  { day: 'Sun', type: 'Rest', label: 'Full rest', done: false },
];

export interface Kpi {
  label: string;
  value: string;
  sub: string;
  trend: 'up' | 'down' | 'neutral';
}

export const kpis: Kpi[] = [
  { label: 'Weekly volume', value: '14 800 kg', sub: '+8% vs last week', trend: 'up' },
  { label: 'Training streak', value: '22 days', sub: 'Personal best', trend: 'up' },
  { label: 'Avg session', value: '58 min', sub: '-4 min vs last week', trend: 'down' },
  { label: 'Cardio this week', value: '17 km', sub: 'Goal: 20 km', trend: 'neutral' },
  { label: 'Strength sessions', value: '3 / 3', sub: 'On track', trend: 'up' },
  { label: 'Resting HR', value: '54 bpm', sub: '-2 vs last month', trend: 'up' },
];

export function todayIdx(): number {
  const js = new Date().getDay();
  return (js + 6) % 7;
}
