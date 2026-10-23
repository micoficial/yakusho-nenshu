// data/raw/ の Excel を読み、団体コードで1つにまとめる
// 列は見出しの文字で探す。見つからない・件数が合わないときは止める（黙って変な値を出さない）
import fs from 'node:fs';
import path from 'node:path';
import { readXlsx } from './xlsx.mjs';
import { sheetTable, col, val } from './table.mjs';


const rk = (r) => `R${String(r).padStart(2, '0')}`;
const clean = (s) => String(s ?? '').replace(/[\s　]+/g, '');
const KINDS = ['ken', 'shitei', 'shi'];
const EXPECT = { ken: 47, shitei: 20, shi: 1721 };

// spec: { フィールド名: 正規表現 | [正規表現, { group, nth, optional }] } → { フィールド名: 列番号 }
function resolve(t, spec, where) {
  const out = {};
  for (const [k, s] of Object.entries(spec)) {
    const [re, opt = {}] = Array.isArray(s) ? s : [s];
    try { out[k] = col(t, re, opt); } catch (e) {
      if (opt.optional) continue;
      throw new Error(`${where}：${e.message}`);
    }
  }
  return out;
}
// 列番号の組 → 値の組。「*」（職員1〜2人で非公表）があれば secret を立てる
function readRow(row, cols) {
  const o = {};
  for (const [k, c] of Object.entries(cols)) {
    const x = val(row[c]);
    o[k] = x.v;
    if (x.why === 'secret') o.secret = true;
  }
  return o;
}
// 「月額支給手当|扶養手当」のような列をまとめて取る
function multi(t, re) {
  const out = [];
  t.labels.forEach((l, c) => { const m = re.exec(l); if (m) out.push([m[1], c]); });
  return out;
}
const sheetsOf = (file, opts) => readXlsx(file).map((s) => ({ name: s.name, t: sheetTable(s, opts) }));
function pickSheet(sheets, re, where, optional = false) {
  const s = sheets.find((x) => re.test(x.name) && !/データ一覧/.test(x.name));
  if (!s?.t) {
    if (optional) return null;
    throw new Error(`${where}：シート ${re} が見つかりません（${sheets.map((x) => x.name).join(' / ')}）`);
  }
  return s.t;
}
function expectCount(t, kind, where) {
  if (EXPECT[kind] && t.rows.size !== EXPECT[kind]) throw new Error(`${where}：団体の数が ${t.rows.size}（${EXPECT[kind]} のはず）`);
}

