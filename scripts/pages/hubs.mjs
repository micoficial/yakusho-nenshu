// トップ・ランキング・都道府県・職種別・年齢別・このサイトについて・検索・404
import { SITE_NAME, OPERATOR, OPERATOR_ID, CONTACT, SOURCES, PREFS, JOBS, GROUPS, METRICS, METRIC_BY_KEY, officeName, SMALL_STAFF } from '../lib/meta.mjs';
import { esc, comma, man, yen, num, age, reiwaYear } from '../lib/format.mjs';
import { layout, breadcrumbs, href, abs, prefOf, dantaiPath, prefPath, rankPath, jobPath, placeLabel, shareButtons, buildInfo, BASE, prefUnit } from '../lib/html.mjs';

const kubunShort = (d) => ({ 1: '都道府県', 2: '政令市', 3: '市', 4: '特別区', 5: '町', 6: '村' }[d.kubun]);

// 指標ごとの表の列: [見出し, (d) => セル, 主列か]
const COLS = {
  nenshu: [['平均年収（推計）', (d) => `<b>${man(d.nenshu)}</b>`, true], ['平均年齢', (d) => age(d.jobs.gyosei.age)], ['ラスパイレス', (d) => num(d.ras, 1)]],
  ras: [['ラスパイレス指数', (d) => `<b>${num(d.ras, 1)}</b>`, true], ['平均年収（推計）', (d) => man(d.nenshu)], ['平均年齢', (d) => age(d.jobs.gyosei.age)]],
  bonus: [['ボーナス（年間）', (d) => `<b>${man(d.bonus)}</b>`, true], ['支給月数', (d) => (d.jobs.gyosei.bonus?.months > 0 ? `${num(d.jobs.gyosei.bonus.months, 2).replace(/\.?0+$/, '')}か月` : '—')], ['平均年齢', (d) => age(d.jobs.gyosei.age)]],
  taishoku: [['定年退職者等の平均', (d) => `<b>${man(d.taishokuTeinen, 0)}</b>`, true], ['全退職者の平均', (d) => (d.taishoku?.gyosei?.zen > 0 ? man(d.taishoku.gyosei.zen * 1000, 0) : '—')], ['平均年収（推計）', (d) => man(d.nenshu)]],
  shoninkyu: [['大学卒', (d) => `<b>${yen(d.shoninkyu)}</b>`, true], ['短大卒', (d) => (d.es?.sTan > 0 ? yen(d.es.sTan) : '—')], ['高校卒', (d) => (d.es?.sKou > 0 ? yen(d.es.sKou) : '—')]],
  shucho: [['首長の給料月額', (d) => `<b>${man(d.shuchoPay, 1)}</b>`, true], ['副首長', (d) => (d.shucho?.fuku > 0 ? man(d.shucho.fuku, 1) : '—')], ['議員の報酬', (d) => (d.es?.giin > 0 ? man(d.es.giin, 1) : '—')]],
};

function dCell(d, { showPref = true } = {}) {
  const meta = [showPref && d.kubun !== 1 ? prefOf(d.pref).name : '', kubunShort(d), d.staff != null && d.staff < SMALL_STAFF ? `一般行政職${d.staff}人` : ''].filter(Boolean).join('・');
  return `<a href="${href(dantaiPath(d))}">${esc(d.name)}</a><small>${esc(meta)}</small>`;
}

export function rankTable(rows, cols, opts = {}) {
  const tr = rows.map(({ d, rank }) => `<tr><td class="rt-n">${comma(rank)}</td><td class="rt-c">${dCell(d, opts)}</td>${cols.map(([, f, main]) => `<td class="rt-v${main ? ' rt-m' : ''}">${f(d)}</td>`).join('')}</tr>`).join('\n');
  return `<div class="tw"><table class="rt${opts.sortable ? ' sortable' : ''}"><thead><tr><th>順位</th><th>団体</th>${cols.map(([h]) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
${tr}
</tbody></table></div>`;
}

function pager(basePath, page, pages, per) {
  if (pages <= 1) return '';
  const items = [];
  for (let p = 1; p <= pages; p++) {
    const label = `${comma((p - 1) * per + 1)}位〜`;
    items.push(p === page ? `<span aria-current="page">${label}</span>` : `<a href="${href(p === 1 ? basePath : `${basePath}${p}/`)}">${label}</a>`);
  }
  return `<nav class="pg" aria-label="ページ">${items.join('')}</nav>`;
}

const AGE_NOTE = '平均年収は、職員の平均年齢が高い団体ほど高く出やすくなります。年齢と学歴の違いをそろえた給料の水準はラスパイレス指数で比べてください。';

