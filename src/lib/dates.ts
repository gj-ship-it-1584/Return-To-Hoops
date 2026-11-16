/* Local-calendar date helpers. Dates are stored as 'YYYY-MM-DD' strings in local time. */
const pad = (n: number) => String(n).padStart(2, '0');

export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => keyOf(new Date());
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
};
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
export const diffDays = (from: string, to: string) => Math.round((parseKey(to).getTime() - parseKey(from).getTime()) / 86400000);
/** 0 = Sunday … 6 = Saturday */
export const weekday = (k: string) => parseKey(k).getDay();
export const firstMondayOnOrAfter = (k: string) => {
  const wd = weekday(k);
  return addDays(k, (8 - wd) % 7);
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dowShort = (k: string) => DOW[weekday(k)];
export const dowName = (n: number) => DOW_LONG[n];
export const dowLetter = (n: number) => DOW[n].slice(0, 1);
export const fmtDate = (k: string) => {
  const d = parseKey(k);
  return `${DOW_LONG[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
};
export const fmtShort = (k: string) => {
  const d = parseKey(k);
  return `${MON[d.getMonth()]} ${d.getDate()}`;
};
export const fmtDuration = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};