// ① ラスパイレス指数・平均給与月額（一般行政職）と、職員区分ごとの平均（参考シート）
function load1(file, kind, where) {
  const sheets = sheetsOf(file);
  const main = sheets[0].t;
  if (!main) throw new Error(`${where}：表が読めません`);
  expectCount(main, kind, where);
  const nameRe = { ken: /^都道府県名/, shitei: /^指定都市名/, shi: /^団体名/ }[kind];
  const c = resolve(main, {
    kubun: /団体区分番号/,
    name: nameRe,
    ...(kind === 'shi' ? { prefName: /^都道府県$/, ruiji: /類似団体類型区分/ } : {}),
    ras: /^ラスパイレス指数$/,
    chiiki: /^地域手当\|団体支給率/,
    chiikiKuni: /^地域手当\|国基準/,
    age: /^平均年齢$/,
    kyuryo: /^平均給料月額A$/,
    teate: /^諸手当月額B$/,
    kyuyo: /^平均給与月額A\+B$/,
    kyuyoKuni: /^平均給与月額\(国ベース\)$/,
    rasChiiki: [/地域手当補正後ラスパイレス指数/, { optional: true }],
  }, where);
  const rows = new Map();
  for (const [code, row] of main.rows) {
    const o = readRow(row, c);
    o.name = clean(row[c.name]);
    if (c.prefName != null) o.prefName = clean(row[c.prefName]);
    if (c.ruiji != null) o.ruiji = clean(row[c.ruiji]);
    rows.set(code, o);
  }
  const totals = {};
  for (const [k, row] of main.totals) totals[k] = readRow(row, { ras: c.ras, age: c.age, kyuryo: c.kyuryo, teate: c.teate, kyuyo: c.kyuyo, kyuyoKuni: c.kyuyoKuni });
  // 参考：職員区分ごと
  const ref = sheets[1]?.t;
  const jobs = new Map();
  if (ref) {
    const groups = { all: /^全職種\|/, gyosei: /^一般職員のうち一般行政職\|/, kyoiku: /^教育公務員\|/, keisatsu: /^警察職\|/ };
    const cols = {};
    for (const [g, gre] of Object.entries(groups)) {
      const r = resolve(ref, {
        age: [/\|平均年齢$/, { group: gre, optional: true }],
        kyuryo: [/\|平均給料月額A$/, { group: gre, optional: true }],
        teate: [/\|諸手当月額B$/, { group: gre, optional: true }],
        kyuyo: [/\|平均給与月額A\+B$/, { group: gre, optional: true }],
        kyuyoKuni: [/\|平均給与月額\(国ベース\)$/, { group: gre, optional: true }],
      }, `${where} 参考`);
      if (r.kyuyo != null) cols[g] = r;
    }
    if (!cols.all || !cols.gyosei) throw new Error(`${where}：参考シートに全職種・一般行政職の列がありません`);
    for (const [code, row] of ref.rows) {
      const j = {};
      for (const [g, cc] of Object.entries(cols)) j[g] = readRow(row, cc);
      jobs.set(code, j);
    }
    for (const [k, row] of ref.totals) {
      totals[`${k}|職種`] = Object.fromEntries(Object.entries(cols).map(([g, cc]) => [g, readRow(row, cc)]));
    }
  }
  return { rows, jobs, totals };
}

// ③ 諸手当の内訳
function load3(file, kind, where) {
  const sheets = sheetsOf(file);
  const out = new Map();
  const map = { all: /^①全職種/, gyosei: /一般行政職/, kyoiku: /教育公務員/, keisatsu: /警察職/ };
  for (const [job, re] of Object.entries(map)) {
    const t = pickSheet(sheets, re, where, job === 'keisatsu' || job === 'kyoiku');
    if (!t) continue;
    expectCount(t, kind, `${where} ${t.name}`);
    const c = resolve(t, { age: /^平均年齢$/, total: /^諸手当計$/, kanreichi: [/^年額支給\|寒冷地手当$/, { optional: true }] }, `${where} ${t.name}`);
    const items = multi(t, /^月額支給手当\|(.+)$/);
    if (items.length < 10) throw new Error(`${where} ${t.name}：手当の列が少なすぎます（${items.length}）`);
    for (const [code, row] of t.rows) {
      const o = readRow(row, c);
      o.items = items.map(([n, cc]) => [n, val(row[cc]).v]);
      (out.get(code) || out.set(code, {}).get(code))[job] = o;
    }
  }
  return out;
}

// ④ 期末・勤勉手当
function load4(file, kind, where) {
  const sheets = sheetsOf(file);
  const out = new Map();
  const map = { all: /^①全職種/, gyosei: /一般行政職/, kyoiku: /教育公務員/, keisatsu: /警察職/ };
  for (const [job, re] of Object.entries(map)) {
    const t = pickSheet(sheets, re, where, job !== 'gyosei' && job !== 'all');
    if (!t) continue;
    expectCount(t, kind, `${where} ${t.name}`);
    const c = resolve(t, { age: /^平均年齢$/, months: /^支給月数$/, kimatsu: /\|期末手当$/, kinben: /\|勤勉手当$/, total: /合計$/ }, `${where} ${t.name}`);
    for (const [code, row] of t.rows) (out.get(code) || out.set(code, {}).get(code))[job] = readRow(row, c);
  }
  return out;
}

