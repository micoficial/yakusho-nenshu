// 公開データ → 静的サイト（dist/）を作る
// 使い方: node scripts/build.mjs   （先に bash scripts/fetch.sh でデータを取る）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadAll } from './lib/load.mjs';
import { PREFS, GROUPS, METRICS, JOBS, PER_PAGE } from './lib/meta.mjs';
import { setAssetVersion, setBuildInfo, abs, dantaiPath, prefPath, rankPath, jobPath, BASE } from './lib/html.mjs';
import { median, rankList, comma } from './lib/format.mjs';
import { renderDantai } from './pages/dantai.mjs';
import {
  renderTop, renderRankingIndex, renderRanking, renderPrefIndex, renderPref, renderJobIndex, renderJob, renderAge, renderAbout, renderSearch, render404,
} from './pages/hubs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
const DIST = path.join(ROOT, 'dist');
const LIMIT = process.env.LIMIT ? +process.env.LIMIT : 0; // 試しに少ない件数で作るとき

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const { D, totals, totalsByYear, manifest, age, ageKyuryo } = loadAll(RAW);
const R = manifest.reiwa;
const list = [...D.values()].sort((a, b) => a.code.localeCompare(b.code));
log('loaded', list.length, '団体', `令和${R}年`, 'past', manifest.past);
if (list.length < 1700) throw new Error(`団体の数が少なすぎます（${list.length}）`);

// ---- 順位 ----
const GET = { nenshu: (d) => d.nenshu, ras: (d) => d.ras, bonus: (d) => d.bonus, taishoku: (d) => d.taishokuTeinen, shoninkyu: (d) => d.shoninkyu, shucho: (d) => d.shuchoPay };
const GROUP_OF_KUBUN = { 1: 'ken', 2: 'seirei', 3: 'shi', 4: 'ku', 5: 'chouson', 6: 'chouson' };
const groupByKey = new Map(GROUPS.map((g) => [g.key, g]));
const groupOf = (d) => groupByKey.get(GROUP_OF_KUBUN[d.kubun]);
const inGroup = (g, d) => g.kubun.includes(d.kubun);
// 団体コード → { 順位, 対象の数, 同じ値の数 }
function toMap(rows) {
  const cnt = new Map();
  for (const x of rows) cnt.set(x.v, (cnt.get(x.v) || 0) + 1);
  return new Map(rows.map((x) => [x.d.code, { rank: x.rank, n: rows.length, ties: cnt.get(x.v) }]));
}
const munisOf = (p) => list.filter((d) => d.pref === p.code && d.kubun !== 1);

const rankCache = new Map();
const rankRows = (mk, gk) => {
  const k = `${mk}|${gk}`;
  if (!rankCache.has(k)) rankCache.set(k, rankList(list.filter((d) => inGroup(groupByKey.get(gk), d)), GET[mk]));
  return rankCache.get(k);
};
const rank = {};
for (const m of METRICS) {
  const r = { all: toMap(rankRows(m.key, 'all')), pref: new Map(), group: new Map() };
  for (const p of PREFS) for (const [k, v] of toMap(rankList(munisOf(p), GET[m.key]))) r.pref.set(k, v);
  for (const g of GROUPS) {
    if (g.key === 'all') continue;
    const mp = toMap(rankRows(m.key, g.key));
    for (const [k, v] of mp) if (groupOf(D.get(k)).key === g.key) r.group.set(k, v);
  }
  rank[m.key] = r;
}
const lists = {
  all: rankRows('nenshu', 'all'),
  pref: new Map(PREFS.map((p) => [p.code, rankList(munisOf(p), GET.nenshu)])),
  group: new Map(GROUPS.map((g) => [g.key, rankRows('nenshu', g.key)])),
};

