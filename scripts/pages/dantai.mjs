// 団体（都道府県・市区町村）ごとのページ
import { SITE_NAME, JOBS, officeName, SMALL_STAFF, METRIC_BY_KEY, GROUPS } from '../lib/meta.mjs';
import { esc, comma, man, yen, num, age, reiwaYear } from '../lib/format.mjs';
import { layout, breadcrumbs, href, abs, prefOf, dantaiPath, prefPath, rankPath, jobPath, placeLabel, shareButtons, buildInfo, prefUnit } from '../lib/html.mjs';

const ITEM_ORDER = ['地域手当', '扶養手当', '住居手当', '通勤手当', '時間外勤務手当', '管理職手当', '特殊勤務手当'];
const otOf = (j) => j?.items?.find(([n]) => n === '時間外勤務手当')?.[1] ?? null;

// 「都内」「道内」「府内」「県内」
const prefIn = (p) => (p.code === 13 ? '都内' : p.code === 1 ? '道内' : p.code === 26 || p.code === 27 ? '府内' : '県内');

// 「中核市」「施行時特例市」などはそのまま、「Ⅱ－３」は説明をつける
function ruijiText(d) {
  if (!d.ruiji) return d.kubun === 1 ? '都道府県' : d.kubun === 2 ? '政令指定都市' : '';
  if (/^[ⅠⅡⅢⅣⅤ]/.test(d.ruiji)) return `${d.kubun === 3 ? '一般市' : '町村'}（類型${d.ruiji}）`;
  return d.ruiji;
}

function cmpWord(v, ref, fmt, unitWord = '') {
  if (v == null || ref == null) return '';
  const dlt = v - ref;
  if (Math.abs(dlt) < 1e-9) return `と同じ${unitWord}`;
  return `より${fmt(Math.abs(dlt))}${dlt > 0 ? '高い' : '低い'}${unitWord}`;
}

