// 999 -> "999", 1000 -> "1k", 1850 -> "1.8k", 12400 -> "12k", 1_250_000 -> "1.2M".
// Round NAHI karte (floor) - 1999 "2k" ke bajaye "1.9k" dikhna chahiye.
export const formatCount = (n: number | null | undefined): string => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return `${k < 10 ? Math.floor(k * 10) / 10 : Math.floor(k)}k`;
  }
  const m = v / 1_000_000;
  return `${m < 10 ? Math.floor(m * 10) / 10 : Math.floor(m)}M`;
};

export const formatViews = (n: number | null | undefined): string => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return `${formatCount(v)} ${v === 1 ? 'view' : 'views'}`;
};