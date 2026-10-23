import { SITE_NAME, OPERATOR, SOURCES, PREF_BY_CODE, officeName } from './meta.mjs';
import { esc } from './format.mjs';

export const ORIGIN = process.env.SITE_ORIGIN || 'https://micoficial.github.io';
export const BASE = process.env.SITE_BASE || '/yakusho-nenshu/';
export const abs = (p) => `${ORIGIN}${BASE}${p}`;
export const href = (p) => `${BASE}${p}`;

export const prefOf = (code) => PREF_BY_CODE.get(code);
export const dantaiPath = (d) => `d/${d.code}/`;
export const prefPath = (p) => `ken/${p.slug}/`;
export const jobPath = (j) => `shokushu/${j.slug}/`;
export function rankPath(m, g, page = 1) {
  const base = `ranking/${m.slug}/${g && g.slug ? `${g.slug}/` : ''}`;
  return page > 1 ? `${base}${page}/` : base;
}

// 東京都だけ「市区町村」、ほかは「市町村」
export const prefUnit = (p) => (p.code === 13 ? '市区町村' : '市町村');

// 「函館市（北海道）」。都道府県はそのまま
export const placeLabel = (d) => (d.kubun === 1 ? d.name : `${d.name}（${prefOf(d.pref).name}）`);
export const officeLabel = (d) => (d.kubun === 1 ? officeName(d) : `${officeName(d)}（${prefOf(d.pref).name}）`);

let ASSET_V = '1';
export const setAssetVersion = (v) => { ASSET_V = v; };
let BUILD = { built: '', years: {} };
export const setBuildInfo = (b) => { BUILD = b; };
export const buildInfo = () => BUILD;

export function breadcrumbs(items) {
  // items: [[name, path|null], ...]
  const li = items.map(([name, p], i) => (p != null && i < items.length - 1
    ? `<li><a href="${href(p)}">${esc(name)}</a></li>`
    : `<li aria-current="page">${esc(name)}</li>`)).join('');
  const ld = {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(p != null ? { item: abs(p) } : {}) })),
  };
  return { html: `<nav class="bc" aria-label="現在地"><ol>${li}</ol></nav>`, ld };
}

// 出典（公共データ利用規約に沿って、出典と「加工して作成」を書く）
export function sourceLine() {
  const y = BUILD.years;
  const a = `<a href="${SOURCES.hikaku.url}" rel="noopener">「${SOURCES.hikaku.name}」</a>（総務省、令和${y.hikaku}年）`;
  const b = `<a href="${SOURCES.teiin.url}" rel="noopener">「${SOURCES.teiin.name}」</a>（総務省、令和${y.teiin}年）`;
  const c = `<a href="${SOURCES.estat.url}" rel="noopener">「${SOURCES.estat.name}」</a>（総務省、令和${y.estat}年）`;
  return `出典：${a}、${b}、${c}をもとに${OPERATOR}が加工して作成。国（総務省）が作成したものではありません。`;
}

export function shareButtons(url, text) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const hatena = url.replace(/^https:\/\//, 's/');
  return `<div class="share" data-url="${esc(url)}">
<span class="share-l">シェア</span>
<a class="sh sh-x" href="https://x.com/intent/post?text=${t}&amp;url=${u}" target="_blank" rel="noopener">X</a>
<a class="sh sh-line" href="https://social-plugins.line.me/lineit/share?url=${u}" target="_blank" rel="noopener">LINE</a>
<a class="sh sh-hb" href="https://b.hatena.ne.jp/entry/${esc(hatena)}" target="_blank" rel="noopener">はてブ</a>
<button class="sh sh-copy" type="button">リンクをコピー</button>
</div>`;
}

export function layout({ title, description, path, body, ld = [], noindex = false, ogTitle }) {
  const canonical = abs(path);
  const graph = ld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld }).replace(/</g, '\\u003c')}</script>` : '';
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${abs('assets/og.png')}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#155e63">
<link rel="icon" href="${href('assets/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${href('assets/icon-180.png')}">
<link rel="stylesheet" href="${href(`assets/style.css?v=${ASSET_V}`)}">
<script defer src="${href(`assets/app.js?v=${ASSET_V}`)}"></script>
${graph}
</head>
<body>
<header class="hd">
<div class="wrap hd-in">
<a class="logo" href="${href('')}"><span class="logo-m" aria-hidden="true">役</span><span>${SITE_NAME}</span></a>
<form class="sb" role="search" action="${href('search/')}" data-base="${BASE}">
<input class="sb-i" name="q" type="search" placeholder="市区町村名で検索（例：横浜市）" autocomplete="off" aria-label="自治体名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<nav class="nv" aria-label="メニュー"><a href="${href('ranking/')}">ランキング</a><a href="${href('ken/')}">都道府県</a><a href="${href('shokushu/')}">職種別</a><a href="${href('nenrei/')}">年齢別</a><a href="${href('about/')}">使い方</a></nav>
</div>
</header>
<main class="wrap">
${body}
</main>
<footer class="ft">
<div class="wrap">
<p class="ft-src">${sourceLine()}</p>
<p>年収は国の公表値から計算した推計で、職員一人ひとりの給与ではありません。平均は職員の年齢構成で上下します。最新の正確な情報は各団体の公表資料をご確認ください。</p>
<nav class="ft-nv"><a href="${href('')}">トップ</a><a href="${href('ranking/')}">ランキング</a><a href="${href('ken/')}">都道府県から探す</a><a href="${href('shokushu/')}">職種別</a><a href="${href('nenrei/')}">年齢別の給与</a><a href="${href('about/')}">このサイトについて</a><a href="${href('about/#privacy')}">プライバシー</a></nav>
<p class="ft-c">© ${new Date().getFullYear()} ${OPERATOR}　｜　データ更新：${esc(BUILD.built)}</p>
</div>
</footer>
</body>
</html>
`;
}

export function pager(basePath, page, pages) {
  if (pages <= 1) return '';
  const link = (p, label = p) => (p === page ? `<span aria-current="page">${label}</span>` : `<a href="${href(p === 1 ? basePath : `${basePath}${p}/`)}">${label}</a>`);
  const items = [];
  for (let p = 1; p <= pages; p++) items.push(link(p, `${(p - 1) * 300 + 1}位〜`));
  return `<nav class="pg" aria-label="ページ">${items.join('')}</nav>`;
}