// ⑤ 退職手当（千円）
function load5(file, kind, where) {
  const t = pickSheet(sheetsOf(file), /./, where);
  expectCount(t, kind, where);
  const groups = { all: /^全職種\|/, gyosei: /^一般職員のうち一般行政職\|/, kyoiku: /^教育公務員\|/, keisatsu: /^警察職\|/ };
  const cols = {};
  for (const [g, gre] of Object.entries(groups)) {
    const r = resolve(t, { zen: [/全退職者の平均支給額$/, { group: gre, optional: true }], teinen: [/定年退職者等の平均支給額$/, { group: gre, optional: true }] }, where);
    if (r.zen != null) cols[g] = r;
  }
  if (!cols.gyosei) throw new Error(`${where}：一般行政職の退職手当の列がありません`);
  const out = new Map();
  for (const [code, row] of t.rows) out.set(code, Object.fromEntries(Object.entries(cols).map(([g, cc]) => [g, readRow(row, cc)])));
  return out;
}

// ⑥ 技能労務職員等
const GINOU = { ginou: /全技能労務職員/, seisou: /清掃職員/, kyushoku: /学校給食員/, shuei: /守衛/, youmu: /用務員/, unten: /自動車運転手/, bus: /バス事業運転手/ };
function load6(file, kind, where) {
  const sheets = sheetsOf(file);
  const out = new Map();
  for (const [job, re] of Object.entries(GINOU)) {
    const t = pickSheet(sheets, re, where);
    expectCount(t, kind, `${where} ${t.name}`);
    const c = resolve(t, {
      age: /^平均年齢$/,
      kyuryo: /^平均給料月額\|A$/,
      teate: /^諸手当月額\|B$/,
      kyuyo: /^平均給与月額\|A\+B$/,
      kyuyoKuni: /^平均給与月額\(国ベース\)$/,
      kanreichi: [/^年額支給\|寒冷地手当$/, { optional: true }],
      months: /^支給月数$/,
      kimatsu: /期末・勤勉手当.*\|期末手当$/,
      kinben: /期末・勤勉手当.*\|勤勉手当$/,
      total: /期末・勤勉手当.*\|合計$/,
      taiZen: [/退職手当.*\|全退職者$/, { optional: true }],
      taiTeinen: [/退職手当.*\|定年退職者等$/, { optional: true }],
    }, `${where} ${t.name}`);
    const items = multi(t, /^諸手当月額\(B\)の内訳\|(.+)$/);
    for (const [code, row] of t.rows) {
      const o = readRow(row, c);
      o.items = items.map(([n, cc]) => [n, val(row[cc]).v]);
      (out.get(code) || out.set(code, {}).get(code))[job] = o;
    }
  }
  return out;
}

// ⑥参考 民間の似た仕事との比較（千円）。都道府県の表は団体コードがないので名前で引く
const REF = { seisou: /清掃/, kyushoku: /給食/, youmu: /用務員/, unten: /自動車運転手/, shuei: /守衛/, bus: /バス/ };
function load6ref(file, kind, where, nameToCode) {
  const keyOf = kind === 'ken' ? (r) => { for (let c = 0; c < 3; c++) { const k = nameToCode.get(clean(r[c])); if (k) return k; } return null; } : undefined;
  const sheets = sheetsOf(file, { keyOf });
  const out = new Map();
  for (const [job, re] of Object.entries(REF)) {
    const t = pickSheet(sheets, re, where);
    expectCount(t, kind, `${where} ${t.name}`);
    const c = resolve(t, {
      age: [/\|平均年齢$/, { nth: 0 }],
      kyuyo: /\|A$/,
      noOT: /\|B$/,
      staff10: /職員数\(十人\)$/,
      mAge: [/\|平均年齢$/, { nth: 1 }],
      mKyuyo: /\|C$/,
      mNoOT: /\|D$/,
      mWorkers10: /労働者数\(十人\)$/,
    }, `${where} ${t.name}`);
    const mName = t.labels[c.mKyuyo].split('|').find((p) => !/^＜|平均給与月額|^C$/.test(p));
    // 民間の値は職種によって都道府県ごと（給食・用務員など）か全国平均（清掃）。値がすべて同じなら全国平均とみなす
    const distinct = new Set([...t.rows.values()].map((row) => String(val(row[c.mKyuyo]).v)));
    const scope = distinct.size === 1 ? 'zenkoku' : 'ken';
    for (const [code, row] of t.rows) {
      const o = readRow(row, c);
      const st = String(row[c.staff10] ?? '');
      if (/5人未満|５人未満/.test(st)) o.staffUnder5 = true;
      o.mName = mName;
      o.scope = scope;
      (out.get(code) || out.set(code, {}).get(code))[job] = o;
    }
  }
  return out;
}