export function renderDantai(d, ctx) {
  const { R, rank, med } = ctx;
  const pref = prefOf(d.pref);
  const office = officeName(d);
  const g = d.jobs.gyosei;
  const yr = reiwaYear(R);
  const info = buildInfo();
  const rk = (m, scope) => rank[m]?.[scope]?.get(d.code);
  const nAll = rk('nenshu', 'all');
  const nPref = rk('nenshu', 'pref');
  const nGroup = rk('nenshu', 'group');
  const groupName = ctx.groupOf(d).name;
  const items = Object.fromEntries(g.items || []);
  const ot = otOf(g);
  const small = d.staff != null && d.staff < SMALL_STAFF;
  const ruiji = ruijiText(d);
  const mPref = med.pref.get(d.pref);
  const mRuiji = d.ruiji ? med.ruiji.get(d.ruiji) : null;
  const mGroup = med.group.get(ctx.groupOf(d).key);

  const bc = breadcrumbs(d.kubun === 1
    ? [['トップ', ''], ['都道府県', 'ken/'], [office, null]]
    : [['トップ', ''], [pref.name, prefPath(pref)], [office, null]]);

  // ---- 要点 ----
  const kf = [
    ['平均年収（推計）', man(d.nenshu), d.kubun === 1 ? `全国${comma(nAll.rank)}位・都道府県${comma(nGroup.rank)}位` : `全国${comma(nAll.rank)}位・${prefIn(pref)}${comma(nPref.rank)}位`, true],
    ['平均給与月額', man(g.kyuyo), `給料${man(g.kyuryo)}＋手当${man(g.teate)}`],
    ['ボーナス（年間）', man(d.bonus), g.bonus?.months > 0 ? `${num(g.bonus.months, 2).replace(/\.?0+$/, '')}か月分` : '期末・勤勉手当'],
    ['平均年齢', age(g.age), `全国の中央値${age(med.all.age)}`],
    ['ラスパイレス指数', num(d.ras, 1), '国家公務員＝100'],
    ['退職金（定年等）', d.taishokuTeinen ? man(d.taishokuTeinen, 0) : '—', d.taishokuTeinen ? '一般行政職の平均' : '該当者なし・非公表'],
  ];
  const kfHtml = `<div class="kf">${kf.map(([l, v, s, main]) => `<div class="kf-i${main ? ' kf-main' : ''}"><span>${esc(l)}</span><b>${esc(v)}</b><em>${esc(s)}</em></div>`).join('')}</div>`;

  // ---- ひとことで言うと ----
  const pts = [];
  pts.push(`${esc(office)}の一般行政職（事務・技術の職員）の平均年収（推計）は<b>${man(d.nenshu)}</b>で、全国${comma(nAll.n)}団体の中で<b>${comma(nAll.rank)}位</b>、${d.kubun === 1 ? '' : `${esc(pref.name)}の${comma(nPref.n)}${prefUnit(pref)}の中で${comma(nPref.rank)}位、`}${esc(groupName)}${comma(nGroup.n)}団体の中で${comma(nGroup.rank)}位です。`);
  pts.push(`職員の平均年齢は${age(g.age)}で、全国の団体の中央値（${age(med.all.age)}）${cmpWord(g.age, med.all.age, (x) => `${num(x, 1)}歳`)}です。平均年齢が高い団体ほど平均の給与は高く出やすいので、年齢をそろえて比べるときはラスパイレス指数を見てください。`);
  pts.push(`ラスパイレス指数（国家公務員の給料を100とした水準）は<b>${num(d.ras, 1)}</b>で、全国の団体の中で${comma(rk('ras', 'all').rank)}位です（全地方公共団体の平均は${num(ctx.totals['全地方公共団体'].ras, 1)}）。`);
  if (d.chiiki > 0) pts.push(`物価や民間の賃金が高い地域で出る地域手当は給料などの${num(d.chiiki * 100, 1).replace(/\.0$/, '')}%で、1人あたり月${comma(items['地域手当'])}円です。`);
  if (ot != null) pts.push(`時間外勤務手当（残業代）は1人あたり月${comma(ot)}円で、全国の団体の中央値（${comma(med.all.ot)}円）${ot > med.all.ot ? 'より多め' : ot < med.all.ot ? 'より少なめ' : 'と同じ'}です。`);
  if (d.bonus) pts.push(`ボーナス（期末・勤勉手当）は令和${R - 1}年度の1年間で1人平均${man(d.bonus)}${g.bonus?.months > 0 ? `（基準の支給月数${num(g.bonus.months, 2).replace(/\.?0+$/, '')}か月）` : ''}でした。`);
  const first = ctx.histYears.find((r) => d.hist[r]?.nenshu);
  if (first && first !== R && d.hist[first]?.nenshu) {
    const dl = d.nenshu - d.hist[first].nenshu;
    pts.push(`令和${first}年の${man(d.hist[first].nenshu)}から、${dl >= 0 ? `${man(dl)}増えています` : `${man(-dl)}減っています`}（平均年齢は${age(d.hist[first].age)}→${age(g.age)}）。`);
  }
  if (small) pts.push(`一般行政職の職員が${comma(d.staff)}人と少ないため、退職や採用で平均が動きやすい点にご注意ください。`);

  // ---- 内訳 ----
  const itemRows = ITEM_ORDER.filter((n) => items[n] > 0).map((n) => [n, items[n]]);
  const otherItems = (g.items || []).filter(([n, v]) => !ITEM_ORDER.includes(n) && v > 0);
  const otherSum = otherItems.reduce((s, [, v]) => s + v, 0);
  const calc = `<div class="tw"><table class="dt calc"><caption>一般行政職の1人あたり平均（令和${R}年4月1日現在、ボーナスは令和${R - 1}年度）</caption><tbody>
<tr><th>給料（基本給）</th><td>${yen(g.kyuryo)}</td></tr>
${itemRows.map(([n, v]) => `<tr class="sub-r"><th>${esc(n)}</th><td>${yen(v)}</td></tr>`).join('\n')}
${otherSum > 0 ? `<tr class="sub-r"><th>その他の手当<small>${esc(otherItems.map(([n]) => n).join('・'))}</small></th><td>${yen(otherSum)}</td></tr>` : ''}
<tr class="sum"><th>平均給与月額（給料＋手当）</th><td>${yen(g.kyuyo)}</td></tr>
<tr><th>× 12か月</th><td>${yen(g.kyuyo * 12)}</td></tr>
${g.bonus?.kimatsu > 0 ? `<tr class="sub-r"><th>期末手当</th><td>${yen(g.bonus.kimatsu)}</td></tr><tr class="sub-r"><th>勤勉手当</th><td>${yen(g.bonus.kinben)}</td></tr>` : ''}
<tr><th>＋ ボーナス（期末・勤勉手当）</th><td>${yen(d.bonus)}</td></tr>
<tr class="sum total"><th>平均年収（推計）</th><td>${yen(d.nenshu)}</td></tr>
${g.kanreichi > 0 ? `<tr><th>参考：寒冷地手当（年額）</th><td>${yen(g.kanreichi)}<small>含めると${man(d.nenshu + g.kanreichi)}</small></td></tr>` : ''}
</tbody></table></div>
<p class="note">推計年収＝平均給与月額×12か月＋期末・勤勉手当。平均給与月額は令和${R}年4月1日現在の給料と月ごとの手当（時間外勤務手当を含む）の平均、期末・勤勉手当は令和${R - 1}年度に支給された1人あたりの平均です。寒冷地の団体で出る寒冷地手当は、地域による差が大きいので年収に含めていません。職員一人ひとりの給与ではありません。</p>`;

  // ---- 比べると ----
  const cmpRows = [
    ['平均年収（推計）', d.nenshu, 'nenshu', (v) => man(v)],
    ['平均年齢', g.age, 'age', (v) => age(v)],
    ['ラスパイレス指数', d.ras, 'ras', (v) => num(v, 1)],
    ['平均給与月額', g.kyuyo, 'kyuyo', (v) => man(v)],
    ['ボーナス（年間）', d.bonus, 'bonus', (v) => man(v)],
    ['時間外勤務手当（月）', ot, 'ot', (v) => yen(v)],
  ];
  const cmpCols = d.kubun === 1
    ? [['全国', med.all], ['都道府県', mGroup]]
    : [['全国', med.all], [pref.name, mPref], [ctx.groupOf(d).short, mGroup], ...(mRuiji && d.kubun > 2 ? [['同じ類型', mRuiji]] : [])];
  const cmp = `<div class="tw"><table class="dt cmp"><thead><tr><th></th><th>${esc(d.name)}</th>${cmpCols.map(([n, s]) => `<th>${esc(n)}の中央値<small>${comma(s.n)}団体</small></th>`).join('')}</tr></thead><tbody>
${cmpRows.map(([l, v, k, f]) => `<tr><th>${esc(l)}</th><td><b>${f(v)}</b></td>${cmpCols.map(([, s]) => `<td>${f(s[k])}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></div>
<p class="note">中央値は、団体を値の順に並べたときの真ん中の値です（団体ごとの職員数の違いは考えていません）。${mRuiji && d.kubun > 2 ? `「同じ類型」は、総務省が人口と産業の構造で分けた類似団体の区分「${esc(d.ruiji)}」の${comma(mRuiji.n)}団体です。` : ''}</p>`;

  // ---- 推移 ----
  const hy = ctx.histYears.filter((r) => d.hist[r]);
  const maxN = Math.max(...hy.map((r) => d.hist[r].nenshu || 0));
  const hist = hy.length > 1 ? `<div class="tw"><table class="dt hist"><thead><tr><th>年</th><th>平均年収（推計）</th><th>平均給与月額</th><th>ボーナス</th><th>平均年齢</th><th>ラスパイレス</th></tr></thead><tbody>
${hy.map((r) => { const h = d.hist[r]; return `<tr><th>令和${r}年<small>${reiwaYear(r)}年</small></th><td class="bar-c"><span class="bar" style="--w:${h.nenshu ? Math.round(h.nenshu / maxN * 100) : 0}%"></span><b>${man(h.nenshu)}</b></td><td>${man(h.kyuyo)}</td><td>${man(h.bonus)}</td><td>${age(h.age)}</td><td>${num(h.ras, 1)}</td></tr>`; }).join('\n')}
</tbody></table></div>
<p class="note">各年4月1日現在（ボーナスはその前の年度）。${ctx.histNote}</p>` : '';

  // ---- 職種別 ----
  const jobRows = JOBS.map((j) => [j, d.jobs[j.key]]).filter(([j, x]) => x && (x.ok || x.secret) && !(j.key === 'keisatsu' && d.kubun !== 1));
  const jobs = `<div class="tw"><table class="dt jobs"><thead><tr><th>職種</th><th>平均年収（推計）</th><th>平均給与月額</th><th>ボーナス</th><th>平均年齢</th></tr></thead><tbody>
${jobRows.map(([j, x]) => {
    const name = `<a href="${href(jobPath(j))}">${esc(j.name)}</a>`;
    if (!x.ok) return `<tr><th>${name}</th><td colspan="4" class="na">職員が1〜2人のため非公表</td></tr>`;
    const mk = x.minkan && x.minkan.mKyuyo > 0 && x.minkan.kyuyo > 0 ? `<tr class="mk"><td colspan="5">民間の似た仕事（${esc(x.minkan.mName)}・${x.minkan.scope === 'zenkoku' ? '全国平均' : esc(pref.name)}）：月${num(x.minkan.mKyuyo / 10, 1)}万円・平均${num(x.minkan.mAge, 1)}歳</td></tr>` : '';
    return `<tr${mk ? ' class="has-mk"' : ''}><th>${name}</th><td><b>${man(x.nenshu)}</b></td><td>${man(x.kyuyo)}</td><td>${man(x.bonus?.total > 0 ? x.bonus.total : null)}</td><td>${age(x.age)}</td></tr>${mk}`;
  }).join('\n')}
</tbody></table></div>
<p class="note">推計年収は、どの職種も平均給与月額×12か月＋期末・勤勉手当で計算しています。職員が1〜2人の職種は国の表で数字が伏せられています。いない職種は表に出していません。${jobRows.some(([, x]) => x.minkan) ? '民間の似た仕事は、国の賃金構造基本統計調査による平均（残業代などを含む月の給与。清掃職員と比べる廃棄物処理業従業員は全国平均、ほかは都道府県の平均）で、総務省が比較のために示しているものです。年齢や仕事の範囲が違うので、あくまで参考です。' : ''}</p>`;

  // ---- 初任給 ----
  const es = d.es || {};
  const sho = [['大学卒', es.sDai], ['短大卒', es.sTan], ['高校卒', es.sKou]].filter(([, v]) => v > 0);
  const shoHtml = sho.length ? `<dl class="dl dl-n">${sho.map(([l, v]) => `<div><dt>${l}</dt><dd><b>${yen(v)}</b></dd></div>`).join('')}</dl>
<p class="note">一般行政職の初任給基準額（採用されたときの給料月額。地域手当などの手当は含みません）。令和${ctx.yr.estat}年4月1日現在。${rk('shoninkyu', 'all') ? `大学卒の初任給は全国${comma(rk('shoninkyu', 'all').n)}団体の中で${comma(rk('shoninkyu', 'all').rank)}位${rk('shoninkyu', 'all').ties > 1 ? `（同じ額が${comma(rk('shoninkyu', 'all').ties)}団体）` : ''}です。` : ''}</p>` : '<p>初任給のデータがありません。</p>';

  // ---- 職員数 ----
  const t = d.teiin || {};
  const staffHtml = `<dl class="dl dl-n">
<div><dt>職員の数（全体）</dt><dd><b>${comma(t.total)}人</b><small>普通会計${comma(t.futsu)}人＋公営企業など${comma(t.kouei)}人</small></dd></div>
<div><dt>一般行政部門</dt><dd>${comma(t.ippanGyosei)}人<small>うち福祉関係${comma(t.fukushi)}人</small></dd></div>
${t.kyoiku > 0 ? `<div><dt>教育部門</dt><dd>${comma(t.kyoiku)}人</dd></div>` : ''}
${t.keisatsu > 0 ? `<div><dt>警察部門</dt><dd>${comma(t.keisatsu)}人</dd></div>` : ''}
${t.shobo > 0 ? `<div><dt>消防部門</dt><dd>${comma(t.shobo)}人</dd></div>` : ''}
<div><dt>一般行政職の職員</dt><dd>${comma(d.staff)}人<small>この人数の平均がページの年収です</small></dd></div>
${es.saiyo != null ? `<div><dt>採用・退職</dt><dd>採用${comma(es.saiyo)}人、退職${comma(es.taishokusha)}人<small>令和${ctx.yr.estat - 1}年度（全職種）</small></dd></div>` : ''}
</dl>
<p class="note">部門別の職員数は定員管理調査（令和${ctx.yr.teiin}年4月1日現在）、一般行政職の職員数と採用・退職は地方公務員給与実態調査によります。両者は数え方が違います（部門は仕事の分野、職種は給料表による分け方）。</p>`;

  // ---- 退職金 ----
  const ta = d.taishoku || {};
  const taRows = [['一般行政職', ta.gyosei], ['全職種', ta.all], ['教育公務員', ta.kyoiku], ['警察職', ta.keisatsu], ['技能労務職', ta.ginou]].filter(([, x]) => x && (x.zen > 0 || x.teinen > 0 || x.secret));
  const taHtml = taRows.length ? `<div class="tw"><table class="dt"><thead><tr><th>職種</th><th>定年退職者等の平均</th><th>全退職者の平均</th></tr></thead><tbody>
${taRows.map(([l, x]) => `<tr><th>${l}</th><td>${x.teinen > 0 ? `<b>${man(x.teinen * 1000, 0)}</b>` : x.secret ? '非公表' : '—'}</td><td>${x.zen > 0 ? man(x.zen * 1000, 0) : x.secret ? '非公表' : '—'}</td></tr>`).join('\n')}
</tbody></table></div>
<p class="note">令和${R - 1}年度に退職した職員1人あたりに支給された退職手当の平均。「定年退職者等」は定年・勧奨などによる退職で、「全退職者」は自己都合で早く辞めた人も含みます。対象が1〜2人のときは国の表で伏せられています。</p>` : '<p>令和' + (R - 1) + '年度に退職手当を受けた職員の数字がありません。</p>';

  // ---- 首長・議員 ----
  const cho = d.kubun === 1 ? '知事' : d.kubun === 2 || d.kubun === 3 ? '市長' : d.kubun === 4 ? '区長' : d.kubun === 5 ? '町長' : '村長';
  const sp = [[cho, d.shucho?.cho], [`副${cho}`, d.shucho?.fuku], ['議長', es.gicho], ['副議長', es.fukugicho], ['議員', es.giin], ['教育長', es.kyoikucho]].filter(([, v]) => v > 0);
  const spHtml = sp.length ? `<dl class="dl dl-n">${sp.map(([l, v]) => `<div><dt>${l}</dt><dd><b>${man(v, 1)}</b><small>月額</small></dd></div>`).join('')}</dl>
<p class="note">条例で決められた月額の給料（議員は報酬）で、ボーナス（期末手当）や退職手当は含みません。${rk('shucho', 'group') ? `${cho}の給料月額は、${esc(groupName)}${comma(rk('shucho', 'group').n)}団体の中で${comma(rk('shucho', 'group').rank)}位${rk('shucho', 'group').ties > 1 ? `（同じ額が${comma(rk('shucho', 'group').ties)}団体）` : ''}です。` : ''}首長・議員の額は令和${R}年4月1日現在。</p>` : '';

  // ---- 近い順位の団体 ----
  const near = (scopeList, n = 3) => {
    const i = scopeList.findIndex((x) => x.d.code === d.code);
    if (i < 0) return [];
    return scopeList.slice(Math.max(0, i - n), i + n + 1);
  };
  const nearList = (rows) => `<ol class="near">${rows.map(({ d: x, rank: r }) => `<li${x.code === d.code ? ' class="me"' : ''}><span>${comma(r)}位</span>${x.code === d.code ? `<b>${esc(placeLabel(x))}</b>` : `<a href="${href(dantaiPath(x))}">${esc(placeLabel(x))}</a>`}<em>${man(x.nenshu)}</em></li>`).join('')}</ol>`;
  const nearHtml = `<div class="minis">
${d.kubun === 1
    ? `<div class="mini"><h3>都道府県の中で</h3>${nearList(near(ctx.lists.group.get('ken')))}<p class="more"><a href="${href(rankPath(METRIC_BY_KEY.get('nenshu'), GROUPS[1]))}">都道府県のランキングを見る</a></p></div>`
    : `<div class="mini"><h3>${esc(pref.name)}の中で</h3>${nearList(near(ctx.lists.pref.get(d.pref)))}<p class="more"><a href="${href(prefPath(pref))}">${esc(pref.name)}の${comma(nPref.n)}${prefUnit(pref)}をすべて見る</a></p></div>`}
<div class="mini"><h3>全国の中で</h3>${nearList(near(ctx.lists.all))}<p class="more"><a href="${href(rankPath(METRIC_BY_KEY.get('nenshu'), GROUPS[0], Math.ceil(nAll.rank / ctx.perPage)))}">全国ランキングを見る</a></p></div>
</div>`;

  // ---- よくある質問 ----
  const faq = [
    [`${office}の職員の平均年収はいくらですか？`, `一般行政職の平均年収（推計）は${man(d.nenshu)}です。令和${R}年4月1日現在の平均給与月額${yen(g.kyuyo)}の12か月分に、令和${R - 1}年度の期末・勤勉手当（ボーナス）${yen(d.bonus)}を足して計算しています。平均年齢は${age(g.age)}です。職員一人ひとりの年収ではなく、年齢や役職の違う職員全体の平均です。`],
    [`${office}のボーナスはいくらですか？`, d.bonus ? `令和${R - 1}年度の期末・勤勉手当は、一般行政職1人あたり平均${man(d.bonus)}（期末手当${man(g.bonus.kimatsu)}、勤勉手当${man(g.bonus.kinben)}）でした。${g.bonus.months > 0 ? `基準となる支給月数は${num(g.bonus.months, 2).replace(/\.?0+$/, '')}か月分です。` : ''}` : 'データがありません。'],
    [`${office}の初任給はいくらですか？`, sho.length ? `一般行政職の初任給（給料月額）は、${sho.map(([l, v]) => `${l}${yen(v)}`).join('、')}です（令和${ctx.yr.estat}年4月1日現在。地域手当などの手当は別）。` : 'データがありません。'],
    [`${d.name}のラスパイレス指数はいくつですか？`, `令和${R}年4月1日現在で${num(d.ras, 1)}です。ラスパイレス指数は、国家公務員の給料を100としたときの水準で、職員の学歴と経験年数の構成をそろえて計算するため、平均年齢の違う団体どうしでも比べやすい指数です。`],
  ];
  if (d.taishokuTeinen) faq.push([`${office}の退職金はいくらですか？`, `令和${R - 1}年度に定年退職などで退職した一般行政職への退職手当は、1人あたり平均${man(d.taishokuTeinen, 0)}でした。`]);
  const faqHtml = faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n');
  const faqLd = { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };

  const kindLine = [d.kubun === 1 ? '' : pref.name, ruiji, `令和${R}年（${yr}年）4月1日現在`].filter(Boolean).join('｜');
  const body = `${bc.html}
<header class="ph">
<p class="eyebrow">${esc(kindLine)}</p>
<h1>${esc(office)}の年収・給料・ボーナス</h1>
<p class="lead">${esc(placeLabel(d))}の一般行政職（事務・技術の職員）の平均年収は推計<b>${man(d.nenshu)}</b>。全国${comma(nAll.n)}団体の中で${comma(nAll.rank)}位です。</p>
</header>
${kfHtml}
<p class="cn"><span>推計の式</span>平均給与月額×12か月＋期末・勤勉手当（1年分）。個人の給与ではなく、職員の平均から計算した目安です。<a href="#calc">内訳</a></p>
${small ? `<p class="warn">一般行政職の職員が${comma(d.staff)}人と少ない団体です。数人の退職や採用で平均が大きく動くことがあります。</p>` : ''}
<section class="sec"><h2>ひとことで言うと</h2><ul class="ul">${pts.map((p) => `<li>${p}</li>`).join('')}</ul></section>
<section class="sec" id="calc"><h2>年収の内訳</h2>${calc}</section>
<section class="sec"><h2>ほかの団体と比べると</h2>${cmp}</section>
${hist ? `<section class="sec"><h2>年収の推移</h2>${hist}</section>` : ''}
<section class="sec"><h2>職種別の平均</h2>${jobs}</section>
<section class="sec"><h2>初任給</h2>${shoHtml}</section>
<section class="sec"><h2>職員の数</h2>${staffHtml}</section>
<section class="sec"><h2>退職金（退職手当）</h2>${taHtml}</section>
${spHtml ? `<section class="sec"><h2>${cho}・議員の給料と報酬</h2>${spHtml}</section>` : ''}
<section class="sec"><h2>順位が近い団体</h2>${nearHtml}</section>
<section class="sec faq"><h2>よくある質問</h2>${faqHtml}</section>
${shareButtons(abs(dantaiPath(d)), `${office}の平均年収（推計）は${man(d.nenshu)}（全国${nAll.rank}位）`)}
<p class="updated">データ：令和${R}年（${yr}年）4月1日現在の国の公表値｜サイトの更新：${esc(info.built)}</p>`;

  const title = `${d.kubun === 1 ? office : `${office}（${pref.name}）`}の平均年収（推計）${man(d.nenshu)}｜給料・ボーナス・退職金【${yr}年】`;
  const description = `${placeLabel(d)}の一般行政職の平均年収（推計）は${man(d.nenshu)}、平均給与月額${man(g.kyuyo)}、ボーナス${man(d.bonus)}、平均年齢${age(g.age)}、ラスパイレス指数${num(d.ras, 1)}（令和${R}年）。全国${comma(nAll.n)}団体中${comma(nAll.rank)}位。職種別の給与・初任給・退職金・職員数も国の統計から無料で比べられます。`;
  return layout({ title, description, path: dantaiPath(d), body, ld: [bc.ld, faqLd], ogTitle: `${office}の平均年収（推計）${man(d.nenshu)}｜${SITE_NAME}` });
}
