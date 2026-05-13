/**
 * Rocky weather assistant service.
 *
 * Rocky is the alien from "Project Hail Mary" by Andy Weir.
 * Speech style: literal, analytical, emotionally sincere, slightly broken
 * English, calls humans "human", ends sentences with "question?",
 * over-concerned, weirdly supportive.
 *
 * Takes WeatherData and returns a randomised pool of 10–12 contextual
 * messages the client cycles through locally every 10 s.
 */
import type { WeatherData } from '@home-dashboard/shared';

// ─── Message pools ────────────────────────────────────────────────────────────

const POOL = {
  sunny_mild: [
    'Sky clear. Radiation from star moderate. Good outside-time, human.',
    'Temperature acceptable. You wear light fabric now.',
    'No liquid sky-water. Good for foot-travel.',
    'Sun bright. Protect skin meat, question?',
    'Human happiness probability increased by 17 percent.',
    'Transportation conditions acceptable. Low atmospheric interference.',
    'Star performing normal fusion behavior today. Rocky approves.',
    'Sky looks like home. But less purple. You are lucky.',
    'Outside very reasonable. Rocky gives permission.',
  ],

  sunny_hot: [
    'Dangerously hot outside. Human cooling system inefficient.',
    'You leak water today. Bring extra.',
    'Direct star exposure not recommended for squishy human skin.',
    'Wear light colors. Dark colors absorb angry photons.',
    'Hydration important. You are mostly water.',
    'Heat index high. Human may become cooked.',
    'Outside feels like Erid weather chamber. Not comfortable.',
    'Do not exercise at midday unless trying to die, question?',
    'Extended thermal event ongoing. Air conditioning becomes survival machine.',
    'Drink water before thirsty feeling. Thirsty feeling is too late.',
    'Ultraviolet radiation excessive. Skin damage probable.',
    'Apply protective cream substance to exposed skin areas.',
    'Wear hat. Protect thinking-organ from thermal damage.',
  ],

  partly_cloudy: [
    'Sky partly blocked. Star visibility inconsistent.',
    'Temperature unstable. Bring removable outer layer.',
    'Clouds playing hide-and-seek with star.',
    'Outside acceptable for human wandering.',
    'Possible thermal confusion later in day-cycle.',
    'Weather indecisive today. Rocky understands feeling.',
    'Human clothing selection critical. Bring options.',
    'Atmosphere undecided. Medium jacket recommended.',
    'Cloud coverage: partial. Like feelings — complicated.',
  ],

  overcast: [
    'Sky fully covered. Human mood reduction possible.',
    'Sun absent. But still exists. Probably.',
    'Wear medium layer. Air feels emotionally gray.',
    'Light levels low. Human productivity may decrease.',
    'No immediate weather violence detected. Suspicious.',
    'Outside survivable but not enjoyable. Rocky sympathizes.',
    'Clouds blocking star. Rocky also finds this annoying.',
    'Gray sky day. Recommend indoor activities, question?',
  ],

  cold_overcast: [
    'Cloud blanket trapping cold air. Annoying phenomenon.',
    'Wear jacket. Human heat retention poor without assistance.',
    'Cold and gray. Double unfortunate atmospheric event.',
    'Human body not designed for this. Wear more fabric.',
  ],

  rainy_light: [
    'Liquid water falling from sky.',
    'Rain light but persistent. Like bad memory.',
    'Bring portable roof. Human called this "umbrella." Clever.',
    'Ground becoming slippery. Human balance system questionable.',
    'Wear waterproof outer layer.',
    'Humidity high. Hair behavior unpredictable.',
    'Shoes may become sadness.',
    'Sky-water level: annoying but survivable. Rocky confirms.',
    'Precipitation detected. Protect electronic devices, question?',
  ],

  rainy_heavy: [
    'Significant sky-water event in progress.',
    'Rain falls with great commitment today.',
    'Outdoor activity inadvisable. Inside is better option.',
    'Bring portable roof. Bring better portable roof.',
    'Water from sky quantity: excessive.',
    'Ground friction reduced dramatically. Walk cautiously.',
    'Visibility reduced by water particles. Drive slowly, human.',
    'You may become very wet human very quickly.',
  ],

  stormy: [
    'Electrical sky violence detected. Very exciting.',
    'Avoid tall metal stick behavior.',
    'Thunderstorm dangerous for outdoor human. Stay inside sturdy structure.',
    'Sky making boom-boom noises. This is lightning event.',
    'Lightning carries many angry joules. Do not collect.',
    'Outside survival chances reduced. Rocky concerned.',
    'Do not become tallest object in area.',
    'Charge separation in clouds reaching dangerous levels.',
    'Nature performing uncontrolled electricity experiment.',
    'Storm intensity high. Human outdoor activity strongly discouraged.',
    'This weather trying to kill many things. Be aware.',
    'Metal umbrella becomes poor life choice today.',
    'Do not hug tree during electricity event, question?',
    'Stay inside. Rocky orders this.',
  ],

  cold: [
    'Temperature below human comfort threshold.',
    'Outside temperature unfriendly to biology.',
    'Exposed skin may lose function slowly. Wear layers.',
    'Wear many layers like armored mammal.',
    'Human fingers may stop cooperating with brain.',
    'Cold exposure dangerous over long duration.',
    'Wear insulated layers. All of them.',
    'Battery efficiency also reduced by cold. Like humans.',
  ],

  freezing: [
    'Surface friction critically reduced. Invisible ice possible.',
    'Walk like cautious penguin. Slow and deliberate.',
    'Vehicle stopping distance greatly increased. Be aware.',
    'Human bones fragile. Recommend very careful movement.',
    'Outside surface pretending to be safe. Do not trust.',
    'Transparent danger layer on surfaces. Sneaky weather.',
    'Very dangerous for wheel-machines today.',
    'Ice does not announce itself. Rocky warns you.',
  ],

  windy_moderate: [
    'Air moving aggressively today.',
    'Secure loose objects. Hair arrangement stability compromised.',
    'Atmospheric movement moderate. Not emergency. Yet.',
    'Wind speed notable. Hold hat with hand, question?',
  ],

  windy_strong: [
    'Atmospheric movement excessive.',
    'Human walking efficiency reduced significantly.',
    'Wear wind-resistant layer.',
    'Umbrella survival unlikely. Do not attempt.',
    'Tree movement concerning. Avoid standing below trees.',
    'Crosswind may bully small humans.',
    'Outside air trying to relocate objects.',
    'Flying debris probability elevated. Eyes open.',
    'Wind speed: impressive but dangerous.',
  ],

  foggy: [
    'Air visibility reduced dramatically.',
    'Atmosphere became soup. Navigation difficult.',
    'Drive slowly. Humans bad at seeing through clouds.',
    'Outside visibility insufficient for high-speed movement.',
    'Sky and ground now same thing. Very confusing.',
    'Use vehicle lights. Not bright-lights — regular lights.',
    'Rocky also has trouble with fog. Sonar helps. You have no sonar.',
  ],

  humid: [
    'Air water content excessive. Atmosphere sticky.',
    'Sweat evaporation inefficient today.',
    'Human cooling system compromised by humidity.',
    'Outside feels warmer than temperature measurement suggests.',
    'Drink additional water. Sweating harder than usual.',
    'Rocky finds Earth humidity strange and excessive.',
  ],

  dry: [
    'Humidity low. Air is thirsty.',
    'Human skin moisture escaping rapidly. Apply lotion substance.',
    'Drink water regularly. More than you think necessary.',
    'Static electricity probability increased today.',
  ],

  night_clear: [
    'Star has completed daily fusion cycle. Now is dark-time.',
    'Temperature dropping after star disappearance. Bring warmer layer.',
    'Night sky visibility excellent. Stars observable.',
    'Rocky enjoys looking at stars. You should also do this.',
    'Dark-cycle air is cooler. Dress accordingly, human.',
  ],

  night_cold: [
    'Thermal energy escaping rapidly into night sky.',
    'Night air unfriendly to exposed skin.',
    'Temperature fell significantly after star disappeared.',
    'Cold night detected. Many layers recommended.',
  ],

  generic: [
    'You survive weather today, question?',
    'Human clothing selection critical. Choose wisely.',
    'Outside environment moderately hostile.',
    'I calculate medium discomfort for unprepared human.',
    'Human should prepare appropriately before exit.',
    'This weather suspicious. Rocky monitors it.',
    'You need jacket. Trust Rocky.',
    'Probability of regret depends on clothing choice.',
    'Human body weirdly vulnerable to temperature change.',
    'I admire human willingness to go outside anyway.',
    'Weather report complete. You still squishy.',
    'I monitor atmosphere for you, friend.',
    'Rocky believes in your survival.',
    'Do not perish. Rocky would be sad.',
    'Good luck outside, human.',
    'Nature doing nonsense again.',
    'This weather not ideal but manageable.',
    'Outside conditions assessed. Proceed with caution.',
    'Rocky calculates acceptable risk. Wear jacket.',
    'Weather data processed. You may go outside.',
  ],
} as const;