// ⑦ 知事・市区町村長の給料月額
function load7(file, kind, where) {
  const t = pickSheet(sheetsOf(file), /./, where);
  expectCount(t, kind, where);
  const c = resolve(t, { cho: /^平均給料月額\|(知事|市長|市区町村長)$/, fuku: /^平均給料月額\|副/ }, where);
  const out = new Map();
  for (const [code, row] of t.rows) out.set(code, readRow(row, c));
  return out;
}

// e-Stat 別冊：職員数・初任給・採用と退職・議員報酬など（百円の列は円に直す）
function loadBessatsu(file, kind, where) {
  const t = pickSheet(sheetsOf(file), /./, where);
  expectCount(t, kind, where);
  const c = resolve(t, {
    allStaff: /^全職種\|職員数/,
    allAge: /^全職種\|平均年齢/,
    staff: /^一般行政職\|職員数/,
    age: /^一般行政職\|平均年齢/,
    sDai: /^初任給基準額.*\|大学卒/,
    sTan: /^初任給基準額.*\|短大卒/,
    sKou: /^初任給基準額.*\|高校卒/,
    saiyo: /^採用者数/,
    taishokusha: /^退職者数/,
    cho: /^知事・副知事の平均給料月額\|(知事|市長|市区町村長)/,
    fuku: /^知事・副知事の平均給料月額\|副/,
    gicho: /^議会議員の平均報酬月額\|議長/,
    fukugicho: /^議会議員の平均報酬月額\|副議長/,
    giin: /^議会議員の平均報酬月額\|議員/,
    kyoikucho: /^教育長の給料月額/,
    choDate: [/適用年月日\|(知事|市長|市区町村長)/, { optional: true }],
    giinDate: [/適用年月日\|議員/, { optional: true }],
  }, where);
  const HYAKU = ['cho', 'fuku', 'gicho', 'fukugicho', 'giin', 'kyoikucho'];
  const out = new Map();
  for (const [code, row] of t.rows) {
    const o = readRow(row, c);
    for (const k of HYAKU) if (o[k] != null) o[k] *= 100;
    o.choDate = c.choDate != null ? clean(row[c.choDate]) : null;
    o.giinDate = c.giinDate != null ? clean(row[c.giinDate]) : null;
    out.set(code, o);
  }
  return out;
}

// 定員管理調査：部門別職員数。都道府県・指定都市の表は団体コードがないので名前で引く
function loadTeiin(file, kind, where, nameToCode) {
  const keyOf = kind === 'shi' ? undefined : (r) => nameToCode.get(clean(r[0])) || null;
  const t = pickSheet(sheetsOf(file, { keyOf, minRows: kind === 'shitei' ? 20 : 40 }), /部門別職員(一覧|数一覧)|掲載データ/, where);
  expectCount(t, kind, where);
  const c = resolve(t, {
    ippanKanri: /^一般行政\|一般管理$/,
    fukushi: /^一般行政\|福祉関係$/,
    ippanGyosei: /^一般行政\|一般行政計$/,
    kyoiku: /^教育$/,
    keisatsu: /^警察$/,
    shobo: /^消防$/,
    futsu: /^普通会計計$/,
    kouei: /^公営企業等会計$/,
    total: /^合計$/,
  }, where);
  const out = new Map();
  for (const [code, row] of t.rows) out.set(code, readRow(row, c));
  return out;
}

