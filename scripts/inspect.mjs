// 取ってきた Excel の見出し（列の名前）を一覧にする。読み込みが壊れたときの確認用
// 使い方: node scripts/inspect.mjs [ファイル名の一部]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTables } from './lib/table.mjs';

const RAW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw');
const filter = process.argv[2] || '';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(RAW).filter((x) => x.endsWith('.xlsx') && x.includes(filter)).sort()) {
  console.log(`\n######## ${path.relative(RAW, f)}`);
  for (const { sheet, table } of readTables(f)) {
    if (!table) { console.log(`  [${sheet.name}] 団体コードの列なし`); continue; }
    console.log(`  [${sheet.name}] 行${table.rows.size} コード列${table.codeCol}`);
    console.log(`    ${table.labels.map((l, c) => (l ? `${c}:${l}` : '')).filter(Boolean).join('  ')}`);
  }
}