// ---------------- トップ ----------------
export function renderTop(ctx) {
  const { R, med, lists, list, totals } = ctx;
  const yr = reiwaYear(R);
  const top5 = (key) => (lists.group.get(key) || []).slice(0, 5);
  const tile = (g) => `<li class="tile"><a class="tile-h" href="${href(rankPath(METRIC_BY_KEY.get('nenshu'), g))}">${esc(g.key === 'ken' ? '県庁（都道府県）' : g.key === 'shi' ? '市役所' : g.key === 'seirei' ? '政令市' : g.key === 'ku' ? '東京23区' : '町村役場')}の年収ランキング</a><ol>${top5(g.key).map(({ d, rank }) => `<li><span>${rank}</span><a href="${href(dantaiPath(d))}">${esc(d.kubun === 1 ? d.name : placeLabel(d))}</a><em>${man(d.nenshu)}</em></li>`).join('')}</ol></li>`;
  const all = lists.all;
  const prefGrid = PREFS.map((p) => `<li><a href="${href(prefPath(p))}">${esc(p.short)}<small>${man(med.pref.get(p.code)?.nenshu, 0)}</small></a></li>`).join('');
  const examples = ['011002', '141003', '271004', '401307', '130001', '131041'].map((c) => ctx.D.get(c)).filter(Boolean);
  const faq = [
    ['地方公務員の平均年収はいくらですか？', `全国${comma(list.length)}団体の一般行政職の推計年収を並べると、真ん中（中央値）は${man(med.all.nenshu)}です（令和${R}年）。いちばん高いのは${all[0].d.name}の${man(all[0].d.nenshu)}、いちばん低いのは${all[all.length - 1].d.name}の${man(all[all.length - 1].d.nenshu)}でした。`],
    ['年収はどうやって計算していますか？', `総務省が公表している一般行政職の「平均給与月額」（給料＋月ごとの手当、令和${R}年4月1日現在）を12倍し、「期末・勤勉手当」（ボーナス、令和${R - 1}年度の1人あたり支給額）を足しています。職員一人ひとりの年収ではなく、平均から計算した目安です。`],
    ['ラスパイレス指数とは何ですか？', `国家公務員の給料を100としたときの、地方公務員（一般行政職）の給料の水準です。学歴と経験年数の構成をそろえて計算するので、職員の年齢構成が違う団体どうしでも比べやすい指数です。全地方公共団体の平均は${num(totals['全地方公共団体'].ras, 1)}です。`],
  ];
  const faqLd = { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  const body = `<section class="hero">
<p class="hero-k">全国${comma(list.length)}自治体・国の統計から無料で</p>
<h1>役所の<span>年収</span>しらべ</h1>
<p class="hero-l">市役所・県庁・町村役場の職員の<b>平均年収（推計）・給料・ボーナス・退職金・ラスパイレス指数</b>を、総務省の公表データから自治体ごとに比べられます。令和${R}年（${yr}年）4月1日現在。</p>
<form class="sb sb-big" role="search" action="${href('search/')}" data-base="${BASE}">
<input class="sb-i" name="q" type="search" placeholder="市区町村名・都道府県名で検索" autocomplete="off" aria-label="自治体名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<p class="hero-ex">例：${examples.map((d) => `<a href="${href(dantaiPath(d))}">${esc(officeName(d))}</a>`).join('')}</p>
</section>
<section class="sec"><div class="kf kf-3">
<div class="kf-i kf-main"><span>全国の中央値（推計年収）</span><b>${man(med.all.nenshu)}</b><em>一般行政職・${comma(list.length)}団体</em></div>
<div class="kf-i"><span>いちばん高い</span><b>${man(all[0].d.nenshu)}</b><em><a href="${href(dantaiPath(all[0].d))}">${esc(placeLabel(all[0].d))}</a></em></div>
<div class="kf-i"><span>ラスパイレス指数（全国）</span><b>${num(totals['全地方公共団体'].ras, 1)}</b><em>国家公務員＝100</em></div>
</div></section>
<section class="sec"><h2>年収ランキング（上位5団体）</h2>
<ul class="tiles">${GROUPS.filter((g) => g.key !== 'all').map(tile).join('')}</ul>
<p class="more"><a href="${href('ranking/')}">ラスパイレス指数・ボーナス・退職金・初任給・首長の給料のランキングも見る</a></p>
</section>
<section class="sec"><h2>都道府県から探す</h2><p class="note">数字は県内の市区町村の推計年収の中央値です。</p><ul class="grid">${prefGrid}</ul></section>
<section class="sec"><h2>職種・年齢で見る</h2><ul class="links-l">
<li><a href="${href('shokushu/')}">職種別の年収</a><small>一般行政職のほか、教員・警察官・清掃職員・学校給食員・バス運転手など</small></li>
<li><a href="${href('nenrei/')}">年齢別の給与（全国平均）</a><small>市役所・県庁・町村役場で、20代・30代・40代…の平均給与と年収の目安</small></li>
</ul></section>
<section class="sec why"><h2>このサイトについて</h2>
<p>地方公務員の給与は、各自治体が「給与・定員管理等について」として公表しています。ただ、自治体ごとに別々のPDFやExcelで公表されているため、ほかの自治体と並べて比べるのは手間がかかります。${SITE_NAME}は、総務省がまとめている全国の自治体の一覧表をもとに、1団体ずつのページとランキングを作りました。</p>
<p>年収は国の公表値から計算した<b>推計</b>です（<a href="${href('about/#calc')}">計算のしかた</a>）。平均は職員の年齢構成で上下します。</p>
</section>
<section class="sec faq"><h2>よくある質問</h2>${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}</section>`;
  return layout({
    title: `${SITE_NAME}｜市役所・県庁・町村役場の年収・給料・ボーナスを全国${comma(list.length)}自治体で比較【${yr}年】`,
    description: `全国${comma(list.length)}の自治体（県庁・市役所・区役所・町村役場）の職員の平均年収（推計）、給料、ボーナス、退職金、ラスパイレス指数、初任給、職員数を、総務省の公表データから無料で比べられます。令和${R}年（${yr}年）4月1日現在。`,
    path: '', body, ld: [faqLd, { '@type': 'WebSite', name: SITE_NAME, url: abs(''), potentialAction: { '@type': 'SearchAction', target: `${abs('search/')}?q={q}`, 'query-input': 'required name=q' } }],
  });
}

// ---------------- ランキング ----------------
export function renderRankingIndex(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['ランキング', null]]);
  const yr = reiwaYear(ctx.R);
  const body = `${bc.html}
<header class="ph"><h1>地方公務員の給与ランキング【${yr}年】</h1>
<p class="lead">全国${comma(ctx.list.length)}の自治体を、推計年収・ラスパイレス指数・ボーナス・退職金・初任給・首長の給料で並べました。区分（都道府県・市・政令市・東京23区・町村）ごとにも見られます。</p></header>
${METRICS.map((m) => `<section class="card"><h2><a href="${href(rankPath(m, GROUPS[0]))}">${esc(m.label)}</a></h2><p class="note">${esc(m.lead)}</p>
<div class="chips">${GROUPS.map((g) => `<a href="${href(rankPath(m, g))}">${esc(g.short)}</a>`).join('')}</div></section>`).join('\n')}
<div class="def">${AGE_NOTE}</div>`;
  return layout({ title: `地方公務員の給与ランキング一覧【${yr}年】年収・ボーナス・退職金・初任給｜${SITE_NAME}`, description: `市役所・県庁・町村役場の職員の推計年収、ラスパイレス指数、ボーナス、退職金、初任給、首長の給料のランキング（全国${comma(ctx.list.length)}自治体、令和${ctx.R}年）。`, path: 'ranking/', body, ld: [bc.ld] });
}

