// 総務省・e-Stat の一覧表（Excel）を「団体コード → 列の値」に読み替える
// 列の位置はファイルごと・年ごとに違うので、見出しの文字で列を探す（見つからなければ止める）
import { readXlsx } from './xlsx.mjs';

const norm = (s) => String(s ?? '')
  .replace(/[\s　]+/g, '')
  .replace(/[（(]/g, '(').replace(/[）)]/g, ')')
  .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  .replace(/＋/g, '+').replace(/／/g, '/');

// 6桁の団体コード（全国地方公共団体コード）。最後の1桁は検査数字なので、それで給料などの6桁の数と見分ける
const CODE = /^\d{6}$/;
export const checkDigitOk = (s) => {
  const d = [...s].map(Number);
  const r = (d[0] * 6 + d[1] * 5 + d[2] * 4 + d[3] * 3 + d[4] * 2) % 11;
  return (11 - r) % 10 === d[5];
};
export const codeOf = (v) => {
  if (v == null) return null;
  const s = typeof v === 'number' ? (Number.isInteger(v) && v > 0 && v < 1e6 ? String(v).padStart(6, '0') : '') : String(v).trim();
  return CODE.test(s) && checkDigitOk(s) && s.slice(0, 2) >= '01' && s.slice(0, 2) <= '47' ? s : null;
};

// 値：数値ならそのまま。「*」は秘匿（職員1〜2人）、「-」はなし。どちらも null にして理由を残す
export function val(v) {
  if (v == null || v === '') return { v: null, why: 'none' };
  if (typeof v === 'number') return { v, why: null };
  const s = String(v).trim();
  if (/^[*＊]+$/.test(s)) return { v: null, why: 'secret' };
  if (/^[-－―ー‐]+$/.test(s)) return { v: null, why: 'none' };
  const n = Number(s.replace(/,/g, ''));
  if (Number.isFinite(n) && s !== '') return { v: n, why: null };
  return { v: null, why: 'text', text: s };
}

// シートから表を作る: { labels: [列の見出し], rows: Map<キー, 行の配列>, codeCol, name }
// キーはふつう団体コード。団体コードがない表（都道府県名だけの表など）は keyOf(行) でキーを返す
export function sheetTable(sheet, { minRows = 20, codeCol: forceCol, keyOf } = {}) {
  const { rows } = sheet;
  // 団体コードの列：6桁コードが一番多く並ぶ列
  let codeCol = forceCol;
  if (codeCol == null && !keyOf) {
    const cnt = new Map();
    for (const r of rows) if (r) r.forEach((v, c) => { if (codeOf(v)) cnt.set(c, (cnt.get(c) || 0) + 1); });
    codeCol = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (codeCol == null) return null;
  }
  const key = keyOf || ((r) => codeOf(r[codeCol]));
  const dataRows = [];
  rows.forEach((r, i) => { if (r && key(r)) dataRows.push(i); });
  if (dataRows.length < minRows) return null;
  const first = dataRows[0];
  // 見出し：最初のデータ行より上（ただし表題の行は除くため、最大8行）。結合セルは左上の値で埋める
  const top = Math.max(0, first - 8);
  const width = Math.max(...rows.filter(Boolean).map((r) => r.length));
  const grid = [];
  for (let r = top; r < first; r++) grid.push(Array.from({ length: width }, (_, c) => rows[r]?.[c] ?? null));
  for (const m of sheet.merges) {
    if (m.r2 < top || m.r1 >= first) continue;
    const v = rows[m.r1]?.[m.c1];
    for (let r = Math.max(m.r1, top); r <= Math.min(m.r2, first - 1); r++) for (let c = m.c1; c <= m.c2; c++) if (grid[r - top][c] == null) grid[r - top][c] = v;
  }
  const labels = [];
  for (let c = 0; c < width; c++) {
    const parts = [];
    for (const g of grid) {
      // 数値（見出しの下にある「全地方公共団体」などの集計行の値）は見出しに入れない
      if (typeof g[c] === 'number') continue;
      const s = norm(g[c]);
      if (s && !/^単位|^\(単位/.test(s) && parts[parts.length - 1] !== s) parts.push(s);
    }
    labels[c] = parts.join('|');
  }
  const out = new Map();
  for (const i of dataRows) out.set(key(rows[i]), rows[i]);
  // 最初のデータ行より上にある集計行（「全地方公共団体」「全市区町村」など）
  const totals = new Map();
  for (let r = top; r < first; r++) {
    const row = rows[r];
    const t = row?.map((v) => norm(v)).find((s) => /^全(地方公共団体|都道府県|市区町村|政令指定都市|指定都市)$/.test(s));
    if (t) totals.set(t, row);
  }
  return { labels, rows: out, codeCol, name: sheet.name, totals };
}

// 見出しの正規表現で列を探す。複数当たるときは after（直前のグループ名）で絞る
export function col(table, re, { group, nth = 0 } = {}) {
  const hits = [];
  table.labels.forEach((l, c) => { if (re.test(l) && (!group || group.test(l))) hits.push(c); });
  if (hits[nth] == null) throw new Error(`列が見つかりません: ${re} ${group || ''}（シート「${table.name}」 見出し: ${table.labels.filter(Boolean).join(' / ').slice(0, 600)}）`);
  return hits[nth];
}

export function readTables(file, opts) {
  return readXlsx(file).map((s) => ({ sheet: s, table: sheetTable(s, opts) }));
}