// ---- 中央値 ----
const otOf = (d) => d.jobs.gyosei.items?.find(([n]) => n === '時間外勤務手当')?.[1] ?? null;
function statOf(arr) {
  const pick = (f) => median(arr.map(f).filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b));
  return { n: arr.length, nenshu: pick(GET.nenshu), age: pick((d) => d.jobs.gyosei.age), ras: pick(GET.ras), kyuyo: pick((d) => d.jobs.gyosei.kyuyo), bonus: pick(GET.bonus), ot: pick(otOf) };
}
const ruijiGroups = new Map();
for (const d of list) if (d.ruiji) (ruijiGroups.get(d.ruiji) || ruijiGroups.set(d.ruiji, []).get(d.ruiji)).push(d);
const med = {
  all: statOf(list),
  pref: new Map(PREFS.map((p) => [p.code, statOf(munisOf(p))])),
  ruiji: new Map([...ruijiGroups].map(([k, v]) => [k, statOf(v)])),
  group: new Map(GROUPS.map((g) => [g.key, statOf(list.filter((d) => inGroup(g, d)))])),
};

// ---- 職種 ----
const jobRowsCache = new Map();
const jobRows = (key) => {
  if (!jobRowsCache.has(key)) jobRowsCache.set(key, rankList(list.filter((d) => d.jobs[key]?.ok && d.jobs[key].nenshu), (d) => d.jobs[key].nenshu));
  return jobRowsCache.get(key);
};
const jobStats = new Map(JOBS.map((j) => {
  const ok = list.filter((d) => d.jobs[j.key]?.ok && d.jobs[j.key].nenshu);
  const pick = (f) => median(ok.map(f).filter((v) => v != null).sort((a, b) => a - b));
  return [j.key, { n: ok.length, nenshu: pick((d) => d.jobs[j.key].nenshu), kyuyo: pick((d) => d.jobs[j.key].kyuyo), age: pick((d) => d.jobs[j.key].age), secret: list.filter((d) => d.jobs[j.key]?.secret).length }];
}));

// ---- 年齢別の年収の目安に使う「ボーナスは給料の何か月分か」（区分ごと、一般行政職の人数で重みづけ） ----
const AGE_KUBUN = { ken: [1], seirei: [2], shi: [3], ku: [4], chouson: [5, 6], all: [1, 2, 3, 4, 5, 6] };
const bonusRatio = {};
for (const [k, ks] of Object.entries(AGE_KUBUN)) {
  let b = 0;
  let q = 0;
  for (const d of list) {
    if (!ks.includes(d.kubun) || !(d.staff > 0) || !d.bonus) continue;
    b += d.bonus * d.staff;
    q += d.jobs.gyosei.kyuryo * d.staff;
  }
  bonusRatio[k] = b / q;
}

// ---- 推移の注記（基幹統計調査の年：令和5年・10年…） ----
const histYears = [...new Set([R, ...(manifest.past || [])])].sort((a, b) => a - b);
const kikan = histYears.find((r) => r % 5 === 0 && r !== R);
const muniKyuyo = (r) => totalsByYear[r]?.['全市区町村']?.kyuyo;
const histNote = kikan
  ? `令和${kikan}年は5年に1度の詳しい調査（基幹統計調査）の年で、全国の平均でも手当が前後の年より高く出ています${[kikan - 1, kikan, kikan + 1].every(muniKyuyo) ? `（全市区町村の平均給与月額：${[kikan - 1, kikan, kikan + 1].map((r) => `令和${r}年${comma(muniKyuyo(r))}円`).join('、')}）` : ''}。`
  : '';