export function renderRanking(ctx, m, g, page) {
  const rows = ctx.rankRows(m.key, g.key);
  const per = ctx.perPage;
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const slice = rows.slice((page - 1) * per, page * per);
  const yr = reiwaYear(ctx.R);
  const title0 = `${m.title(g)}`;
  const scope = g.key === 'all' ? `全国${comma(rows.length)}自治体` : `${g.name}${comma(rows.length)}団体`;
  const bc = breadcrumbs([['トップ', ''], ['ランキング', 'ranking/'], [m.label, g.key === 'all' && page === 1 ? null : rankPath(m, GROUPS[0])], ...(g.key === 'all' ? [] : [[g.short, page === 1 ? null : rankPath(m, g)]]), ...(page > 1 ? [[`${comma((page - 1) * per + 1)}位〜`, null]] : [])]);
  const base = rankPath(m, g);
  const notes = {
    nenshu: `推計年収＝一般行政職の平均給与月額（令和${ctx.R}年4月1日現在）×12か月＋期末・勤勉手当（令和${ctx.R - 1}年度の1人あたり支給額）。寒冷地手当は含めていません。${AGE_NOTE}`,
    ras: `ラスパイレス指数は、国家公務員（行政職俸給表（一））の給料を100としたときの、一般行政職の給料の水準です。学歴と経験年数の構成をそろえて計算します。地域手当などの手当は含みません。`,
    bonus: `令和${ctx.R - 1}年度に支給された一般行政職の期末・勤勉手当の1人あたりの平均額です。支給月数は条例で決めた基準の月数です。${AGE_NOTE}`,
    taishoku: `令和${ctx.R - 1}年度に定年退職などで退職した一般行政職への退職手当の平均です。対象者がいない団体や1〜2人の団体（非公表）は載っていません。`,
    shoninkyu: '一般行政職の大学卒の初任給基準額（採用時の給料月額。地域手当などの手当は含みません）です。同じ額の団体は同じ順位です。',
    shucho: '条例で決めた知事・市区町村長の給料月額です。ボーナス（期末手当）や退職手当は含みません。',
  };
  const chipsG = GROUPS.map((x) => (x.key === g.key ? `<span>${esc(x.short)}</span>` : `<a href="${href(rankPath(m, x))}">${esc(x.short)}</a>`)).join('');
  const chipsM = METRICS.map((x) => (x.key === m.key ? `<span>${esc(x.short)}</span>` : `<a href="${href(rankPath(x, g))}">${esc(x.short)}</a>`)).join('');
  const top3 = rows.slice(0, 3).map(({ d }) => d.name).join('、');
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">令和${ctx.R}年（${yr}年）4月1日現在｜${esc(scope)}</p>
<h1>${esc(title0)}${page > 1 ? `（${comma((page - 1) * per + 1)}位〜）` : ''}</h1>
<p class="lead">${esc(m.lead)}に、${esc(scope)}を並べました。${page === 1 ? `上位は${esc(top3)}です。` : ''}</p></header>
<div class="chips">${chipsG}</div>
<div class="chips chips-m">${chipsM}</div>
<div class="def">${esc(notes[m.key])}</div>
${pager(base, page, pages, per)}
${rankTable(slice, COLS[m.key], { showPref: g.key !== 'ken' })}
${pager(base, page, pages, per)}
${page === 1 ? shareButtons(abs(base), `${title0}【${yr}年】`) : ''}`;
  const path = page > 1 ? `${base}${page}/` : base;
  return layout({
    title: `${title0}【${yr}年】${scope}${page > 1 ? `（${comma((page - 1) * per + 1)}位〜）` : ''}｜${SITE_NAME}`,
    description: `${m.lead}に${scope}を並べたランキング（令和${ctx.R}年・総務省の公表データから作成）。${page === 1 ? `1位は${rows[0]?.d.name}。` : ''}平均年齢やラスパイレス指数もあわせて見られます。`,
    path, body, ld: [bc.ld],
  });
}

// ---------------- 都道府県 ----------------
export function renderPrefIndex(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['都道府県', null]]);
  const yr = reiwaYear(ctx.R);
  const rows = PREFS.map((p) => {
    const k = ctx.D.get(ctx.prefCode(p));
    const m = ctx.med.pref.get(p.code);
    return `<tr><td class="rt-c"><a href="${href(prefPath(p))}">${esc(p.name)}</a><small>${comma(m.n)}${prefUnit(p)}</small></td><td class="rt-v"><a href="${href(dantaiPath(k))}">${man(k.nenshu)}</a></td><td class="rt-v rt-m">${man(m.nenshu)}</td><td class="rt-v">${num(m.ras, 1)}</td></tr>`;
  }).join('\n');
  const body = `${bc.html}
<header class="ph"><h1>都道府県から探す</h1>
<p class="lead">都道府県庁と、県内の市区町村の職員の平均年収（推計）を比べられます（令和${ctx.R}年）。</p></header>
<div class="tw"><table class="rt sortable"><thead><tr><th>都道府県</th><th>県庁の推計年収</th><th>市町村の中央値</th><th>市町村のラスパイレス（中央値）</th></tr></thead><tbody>
${rows}
</tbody></table></div>
<div class="def">${AGE_NOTE}</div>`;
  return layout({ title: `都道府県別 公務員の年収【${yr}年】県庁と市町村｜${SITE_NAME}`, description: `47都道府県の県庁の職員の推計年収と、県内の市区町村の年収の中央値（令和${ctx.R}年）。都道府県を選ぶと、県内の市役所・町村役場の年収ランキングが見られます。`, path: 'ken/', body, ld: [bc.ld] });
}

export function renderPref(ctx, p) {
  const k = ctx.D.get(ctx.prefCode(p));
  const rows = ctx.lists.pref.get(p.code);
  const m = ctx.med.pref.get(p.code);
  const unit = prefUnit(p);
  const yr = reiwaYear(ctx.R);
  const offices = p.code === 13 ? '市役所・区役所・町村役場' : '市役所・町村役場';
  const bc = breadcrumbs([['トップ', ''], ['都道府県', 'ken/'], [p.name, null]]);
  const kr = ctx.rank.nenshu.group.get(k.code);
  const cols = [
    ['平均年収（推計）', (d) => `<b>${man(d.nenshu)}</b>`, true],
    ['平均年齢', (d) => age(d.jobs.gyosei.age)],
    ['ラスパイレス', (d) => num(d.ras, 1)],
    ['ボーナス', (d) => man(d.bonus)],
    ['大卒初任給', (d) => (d.shoninkyu ? yen(d.shoninkyu) : '—')],
  ];
  const hi = rows[0];
  const lo = rows[rows.length - 1];
  const others = PREFS.filter((x) => x.code !== p.code).map((x) => `<li><a href="${href(prefPath(x))}">${esc(x.short)}</a></li>`).join('');
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">令和${ctx.R}年（${yr}年）4月1日現在｜一般行政職</p>
<h1>${esc(p.name)}の${offices}の年収ランキング</h1>
<p class="lead">${esc(p.name)}の${comma(rows.length)}${unit}の職員（一般行政職）の平均年収（推計）を高い順に並べました。いちばん高いのは${esc(hi.d.name)}の${man(hi.d.nenshu)}、県内の中央値は${man(m.nenshu)}です。</p></header>
<div class="kf kf-3">
<div class="kf-i kf-main"><span>${esc(officeName(k))}</span><b>${man(k.nenshu)}</b><em>都道府県${kr.rank}位／47・<a href="${href(dantaiPath(k))}">詳しく</a></em></div>
<div class="kf-i"><span>${unit}の中央値</span><b>${man(m.nenshu)}</b><em>平均年齢の中央値${age(m.age)}</em></div>
<div class="kf-i"><span>最高と最低</span><b>${man(hi.d.nenshu, 0)}／${man(lo.d.nenshu, 0)}</b><em>${esc(hi.d.name)}／${esc(lo.d.name)}</em></div>
</div>
<div class="def">${AGE_NOTE} 表の見出しを押すと並べ替えられます。</div>
${rankTable(rows, cols, { showPref: false, sortable: true })}
${shareButtons(abs(prefPath(p)), `${p.name}の${offices}の年収ランキング【${yr}年】`)}
<section class="sec"><h2>ほかの都道府県</h2><ul class="grid">${others}</ul></section>`;
  return layout({
    title: `${p.name}の${offices}の年収ランキング【${yr}年】${comma(rows.length)}${unit}の給料・ボーナス｜${SITE_NAME}`,
    description: `${p.name}の${comma(rows.length)}${unit}と${officeName(k)}の職員の平均年収（推計）、平均年齢、ラスパイレス指数、ボーナス、初任給を比べたランキング（令和${ctx.R}年）。1位は${hi.d.name}の${man(hi.d.nenshu)}。`,
    path: prefPath(p), body, ld: [bc.ld],
  });
}