// e-Stat 第7表：団体区分別・年齢別の平均（全国）
function loadAge(file, where) {
  const out = {};
  for (const s of readXlsx(file)) {
    const m = /^\((\d)\)(.+)-(一般行政職|技能労務職)$/.exec(s.name.replace(/[（）]/g, (ch) => (ch === '（' ? '(' : ')')));
    if (!m) continue;
    const [, , kubun, job] = m;
    const rows = [];
    let avgAge = null;
    for (const r of s.rows) {
      if (!r || typeof r[1] !== 'number') continue;
      const label = clean(r[0]);
      if (label === '平均年齢') { avgAge = { all: val(r[3]).v, dai: val(r[5]).v, tan: val(r[7]).v, kou: val(r[9]).v }; continue; }
      rows.push({ label, n: val(r[2]).v, v: val(r[3]).v, dai: { n: val(r[4]).v, v: val(r[5]).v }, tan: { n: val(r[6]).v, v: val(r[7]).v }, kou: { n: val(r[8]).v, v: val(r[9]).v } });
    }
    if (rows.length < 10) throw new Error(`${where} ${s.name}：年齢の行が足りません`);
    (out[kubun] ||= {})[job === '一般行政職' ? 'gyosei' : 'ginou'] = { rows, avgAge };
  }
  for (const k of ['全地方公共団体', '都道府県', '指定都市', '市', '町村', '特別区']) if (!out[k]?.gyosei) throw new Error(`${where}：「${k}」の表がありません`);
  return out;
}