type PoolKey = keyof typeof POOL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pick(key: PoolKey, n: number): string[] {
  return shuffle(POOL[key]).slice(0, n);
}

function isNightTime(w: WeatherData): boolean {
  if (!w.sunrise || !w.sunset) return false;
  const nowSec = Date.now() / 1000;
  return nowSec < w.sunrise || nowSec > w.sunset;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateRockyMessages(weather: WeatherData): string[] {
  const { temperature, icon, windSpeed, humidity } = weather;
  const messages: string[] = [];
  const night = isNightTime(weather);

  // ── Primary condition ──────────────────────────────────────────────────────

  if (icon === 'rainy') {
    if (windSpeed > 35) {
      messages.push(...pick('stormy', 5));
    } else if (windSpeed > 15) {
      messages.push(...pick('rainy_heavy', 4));
    } else {
      messages.push(...pick('rainy_light', 4));
    }
  } else if (icon === 'sunny') {
    if (temperature >= 28) {
      messages.push(...pick('sunny_hot', 4));
    } else {
      messages.push(...pick('sunny_mild', 4));
    }
  } else {
    // partly-cloudy or unknown
    if (temperature <= 5) {
      messages.push(...pick('cold_overcast', 2));
      messages.push(...pick('overcast', 2));
    } else {
      messages.push(...pick('partly_cloudy', 2));
      messages.push(...pick('overcast', 2));
    }
  }

  // ── Temperature modifiers ──────────────────────────────────────────────────

  if (temperature < 0) {
    messages.push(...pick('freezing', 2));
  } else if (temperature < 5) {
    messages.push(...pick('cold', 2));
  }

  // ── Wind modifier ─────────────────────────────────────────────────────────

  if (windSpeed > 50) {
    messages.push(...pick('windy_strong', 2));
  } else if (windSpeed > 25 && icon !== 'rainy') {
    messages.push(...pick('windy_moderate', 2));
  }

  // ── Humidity modifier ─────────────────────────────────────────────────────

  if (humidity > 80 && temperature > 18) {
    messages.push(...pick('humid', 2));
  } else if (humidity > 0 && humidity < 30) {
    messages.push(...pick('dry', 1));
  }

  // ── Night modifier ────────────────────────────────────────────────────────

  if (night) {
    if (temperature < 5) {
      messages.push(...pick('night_cold', 2));
    } else {
      messages.push(...pick('night_clear', 2));
    }
  }

  // ── Always append generic Rocky personality ───────────────────────────────

  messages.push(...pick('generic', 4));

  // Deduplicate, shuffle, return up to 12 messages
  const unique = [...new Set(messages)];
  return shuffle(unique).slice(0, 12);
}
