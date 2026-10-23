// 国の公開データ（Excel）を data/raw/ に取ってくる
// 使い方: node scripts/fetch.mjs
//   総務省「地方公共団体別給与等の比較」（最新年＋過去4年）、「地方公共団体定員管理調査」の団体別データ、
//   e-Stat「地方公務員給与実態調査」の別冊（団体別の職員数・初任給・議員報酬など）と第7表（年齢別）を取る。
// 取れないものがあれば終了コード1で止まる（scripts/fetch.sh がリリースの控えに切り替える）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');
const NEW = path.join(ROOT, 'data', 'raw.new');
const UA = 'Mozilla/5.0 (compatible; yakusho-nenshu/1.0; +https://micoficial.github.io/yakusho-nenshu/about/)';
const SOUMU = 'https://www.soumu.go.jp';
const C_GYOUSEI = `${SOUMU}/main_sosiki/jichi_gyousei/c-gyousei/`;
const ESTAT = 'https://www.e-stat.go.jp';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, { binary = false, tries = 3 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' }, signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (binary) return buf;
      const ct = res.headers.get('content-type') || '';
      const head = buf.subarray(0, 2000).toString('latin1');
      const sjis = /shift_jis|sjis/i.test(ct) || /charset=["']?shift_jis/i.test(head);
      return new TextDecoder(sjis ? 'shift_jis' : 'utf-8').decode(buf);
    } catch (e) {
      last = e;
      await sleep(3000 * (i + 1));
    }
  }
  throw new Error(`取得できませんでした: ${url}（${last?.message}）`);
}

const ERA = { R: 2018 };
const yearOf = (reiwa) => ERA.R + reiwa; // 令和n年 → 西暦
const rKey = (n) => `R${String(n).padStart(2, '0')}`;
const zen2han = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

// HTML を「文字」と「Excel へのリンク」の並びにする: [{ text } | { href, label }]
function tokens(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const out = [];
  let link = null;
  for (const m of body.matchAll(/<[^>]*>|[^<]+/g)) {
    const s = m[0];
    if (s[0] === '<') {
      const a = /^<a\b[^>]*href="([^"]+)"/i.exec(s);
      if (a) link = { href: a[1], label: '' };
      else if (/^<\/a>/i.test(s) && link) {
        if (/\.xlsx?$/i.test(link.href)) out.push({ href: new URL(link.href, SOUMU).href, label: link.label.replace(/\s+/g, '') });
        link = null;
      }
      continue;
    }
    if (link) link.label += s;
    else if (s.trim()) out.push({ text: s });
  }
  return out;
}

// 「地方公共団体別給与等の比較」のページから、項目番号 × 団体区分 → Excel の URL を読む
// 例: { '1': { ken: url, shitei: url, shi: url }, '6ref': {...}, ... }
function parseKyuyoPage(html) {
  const sections = {};
  let current = null;
  for (const t of tokens(html)) {
    if (t.text != null) {
      const s = zen2han(t.text).replace(/\s+/g, '');
      const sec = /^([1-8])[)）]/.exec(s);
      if (sec) current = sec[1];
      else if (/^＜参考＞賃金構造基本統計調査/.test(s)) current = '6ref';
      continue;
    }
    if (!current) continue;
    const kind = { 都道府県: 'ken', 政令指定都市: 'shitei', 指定都市: 'shitei', 市区町村: 'shi', 総括: 'sokatsu' }[t.label];
    if (kind) (sections[current] ||= {})[kind] ||= t.href;
  }
  const year = /令和\s*([0-9０-９]+)\s*年のラスパイレス指数/.exec(html);
  return { sections, reiwa: year ? +zen2han(year[1]) : null };
}

// 定員管理調査の団体別データ
function parseTeiinPage(html) {
  const links = tokens(html).filter((t) => t.href).map((t) => ({ url: t.href, text: t.label }));
  const pick = (re) => links.find((l) => re.test(l.text))?.url;
  const year = /【令和\s*([0-9０-９]+)\s*年】/.exec(html);
  return {
    reiwa: year ? +zen2han(year[1]) : null,
    ken: pick(/都道府県データ/),
    shitei: pick(/指定都市データ/),
    shi: pick(/第1表.*部門別職員数一覧|第１表.*部門別職員数一覧/),
  };
}