export function loadAll(RAW) {
  const manifest = JSON.parse(fs.readFileSync(path.join(RAW, 'manifest.json'), 'utf8'));
  const R = manifest.reiwa;
  const K = (r, f) => path.join(RAW, 'kyuyo', rk(r), f);
  const D = new Map();
  const totals = {};

  // ① 最新年
  for (const kind of KINDS) {
    const { rows, jobs, totals: t } = load1(K(R, `1_${kind}.xlsx`), kind, `①${kind}`);
    Object.assign(totals, t);
    for (const [code, o] of rows) {
      const pref = +code.slice(0, 2);
      D.set(code, {
        code, kind, kubun: o.kubun, pref, name: o.name, ruiji: o.ruiji || null,
        ras: o.ras, rasChiiki: o.rasChiiki ?? null, chiiki: o.chiiki, chiikiKuni: o.chiikiKuni,
        jobs: { gyosei: { age: o.age, kyuryo: o.kyuryo, teate: o.teate, kyuyo: o.kyuyo, kyuyoKuni: o.kyuyoKuni } },
        hist: {},
      });
      const j = jobs.get(code);
      if (j) for (const [g, x] of Object.entries(j)) if (g !== 'gyosei') D.get(code).jobs[g] = x;
    }
  }
  const nameToCode = new Map();
  for (const d of D.values()) if (d.kind !== 'shi') nameToCode.set(d.name, d.code);
  const need = (code, where) => {
    const d = D.get(code);
    if (!d) throw new Error(`${where}：①にない団体コード ${code}`);
    return d;
  };
  const merge = (map, fn, where) => { for (const [code, x] of map) fn(need(code, where), x); };

  for (const kind of KINDS) {
    merge(load3(K(R, `3_${kind}.xlsx`), kind, `③${kind}`), (d, x) => {
      for (const [g, o] of Object.entries(x)) Object.assign(d.jobs[g] ||= {}, { teateTotal: o.total, items: o.items, kanreichi: o.kanreichi, secret: d.jobs[g]?.secret || o.secret });
    }, `③${kind}`);
    merge(load4(K(R, `4_${kind}.xlsx`), kind, `④${kind}`), (d, x) => {
      for (const [g, o] of Object.entries(x)) (d.jobs[g] ||= {}).bonus = o;
    }, `④${kind}`);
    merge(load5(K(R, `5_${kind}.xlsx`), kind, `⑤${kind}`), (d, x) => { d.taishoku = x; }, `⑤${kind}`);
    merge(load6(K(R, `6_${kind}.xlsx`), kind, `⑥${kind}`), (d, x) => {
      for (const [g, o] of Object.entries(x)) {
        d.jobs[g] = {
          age: o.age, kyuryo: o.kyuryo, teate: o.teate, kyuyo: o.kyuyo, kyuyoKuni: o.kyuyoKuni, items: o.items, kanreichi: o.kanreichi,
          bonus: { months: o.months, kimatsu: o.kimatsu, kinben: o.kinben, total: o.total }, secret: o.secret,
        };
        if (g === 'ginou' && (o.taiZen != null || o.taiTeinen != null)) (d.taishoku ||= {}).ginou = { zen: o.taiZen, teinen: o.taiTeinen };
      }
    }, `⑥${kind}`);
    merge(load6ref(K(R, `6ref_${kind}.xlsx`), kind, `⑥参考${kind}`, nameToCode), (d, x) => {
      for (const [g, o] of Object.entries(x)) if (d.jobs[g]) d.jobs[g].minkan = o;
    }, `⑥参考${kind}`);
    merge(load7(K(R, `7_${kind}.xlsx`), kind, `⑦${kind}`), (d, x) => { d.shucho = x; }, `⑦${kind}`);
    merge(loadBessatsu(path.join(RAW, 'estat', `bessatsu_${kind}.xlsx`), kind, `別冊${kind}`), (d, x) => { d.es = x; }, `別冊${kind}`);
    merge(loadTeiin(path.join(RAW, 'teiin', `${kind}.xlsx`), kind, `定員${kind}`, nameToCode), (d, x) => { d.teiin = x; }, `定員${kind}`);
  }

  // 推移（過去年は①と④の一般行政職だけ）
  const totalsByYear = { [R]: totals };
  for (const r of [R, ...(manifest.past || [])]) {
    for (const kind of KINDS) {
      const { rows, totals: tt } = r === R ? { rows: null, totals: null } : load1(K(r, `1_${kind}.xlsx`), kind, `R${r}①${kind}`);
      if (tt) Object.assign(totalsByYear[r] ||= {}, tt);
      const b = r === R ? null : load4(K(r, `4_${kind}.xlsx`), kind, `R${r}④${kind}`);
      for (const d of D.values()) {
        if (d.kind !== kind) continue;
        let x;
        if (r === R) x = { ras: d.ras, age: d.jobs.gyosei.age, kyuyo: d.jobs.gyosei.kyuyo, bonus: d.jobs.gyosei.bonus?.total ?? null };
        else {
          const o = rows.get(d.code);
          if (!o) continue; // 合併などでその年にない団体
          x = { ras: o.ras, age: o.age, kyuyo: o.kyuyo, bonus: b.get(d.code)?.gyosei?.total ?? null };
        }
        x.nenshu = x.kyuyo && x.bonus ? x.kyuyo * 12 + x.bonus : null;
        d.hist[r] = x;
      }
    }
  }

  const age = loadAge(path.join(RAW, 'estat', 't7_kyuyo.xlsx'), '第7表(給与)');
  const ageKyuryo = loadAge(path.join(RAW, 'estat', 't7_kyuryo.xlsx'), '第7表(給料)');

  // 推計年収など、よく使う値
  for (const d of D.values()) {
    for (const j of Object.values(d.jobs)) {
      const ok = j && !j.secret && j.age > 0 && j.kyuyo > 0;
      j.ok = !!ok;
      j.nenshu = ok && j.bonus?.total > 0 ? j.kyuyo * 12 + j.bonus.total : null;
    }
    const g = d.jobs.gyosei;
    d.nenshu = g.nenshu;
    d.bonus = g.bonus?.total > 0 ? g.bonus.total : null;
    d.taishokuTeinen = d.taishoku?.gyosei?.teinen > 0 ? d.taishoku.gyosei.teinen * 1000 : null;
    d.shoninkyu = d.es?.sDai > 0 ? d.es.sDai : null;
    d.shuchoPay = d.shucho?.cho > 0 ? d.shucho.cho : null;
    d.staff = d.es?.staff ?? null;
  }
  return { D, totals, totalsByYear, manifest, age, ageKyuryo };
}