// ---------------- 職種別 ----------------
export function renderJobIndex(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['職種別', null]]);
  const yr = reiwaYear(ctx.R);
  const rows = JOBS.map((j) => {
    const s = ctx.jobStats.get(j.key);
    return `<tr><td class="rt-c"><a href="${href(jobPath(j))}">${esc(j.name)}</a><small>${comma(s.n)}団体</small></td><td class="rt-v rt-m">${man(s.nenshu)}</td><td class="rt-v">${man(s.kyuyo)}</td><td class="rt-v">${age(s.age)}</td></tr>`;
  }).join('\n');
  const body = `${bc.html}
<header class="ph"><h1>地方公務員の職種別の年収【${yr}年】</h1>
<p class="lead">一般行政職（事務・技術）のほか、教員・警察官・技能労務職（清掃・学校給食・用務・運転など）の平均年収（推計）を、団体ごとに比べられます。</p></header>
<div class="tw"><table class="rt"><thead><tr><th>職種</th><th>推計年収（団体の中央値）</th><th>平均給与月額</th><th>平均年齢</th></tr></thead><tbody>
${rows}
</tbody></table></div>
<p class="note">中央値は、その職種の職員がいて数字が公表されている団体の値を並べたときの真ん中です。推計年収＝平均給与月額×12か月＋期末・勤勉手当。</p>
<section class="sec"><h2>職種の説明</h2><dl class="dl dl-w">${JOBS.map((j) => `<div><dt>${esc(j.name)}</dt><dd>${esc(j.desc)}</dd></div>`).join('')}</dl></section>`;
  return layout({ title: `地方公務員の職種別の年収【${yr}年】教員・警察官・清掃職員・給食員など｜${SITE_NAME}`, description: `地方公務員の職種別の平均年収（推計）：一般行政職、教育公務員、警察職、技能労務職（清掃職員・学校給食員・用務員・自動車運転手・守衛・バス運転手）。団体ごとのランキングつき（令和${ctx.R}年）。`, path: 'shokushu/', body, ld: [bc.ld] });
}