const now = new Date();
const jst = new Date(now.getTime() + 9 * 3600e3);
const built = `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
const years = { hikaku: R, teiin: manifest.teiinReiwa, estat: manifest.estat?.reiwa };
setBuildInfo({ built, years });

// ---- 出力 ----
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const ASSETS_SRC = path.join(ROOT, 'src', 'assets');
fs.cpSync(ASSETS_SRC, path.join(DIST, 'assets'), { recursive: true });
if (fs.existsSync(path.join(ROOT, 'src', 'root'))) fs.cpSync(path.join(ROOT, 'src', 'root'), DIST, { recursive: true });
const hash = crypto.createHash('sha1');
for (const f of ['style.css', 'app.js']) hash.update(fs.readFileSync(path.join(ASSETS_SRC, f)));
setAssetVersion(hash.digest('hex').slice(0, 8));

let pages = 0;
let bytes = 0;
const urls = { hubs: [], dantai: [] };
function write(p, html, kind = 'hubs', sitemap = true) {
  const file = p === '' ? path.join(DIST, 'index.html') : p.endsWith('.html') ? path.join(DIST, p) : path.join(DIST, p, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  pages++;
  bytes += Buffer.byteLength(html);
  if (sitemap) urls[kind].push(abs(p));
}

const prefCode = (p) => list.find((d) => d.kubun === 1 && d.pref === p.code).code;
const ctx = {
  D, list, R, rank, med, lists, groupOf, totals, histYears, histNote, yr: { estat: years.estat, teiin: years.teiin }, perPage: PER_PAGE,
  rankRows, jobRows, jobStats, age, ageKyuryo, bonusRatio, prefCode,
};

write('', renderTop(ctx));
write('ranking/', renderRankingIndex(ctx));
for (const m of METRICS) {
  for (const g of GROUPS) {
    const n = Math.max(1, Math.ceil(rankRows(m.key, g.key).length / PER_PAGE));
    for (let i = 1; i <= n; i++) write(rankPath(m, g, i), renderRanking(ctx, m, g, i));
  }
}
write('ken/', renderPrefIndex(ctx));
for (const p of PREFS) write(prefPath(p), renderPref(ctx, p));
write('shokushu/', renderJobIndex(ctx));
for (const j of JOBS) {
  const n = Math.max(1, Math.ceil(jobRows(j.key).length / PER_PAGE));
  for (let i = 1; i <= n; i++) write(i === 1 ? jobPath(j) : `${jobPath(j)}${i}/`, renderJob(ctx, j, i));
}
write('nenrei/', renderAge(ctx));
write('about/', renderAbout(ctx));
write('search/', renderSearch(ctx), 'hubs', false);
write('404.html', render404(ctx), 'hubs', false);
log('hub pages', pages);

const targets = LIMIT ? list.slice(0, LIMIT) : list;
for (const d of targets) write(dantaiPath(d), renderDantai(d, ctx), 'dantai');
log('dantai pages', targets.length);

// 検索用の索引：[コード, 名前, 都道府県番号, 団体区分, 推計年収（千円）]
const index = list.map((d) => [d.code, d.name, d.pref, d.kubun, Math.round(d.nenshu / 1000)]);
fs.writeFileSync(path.join(DIST, 'assets', 'index.json'), JSON.stringify({ v: 1, built, prefs: PREFS.map((p) => p.name), d: index }));

// サイトマップ
const lastmod = now.toISOString().slice(0, 10);
const smFiles = [];
const writeSitemap = (name, l) => {
  fs.writeFileSync(path.join(DIST, name), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${l.map((u) => `<url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  smFiles.push(name);
};
writeSitemap('sitemap-hubs.xml', urls.hubs);
writeSitemap('sitemap-dantai.xml', urls.dantai);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${smFiles.map((f) => `<sitemap><loc>${abs(f)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${abs('sitemap.xml')}\n`);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

// 更新の記録（リポジトリに残す。GitHub の定期実行が止まらないようにする役目もある）
const summary = {
  built, base: BASE, pages, bytes, dantai: list.length, data: { reiwa: R, year: manifest.year, past: manifest.past, teiin: years.teiin, estat: years.estat, fetchedAt: manifest.fetchedAt },
  top: lists.all.slice(0, 3).map(({ d }) => [d.code, d.name, d.nenshu]), median: Math.round(med.all.nenshu),
};
if (process.env.GITHUB_ACTIONS === 'true' && !LIMIT) {
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data', 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}
log('done', summary);
