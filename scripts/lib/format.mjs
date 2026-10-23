// 表示用の小さな関数

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const comma = (n) => (n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('ja-JP'));

// 円 → 「612.7万円」
export function man(yen, digits = 1, unit = '万円') {
  if (yen == null || !Number.isFinite(yen)) return '—';
  const v = yen / 1e4;
  return `${v.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit}`;
}
export const yen = (n) => (n == null || !Number.isFinite(n) ? '—' : `${comma(n)}円`);
export function num(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export const age = (v) => (v == null || !(v > 0) ? '—' : `${num(v, 1)}歳`);
export const pct = (v, digits = 1) => (v == null ? '—' : `${num(v * 100, digits)}%`);

// 差を「+1.2歳」「−3.4万円」のように
export function diff(v, fmt) {
  if (v == null || !Number.isFinite(v)) return '';
  const s = fmt(Math.abs(v));
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : '±0';
}

export const reiwaYear = (r) => 2018 + r;
export const reiwaLabel = (r) => `令和${r}年`;

export function median(sorted) {
  if (!sorted.length) return null;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// 同じ値は同じ順位（1,2,2,4…）
export function rankList(list, get, desc = true) {
  const rows = list.map((d) => ({ d, v: get(d) })).filter((x) => x.v != null && Number.isFinite(x.v));
  rows.sort((a, b) => (desc ? b.v - a.v : a.v - b.v) || a.d.code.localeCompare(b.d.code));
  let rank = 0;
  rows.forEach((x, i) => { if (i === 0 || x.v !== rows[i - 1].v) rank = i + 1; x.rank = rank; });
  return rows;
}
