// 読み込みの確認：件数・欠け・代表的な団体の値を表示する
// 使い方: node scripts/check-load.mjs [団体コード...]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll } from './lib/load.mjs';

const RAW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw');
const t0 = Date.now();
const { D, totals, manifest, age } = loadAll(RAW);
console.log(`読み込み ${D.size}団体 ${((Date.now() - t0) / 1000).toFixed(1)}秒 令和${manifest.reiwa}年 過去${manifest.past}`);
const by = {};
for (const d of D.values()) by[d.kubun] = (by[d.kubun] || 0) + 1;
console.log('団体区分', by);
const miss = (f) => [...D.values()].filter((d) => f(d) == null).length;
console.log('欠け: 年収', miss((d) => d.nenshu), 'ラス', miss((d) => d.ras), '初任給', miss((d) => d.shoninkyu), '退職金', miss((d) => d.taishokuTeinen), '首長', miss((d) => d.shuchoPay), '職員数', miss((d) => d.staff), '定員', miss((d) => d.teiin?.total), '推移R3', miss((d) => d.hist[3]?.nenshu));
const ns = [...D.values()].map((d) => d.nenshu).filter(Boolean).sort((a, b) => a - b);
console.log('年収 最小', ns[0], '中央', ns[ns.length >> 1], '最大', ns[ns.length - 1]);
console.log('集計行', Object.keys(totals));
console.log('全地方公共団体', totals['全地方公共団体']);
console.log('年齢別の区分', Object.keys(age), age['市'].gyosei.rows.slice(0, 3));
for (const code of process.argv.slice(2).length ? process.argv.slice(2) : ['012025', '011002', '131016', '010006', '403091']) {
  const d = D.get(code);
  if (!d) { console.log(code, 'なし'); continue; }
  console.log(`\n=== ${code} ${d.name} kubun=${d.kubun} pref=${d.pref} ruiji=${d.ruiji} ras=${d.ras} 年収=${d.nenshu}`);
  console.log('gyosei', JSON.stringify({ ...d.jobs.gyosei, items: undefined }));
  console.log('items', JSON.stringify(d.jobs.gyosei.items));
  console.log('jobs', Object.entries(d.jobs).map(([k, j]) => `${k}:${j.ok ? Math.round(j.nenshu / 1e4) : (j.secret ? '*' : '-')}`).join(' '));
  console.log('seisou', JSON.stringify(d.jobs.seisou));
  console.log('taishoku', JSON.stringify(d.taishoku), 'shucho', JSON.stringify(d.shucho));
  console.log('es', JSON.stringify(d.es));
  console.log('teiin', JSON.stringify(d.teiin));
  console.log('hist', JSON.stringify(d.hist));
}