export function renderJob(ctx, j, page) {
  const rows = ctx.jobRows(j.key);
  const s = ctx.jobStats.get(j.key);
  const per = ctx.perPage;
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const slice = rows.slice((page - 1) * per, page * per);
  const yr = reiwaYear(ctx.R);
  const base = jobPath(j);
  const bc = breadcrumbs([['トップ', ''], ['職種別', 'shokushu/'], [j.name, page === 1 ? null : base], ...(page > 1 ? [[`${comma((page - 1) * per + 1)}位〜`, null]] : [])]);
  const x = (d) => d.jobs[j.key];
  // 民間の値が全国平均の職種（清掃）は表の列にせず、上の説明に1回だけ書く
  const refRow = j.ref ? rows.find(({ d }) => x(d).minkan?.mKyuyo > 0) : null;
  const ref = refRow ? x(refRow.d).minkan : null;
  const nationalRef = ref?.scope === 'zenkoku';
  const cols = [
    ['平均年収（推計）', (d) => `<b>${man(x(d).nenshu)}</b>`, true],
    ['平均給与月額', (d) => man(x(d).kyuyo)],
    ['平均年齢', (d) => age(x(d).age)],
    ...(j.ref && !nationalRef ? [['民間の似た仕事（県）', (d) => (x(d).minkan?.mKyuyo > 0 ? `${num(x(d).minkan.mKyuyo / 10, 1)}万円<small>${num(x(d).minkan.mAge, 1)}歳</small>` : '—')]] : []),
  ];
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">令和${ctx.R}年（${yr}年）4月1日現在｜${comma(rows.length)}団体</p>
<h1>${esc(j.name)}の年収ランキング（地方公務員）${page > 1 ? `（${comma((page - 1) * per + 1)}位〜）` : ''}</h1>
<p class="lead">${esc(j.desc)}</p></header>
<div class="kf kf-3">
<div class="kf-i kf-main"><span>推計年収（団体の中央値）</span><b>${man(s.nenshu)}</b><em>${comma(s.n)}団体</em></div>
<div class="kf-i"><span>平均給与月額（中央値）</span><b>${man(s.kyuyo)}</b><em>給料＋月ごとの手当</em></div>
<div class="kf-i"><span>平均年齢（中央値）</span><b>${age(s.age)}</b><em>${s.secret ? `ほかに${comma(s.secret)}団体は職員1〜2人で非公表` : ''}</em></div>
</div>
<div class="def">推計年収＝平均給与月額×12か月＋期末・勤勉手当。職員が1〜2人の団体は国の表で数字が伏せられているため載っていません。${ref ? (nationalRef ? `民間の似た仕事（${esc(ref.mName)}）の全国平均は、月の給与${num(ref.mKyuyo / 10, 1)}万円・平均${num(ref.mAge, 1)}歳です（国の賃金構造基本統計調査。残業代などを含み、ボーナスを除く月の給与で、総務省が比較のために示しているもの）。` : `「民間の似た仕事（県）」は、国の賃金構造基本統計調査による都道府県の${esc(ref.mName)}の平均（残業代などを含み、ボーナスを除く月の給与）で、総務省が比較のために示しているものです。`) + '年齢や仕事の範囲が違うので、あくまで参考です。' : ''}${j.key === 'gyosei' ? ' 一般行政職の区分ごとのランキングは「ランキング」からも見られます。' : ''}</div>
${pager(base, page, pages, per)}
${rankTable(slice, cols)}
${pager(base, page, pages, per)}`;
  const path = page > 1 ? `${base}${page}/` : base;
  return layout({
    title: `${j.name}の年収ランキング（地方公務員）【${yr}年】${comma(rows.length)}団体${page > 1 ? `（${comma((page - 1) * per + 1)}位〜）` : ''}｜${SITE_NAME}`,
    description: `地方公務員の${j.name}の平均年収（推計）を団体ごとに比べたランキング。中央値は${man(s.nenshu)}、平均年齢の中央値は${age(s.age)}（令和${ctx.R}年・${comma(rows.length)}団体）。`,
    path, body, ld: [bc.ld],
  });
}

// ---------------- 年齢別 ----------------
export function renderAge(ctx) {
  const { age: A, ageKyuryo: AK, bonusRatio } = ctx;
  const yr = reiwaYear(ctx.R);
  const bc = breadcrumbs([['トップ', ''], ['年齢別の給与', null]]);
  const KUBUNS = [['市', '市役所（政令市を除く市）', 'shi'], ['町村', '町村役場', 'chouson'], ['都道府県', '県庁（都道府県）', 'ken'], ['指定都市', '政令指定都市の市役所', 'seirei'], ['特別区', '東京23区の区役所', 'ku'], ['全地方公共団体', '全国の自治体すべて', 'all']];
  const sec = ([k, label, gk]) => {
    const t = A[k].gyosei;
    const tk = AK[k].gyosei;
    const ratio = bonusRatio[gk];
    const rows = t.rows.filter((r) => r.n > 0 && r.v > 0);
    const kyuryoOf = (label2) => tk.rows.find((r) => r.label === label2)?.v;
    const tr = rows.map((r) => {
      const ky = kyuryoOf(r.label);
      const est = r.label === '合計' ? null : ky ? r.v * 12 + ky * ratio : null;
      const lab = r.label === '合計' ? '全体' : `${r.label.replace('～', '〜')}${/歳/.test(r.label) ? '' : '歳'}`;
      return `<tr${r.label === '合計' ? ' class="sum"' : ''}><th>${esc(lab)}</th><td>${man(r.v)}</td><td>${r.dai.v && r.dai.n >= 10 ? man(r.dai.v) : '—'}</td><td>${r.kou.v && r.kou.n >= 10 ? man(r.kou.v) : '—'}</td><td>${est ? `<b>${man(est, 0)}</b>` : '—'}</td><td>${comma(r.n)}人</td></tr>`;
    }).join('\n');
    return `<section class="sec" id="${gk}"><h2>${esc(label)}</h2>
<div class="tw"><table class="dt age"><thead><tr><th>年齢</th><th>平均給与月額</th><th>大学卒</th><th>高校卒</th><th>年収の目安</th><th>人数</th></tr></thead><tbody>
${tr}
</tbody></table></div>
<p class="note">平均年齢${age(t.avgAge?.all)}。年収の目安＝平均給与月額×12か月＋平均給料月額×${num(ratio, 2)}か月（この区分の団体全体の期末・勤勉手当が給料の何か月分にあたるかの比率）。</p></section>`;
  };
  const body = `${bc.html}
<header class="ph"><p class="eyebrow">令和${ctx.R}年（${yr}年）4月1日現在｜一般行政職｜全国の集計</p>
<h1>地方公務員の年齢別の給与と年収の目安</h1>
<p class="lead">市役所・町村役場・県庁などで働く一般行政職（事務・技術の職員）の、年齢ごとの平均給与月額です。団体ごとの年齢別の数字は国の一覧表にないため、ここでは区分ごとの全国の集計を載せています。</p></header>
<div class="chips">${KUBUNS.map(([, label, gk]) => `<a href="#${gk}">${esc(label.replace(/（.*）/, ''))}</a>`).join('')}</div>
<div class="def">平均給与月額は、給料（基本給）と、地域手当・扶養手当・時間外勤務手当など月ごとの手当の合計です。年収の目安は、ボーナス（期末・勤勉手当）を年齢ごとの給料に比例させて足した概算で、国の公表値そのものではありません。管理職になる人とならない人の平均なので、40代以降は人によって差が大きくなります。採用1年目はボーナスが満額出ないので、実際はこれより少なくなります。学歴別は10人未満のときは載せていません。</div>
${KUBUNS.map(sec).join('\n')}
<p class="note">出典：総務省「地方公務員給与実態調査」第7表（職種別、年齢別、学歴別職員数及び平均給与月額・平均給料月額、団体区分別）、政府統計の総合窓口（e-Stat）。</p>`;
  return layout({ title: `地方公務員の年齢別の給与と年収【${yr}年】20代・30代・40代・50代｜${SITE_NAME}`, description: `市役所・町村役場・県庁の一般行政職の年齢別の平均給与月額と年収の目安（20〜23歳から60代まで、令和${ctx.R}年の全国集計）。大学卒・高校卒別。`, path: 'nenrei/', body, ld: [bc.ld] });
}

// ---------------- このサイトについて ----------------
export function renderAbout(ctx) {
  const info = buildInfo();
  const y = info.years;
  const bc = breadcrumbs([['トップ', ''], ['このサイトについて', null]]);
  const body = `${bc.html}
<header class="ph"><h1>このサイトについて・使い方</h1>
<p class="lead">${SITE_NAME}は、地方公務員の給与について国が公表しているデータを、自治体ごとに無料で見比べられるようにしたサイトです。</p></header>
<section class="card"><h2>使っているデータ</h2>
<ul class="ul">
<li><a href="${SOURCES.hikaku.url}" rel="noopener">${SOURCES.hikaku.name}</a>（総務省、令和${y.hikaku}年）：全国の都道府県・市区町村のラスパイレス指数、平均年齢、平均給料月額、諸手当、期末・勤勉手当、退職手当、技能労務職員の給与、首長の給料など。推移には令和${Math.min(...ctx.histYears)}年からの各年の表を使っています。</li>
<li><a href="${SOURCES.estat.url}" rel="noopener">${SOURCES.estat.name}</a>（総務省、令和${y.estat}年）：団体ごとの職員数・初任給・採用と退職の人数・議員の報酬・教育長の給料（別冊）と、年齢別の平均給与（第7表）。</li>
<li><a href="${SOURCES.teiin.url}" rel="noopener">${SOURCES.teiin.name}</a>（総務省、令和${y.teiin}年）：部門別の職員数（一般行政・教育・警察・消防・公営企業など）。</li>
</ul>
<p>どれも「公共データ利用規約（第1.0版）」にもとづいて、出典を書けば商用を含めて自由に使えるデータです。${SITE_NAME}は、これらのデータを${OPERATOR}が加工して作成しています。国（総務省）が作成したものではありません。データは定期的に確認し、新しい年の公表があれば更新します（最終更新：${esc(info.built)}）。</p></section>
<section class="card" id="calc"><h2>推計年収の計算のしかた</h2>
<p class="formula">推計年収 ＝ 平均給与月額 × 12か月 ＋ 期末・勤勉手当（1年分）</p>
<ul class="ul">
<li><b>平均給与月額</b>：令和${ctx.R}年4月1日現在の、平均給料月額（基本給）と諸手当月額（扶養手当・地域手当・住居手当・通勤手当・時間外勤務手当・管理職手当など、月ごとに支払う手当）の合計です。</li>
<li><b>期末・勤勉手当</b>：いわゆるボーナスです。令和${ctx.R - 1}年度に支給された、支給職員1人あたりの平均の年額です。</li>
<li>寒冷地手当（北海道・東北などの寒冷地で冬に出る手当）は、地域による差が大きいため年収に含めず、団体のページに参考として載せています。</li>
<li>断りがなければ、年収やランキングは<b>一般行政職</b>（事務や技術の仕事をする職員。教員・警察官・技能労務職などを除く）の数字です。</li>
<li>この式は、新聞・雑誌などが地方公務員の年収を比べるときに使う一般的なものです。月ごとの手当は4月の数字を12倍しているので、実際の1年間の支給額とは違います。</li>
</ul></section>
<section class="card" id="ras"><h2>ラスパイレス指数とは</h2>
<p>国家公務員（行政職俸給表（一）が適用される職員）の給料を100としたときの、その団体の一般行政職の給料の水準です。職員の学歴と経験年数の構成を国と同じにそろえて計算するので、職員の平均年齢が違う団体どうしでも比べやすい指数です。地域手当などの手当は含みません。</p></section>
<section class="card"><h2>見るときの注意</h2>
<ul class="ul">
<li><b>個人の給与ではありません。</b>新人から管理職まで、年齢も役職も違う職員全体の平均です。</li>
<li><b>平均年齢で平均は変わります。</b>ベテランの多い団体は高く、若手の多い団体は低く出ます。ランキングには平均年齢も並べています。</li>
<li><b>都市部は地域手当で高くなります。</b>物価や民間の賃金が高い地域では、給料などの最大20%の地域手当が出ます。</li>
<li><b>残業代が含まれます。</b>平均給与月額には時間外勤務手当が入るため、残業の多い団体は高く出ます（団体のページに内訳を載せています）。</li>
<li><b>職員の少ない団体は平均が動きやすい</b>です。一般行政職が${SMALL_STAFF}人未満の団体には印をつけています。</li>
<li>令和5年は5年に1度の基幹統計調査の年で、全国の平均でも手当が前後の年より高く出ています。推移を見るときはご注意ください。</li>
<li>国の表では、対象の職員が1〜2人のときは数字が伏せられています（このサイトでは「非公表」）。</li>
<li>国の表の数字は、各団体が自ら公表している数字と、報告の時期などの関係で違うことがあります。</li>
</ul></section>
<section class="card" id="privacy"><h2>運営者・お問い合わせ・プライバシー</h2>
<dl class="dl"><div><dt>運営</dt><dd>${OPERATOR}（法人番号 ${OPERATOR_ID}）</dd></div><div><dt>お問い合わせ</dt><dd>${CONTACT}</dd></div></dl>
<p>このサイトはAIを使って作られ、データの集計や解説文の作成も自動で行っています。数字の誤りは、まず出典（上記の総務省の資料）をご確認ください。掲載内容についてのご連絡は上記メールアドレスまでお願いします。</p>
<p>このサイトはCookieを使わず、アクセス解析も行っていません。検索に入力した文字は、お使いの端末の中だけで処理され、外部に送られません。</p></section>`;
  return layout({ title: `このサイトについて・年収の計算のしかた｜${SITE_NAME}`, description: `${SITE_NAME}で使っているデータ（総務省の公表データ）、推計年収の計算式、ラスパイレス指数の意味、見るときの注意、運営者について。`, path: 'about/', body, ld: [bc.ld] });
}

export function renderSearch(ctx) {
  const bc = breadcrumbs([['トップ', ''], ['検索', null]]);
  const body = `${bc.html}
<header class="ph"><h1>自治体を探す</h1></header>
<form class="sb sb-big sb-page" role="search" action="${href('search/')}" data-base="${BASE}">
<input class="sb-i" name="q" type="search" placeholder="市区町村名・都道府県名で検索" autocomplete="off" aria-label="自治体名で検索" enterkeyhint="search">
<div class="sb-r" hidden></div>
</form>
<div id="results" class="results"></div>
<noscript><p>検索にはJavaScriptが必要です。<a href="${href('ken/')}">都道府県から探す</a>こともできます。</p></noscript>
<section class="sec"><h2>都道府県から探す</h2><ul class="grid">${PREFS.map((p) => `<li><a href="${href(prefPath(p))}">${esc(p.short)}</a></li>`).join('')}</ul></section>`;
  return layout({ title: `自治体を探す｜${SITE_NAME}`, description: `${SITE_NAME}の自治体検索。`, path: 'search/', body, ld: [bc.ld], noindex: true });
}

export function render404() {
  const body = `<header class="ph"><h1>ページが見つかりません</h1><p class="lead">URLが変わったか、まだないページです。</p></header>
<p><a href="${href('')}">トップへ</a>　<a href="${href('ken/')}">都道府県から探す</a>　<a href="${href('ranking/')}">ランキング</a></p>`;
  return layout({ title: `ページが見つかりません｜${SITE_NAME}`, description: 'ページが見つかりません。', path: '404.html', body, noindex: true });
}