// e-Stat：指定した年の「地方公務員給与実態調査」のファイル一覧から、表題 → statInfId を集める
async function estatFiles(reiwa) {
  const nen = `令和${String(reiwa).replace(/\d/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0))}年`; // 全角数字
  const nenHan = `令和${reiwa}年`;
  for (const toukei of ['00200212', '00200211']) {
    const top = await get(`${ESTAT}/stat-search/files?page=1&toukei=${toukei}&tstat=&cycle=0&result_page=1`);
    // 年ごとの tstat を探す（リンク文字に「令和７年地方公務員給与実態調査」などが入る）
    const cands = [...top.matchAll(/href="([^"]*tstat=(\d{12})[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map((m) => ({ tstat: m[2], text: m[3].replace(/<[^>]*>/g, '').replace(/\s+/g, '') }))
      .filter((c) => (c.text.includes(nen) || c.text.includes(nenHan)) && c.text.includes('地方公務員給与'));
    if (!cands.length) continue;
    const tstat = cands[0].tstat;
    const page = await get(`${ESTAT}/stat-search/files?page=1&toukei=${toukei}&tstat=${tstat}&cycle=0&result_page=1`);
    const classes = [...new Set([...page.matchAll(/tclass1=(\d{12})/g)].map((m) => m[1]))];
    const files = [];
    for (const c of classes.length ? classes : [null]) {
      for (let p = 1; p <= 5; p++) {
        const url = `${ESTAT}/stat-search/files?page=${p}&cycle=0&toukei=${toukei}&tstat=${tstat}&result_page=1${c ? `&tclass1=${c}` : ''}&layout=datalist&tclass2val=0`;
        const h = await get(url);
        const items = h.split(/<li class="stat-dataset_list-(?:detail-)?item"?/).slice(1);
        let added = 0;
        for (const it of items) {
          const id = /statInfId=(\d+)&(?:amp;)?fileKind=0/.exec(it)?.[1];
          if (!id || files.some((f) => f.id === id)) continue;
          const words = it.replace(/^[^<]*>/, '').replace(/<[^>]*>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
          files.push({ id, title: words.slice(0, 4).join(' ') });
          added++;
        }
        if (!added || !/page=\d+[^"]*"[^>]*>\s*次/.test(h)) break;
      }
    }
    return { toukei, tstat, files };
  }
  throw new Error(`e-Stat に${nenHan}の地方公務員給与実態調査が見つかりません`);
}

async function main() {
  fs.rmSync(NEW, { recursive: true, force: true });
  fs.mkdirSync(NEW, { recursive: true });
  const manifest = { fetchedAt: new Date().toISOString(), files: {} };
  const save = async (rel, url) => {
    const buf = await get(url, { binary: true });
    if (buf.subarray(0, 2).toString('latin1') !== 'PK') throw new Error(`Excel（xlsx）ではありません: ${url}`);
    const file = path.join(NEW, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    manifest.files[rel] = { url, bytes: buf.length };
    await sleep(400);
  };

  // 1) 地方公共団体別給与等の比較（最新）
  const latest = parseKyuyoPage(await get(`${C_GYOUSEI}teiin-kyuuyo02.html`));
  if (!latest.reiwa) throw new Error('給与等の比較のページから年が読めません');
  manifest.reiwa = latest.reiwa;
  manifest.year = yearOf(latest.reiwa);
  const need = { 1: ['ken', 'shitei', 'shi'], 3: ['ken', 'shitei', 'shi'], 4: ['ken', 'shitei', 'shi'], 5: ['ken', 'shitei', 'shi'], 6: ['ken', 'shitei', 'shi'], '6ref': ['ken', 'shitei', 'shi'], 7: ['ken', 'shitei', 'shi'] };
  for (const [sec, kinds] of Object.entries(need)) {
    for (const k of kinds) {
      const url = latest.sections[sec]?.[k];
      if (!url) throw new Error(`給与等の比較：${sec}) の ${k} が見つかりません`);
      await save(`kyuyo/${rKey(latest.reiwa)}/${sec}_${k}.xlsx`, url);
    }
  }
  console.log(`給与等の比較 令和${latest.reiwa}年：取得`);

  // 2) 過去4年（推移用。①と④だけ）
  manifest.past = [];
  for (let r = latest.reiwa - 1; r >= latest.reiwa - 4 && r >= 1; r--) {
    try {
      const p = parseKyuyoPage(await get(`${C_GYOUSEI}teiin-kyuuyo02_${rKey(r)}.html`));
      for (const sec of ['1', '4']) for (const k of ['ken', 'shitei', 'shi']) {
        const url = p.sections[sec]?.[k];
        if (!url) throw new Error(`${sec}) ${k} なし`);
        await save(`kyuyo/${rKey(r)}/${sec}_${k}.xlsx`, url);
      }
      manifest.past.push(r);
      console.log(`給与等の比較 令和${r}年：取得`);
    } catch (e) {
      console.warn(`令和${r}年の比較は取れませんでした（推移から外します）: ${e.message}`);
    }
  }

  // 3) 定員管理調査（団体別の部門別職員数）
  const teiin = parseTeiinPage(await get(`${C_GYOUSEI}index_00005.html`));
  for (const k of ['ken', 'shitei', 'shi']) {
    if (!teiin[k]) throw new Error(`定員管理調査：${k} のデータが見つかりません`);
    await save(`teiin/${k}.xlsx`, teiin[k]);
  }
  manifest.teiinReiwa = teiin.reiwa;
  console.log(`定員管理調査 令和${teiin.reiwa}年：取得`);

  // 4) e-Stat（給与等の比較と同じ年。e-Stat の詳しい表は総務省の公表から半年ほど遅れるので、まだなければ前の年）
  const want = {
    'estat/bessatsu_ken.xlsx': /別冊.*都道府県の職員数及び平均給料/,
    'estat/bessatsu_shitei.xlsx': /別冊.*指定都市の職員数及び平均給料/,
    'estat/bessatsu_shi.xlsx': /別冊.*市区町村別職員数及び平均給料/,
    'estat/t7_kyuyo.xlsx': /第７表.*職種別，年齢別，学歴別職員数及び平均給与月額/,
    'estat/t7_kyuryo.xlsx': /第７表.*職種別，年齢別，学歴別職員数及び平均給料月額/,
  };
  let es;
  for (const r of [latest.reiwa, latest.reiwa - 1]) {
    try {
      const x = await estatFiles(r);
      const miss = Object.values(want).filter((re) => !x.files.some((f) => re.test(f.title)));
      if (miss.length) throw new Error(`e-Stat 令和${r}年：「${miss[0].source}」など${miss.length}件が見つかりません（${x.files.length}件中）`);
      es = { ...x, reiwa: r };
      break;
    } catch (e) { console.warn(e.message); }
  }
  if (!es) throw new Error('e-Stat のデータが見つかりません');
  for (const [rel, re] of Object.entries(want)) {
    const f = es.files.find((x) => re.test(x.title));
    await save(rel, `${ESTAT}/stat-search/file-download?statInfId=${f.id}&fileKind=0`);
  }
  manifest.estat = { reiwa: es.reiwa, toukei: es.toukei, tstat: es.tstat };
  console.log(`e-Stat 令和${es.reiwa}年：取得`);

  fs.writeFileSync(path.join(NEW, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // 取り終えてから差し替える（途中で失敗しても前のデータが残る）
  fs.rmSync(RAW, { recursive: true, force: true });
  fs.renameSync(NEW, RAW);
  const n = Object.keys(manifest.files).length;
  console.log(`完了：${n}ファイル（令和${latest.reiwa}年＝${manifest.year}年4月1日現在、過去 ${manifest.past.map((r) => `R${r}`).join(',')}）`);
}

main().catch((e) => {
  console.error(e.message);
  fs.rmSync(NEW, { recursive: true, force: true });
  process.exit(1);
});
