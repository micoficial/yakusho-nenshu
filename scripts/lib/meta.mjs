// サイト全体で使う定数（都道府県・団体区分・職種・ランキングの指標）

export const SITE_NAME = '役所の年収しらべ';
export const OPERATOR = '合同会社mico';
export const OPERATOR_ID = '8250003003918';
export const CONTACT = 'mico.95.official@gmail.com';

export const SOURCES = {
  hikaku: {
    name: '地方公共団体別給与等の比較',
    org: '総務省',
    url: 'https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/teiin-kyuuyo02.html',
  },
  teiin: {
    name: '地方公共団体定員管理調査結果（団体別データ）',
    org: '総務省',
    url: 'https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/index_00005.html',
  },
  estat: {
    name: '地方公務員給与実態調査（政府統計の総合窓口 e-Stat）',
    org: '総務省',
    url: 'https://www.e-stat.go.jp/stat-search/files?toukei=00200212',
  },
};

// [コード, 名前, スラッグ]
export const PREFS = [
  ['01', '北海道', 'hokkaido'], ['02', '青森県', 'aomori'], ['03', '岩手県', 'iwate'], ['04', '宮城県', 'miyagi'],
  ['05', '秋田県', 'akita'], ['06', '山形県', 'yamagata'], ['07', '福島県', 'fukushima'], ['08', '茨城県', 'ibaraki'],
  ['09', '栃木県', 'tochigi'], ['10', '群馬県', 'gunma'], ['11', '埼玉県', 'saitama'], ['12', '千葉県', 'chiba'],
  ['13', '東京都', 'tokyo'], ['14', '神奈川県', 'kanagawa'], ['15', '新潟県', 'niigata'], ['16', '富山県', 'toyama'],
  ['17', '石川県', 'ishikawa'], ['18', '福井県', 'fukui'], ['19', '山梨県', 'yamanashi'], ['20', '長野県', 'nagano'],
  ['21', '岐阜県', 'gifu'], ['22', '静岡県', 'shizuoka'], ['23', '愛知県', 'aichi'], ['24', '三重県', 'mie'],
  ['25', '滋賀県', 'shiga'], ['26', '京都府', 'kyoto'], ['27', '大阪府', 'osaka'], ['28', '兵庫県', 'hyogo'],
  ['29', '奈良県', 'nara'], ['30', '和歌山県', 'wakayama'], ['31', '鳥取県', 'tottori'], ['32', '島根県', 'shimane'],
  ['33', '岡山県', 'okayama'], ['34', '広島県', 'hiroshima'], ['35', '山口県', 'yamaguchi'], ['36', '徳島県', 'tokushima'],
  ['37', '香川県', 'kagawa'], ['38', '愛媛県', 'ehime'], ['39', '高知県', 'kochi'], ['40', '福岡県', 'fukuoka'],
  ['41', '佐賀県', 'saga'], ['42', '長崎県', 'nagasaki'], ['43', '熊本県', 'kumamoto'], ['44', '大分県', 'oita'],
  ['45', '宮崎県', 'miyazaki'], ['46', '鹿児島県', 'kagoshima'], ['47', '沖縄県', 'okinawa'],
].map(([code, name, slug]) => ({ code: +code, name, slug, short: name === '北海道' ? '北海道' : name.replace(/[都府県]$/, '') }));
export const PREF_BY_CODE = new Map(PREFS.map((p) => [p.code, p]));
export const PREF_BY_NAME = new Map(PREFS.map((p) => [p.name, p]));

// 団体区分番号（総務省の一覧表の左端の番号）
export const KUBUN = { 1: '都道府県', 2: '指定都市', 3: '市', 4: '特別区', 5: '町', 6: '村' };

// 役所の呼び名（検索で使われる言い方に合わせる）
export function officeName(d) {
  if (d.kubun === 1) return d.name === '北海道' ? '北海道庁' : `${d.name}庁`;
  if (d.kubun === 5 || d.kubun === 6) return `${d.name}役場`;
  return `${d.name}役所`;
}

// 職種。key は読み込んだデータのキー
export const JOBS = [
  { key: 'gyosei', slug: 'gyosei', name: '一般行政職', title: '一般行政職（事務・技術の職員）', desc: '役所で事務や技術の仕事をする職員です（教員・警察官・技能労務職などを除く）。ふつう「市役所の職員」「県庁の職員」というと、この人たちを指します。このサイトの年収やランキングは、断りがなければ一般行政職の数字です。' },
  { key: 'all', slug: 'zen-shokushu', name: '全職種', desc: 'その団体で働く常勤の一般職員すべてです（一般行政職のほか、教員・警察官・消防職員・技能労務職などを含みます）。' },
  { key: 'kyoiku', slug: 'kyoin', name: '教育公務員', title: '公立学校の先生（教育公務員）', desc: '公立学校の校長・教員などです。都道府県と政令市は公立小中学校・高校の先生の多くが入ります。政令市以外の市区町村は、市立の高校や幼稚園などの先生だけです（小中学校の先生の多くは県が給与を払うので、県の数字に入ります）。' },
  { key: 'keisatsu', slug: 'keisatsu', name: '警察職', title: '警察官（警察職）', desc: '都道府県警察の警察官です（都道府県だけにあります）。' },
  { key: 'ginou', slug: 'ginou', name: '技能労務職', desc: 'ごみ収集・学校給食・用務・運転などの現業の職員の全体です。' },
  { key: 'seisou', slug: 'seisou', name: '清掃職員', ref: true, desc: 'ごみ・し尿の収集運搬車の運転手、収集作業員、処理施設で働く職員です。' },
  { key: 'kyushoku', slug: 'kyushoku', name: '学校給食員', ref: true, desc: '学校給食の調理などをする職員です。' },
  { key: 'youmu', slug: 'youmu', name: '用務員', ref: true, desc: '用務員、労務作業員など、庁舎や学校の用務・労務をする職員です。' },
  { key: 'unten', slug: 'untenshu', name: '自動車運転手', ref: true, desc: '庁用車の運転手、車庫長などです。' },
  { key: 'shuei', slug: 'shuei', name: '守衛', ref: true, desc: '守衛、巡視など、監視・警備の仕事をする職員です。' },
  { key: 'bus', slug: 'bus', name: 'バス運転手', ref: true, desc: '公営バス事業で営業用のバスを運転する職員です。' },
];
export const JOB_BY_KEY = new Map(JOBS.map((j) => [j.key, j]));

// ランキングの区分
export const GROUPS = [
  { key: 'all', slug: '', name: '全国の自治体', short: '全国', kubun: [1, 2, 3, 4, 5, 6], scope: (n) => `全国${n}自治体` },
  { key: 'ken', slug: 'todofuken', name: '都道府県', short: '都道府県', office: '県庁', kubun: [1], scope: (n) => `${n}都道府県` },
  { key: 'shi', slug: 'shi', name: '市（政令市を含む）', short: '市', office: '市役所', kubun: [2, 3], scope: (n) => `全国${n}市（政令市を含む）` },
  { key: 'seirei', slug: 'seirei', name: '政令指定都市', short: '政令市', office: '政令市', kubun: [2], scope: (n) => `政令指定都市${n}市` },
  { key: 'ku', slug: 'tokubetsuku', name: '東京23区', short: '23区', office: '区役所', kubun: [4], scope: () => '東京23区' },
  { key: 'chouson', slug: 'chouson', name: '町村', short: '町村', office: '町村役場', kubun: [5, 6], scope: (n) => `全国${n}町村` },
];

// ランキングの指標。get(d) が値（null は対象外）。desc は「高い順」
export const METRICS = [
  {
    key: 'nenshu', slug: 'nenshu', label: '推計年収', short: '年収', unit: '万円',
    title: (g) => `${g.office || '公務員'}の年収ランキング`,
    lead: '一般行政職の平均給与月額×12か月＋期末・勤勉手当（ボーナス）で計算した推計年収が高い順',
  },
  {
    key: 'ras', slug: 'laspeyres', label: 'ラスパイレス指数', short: 'ラスパイレス', unit: '',
    title: (g) => `${g.key === 'all' ? '' : `${g.short}の`}ラスパイレス指数ランキング`,
    lead: '国家公務員の給料を100としたときの水準（年齢・学歴の違いをそろえて比べた指数）が高い順',
  },
  {
    key: 'bonus', slug: 'bonus', label: 'ボーナス（期末・勤勉手当）', short: 'ボーナス', unit: '万円',
    title: (g) => `${g.office || '公務員'}のボーナスランキング`,
    lead: '一般行政職の期末・勤勉手当（1年間に支給された1人当たりの平均額）が高い順',
  },
  {
    key: 'taishoku', slug: 'taishokukin', label: '退職金（定年退職者等）', short: '退職金', unit: '万円',
    title: (g) => `${g.office || '公務員'}の退職金ランキング`,
    lead: '一般行政職の定年退職者等に支給された退職手当の平均額が高い順',
  },
  {
    key: 'shoninkyu', slug: 'shoninkyu', label: '初任給（大学卒）', short: '大卒初任給', unit: '円',
    title: (g) => `${g.office || '公務員'}の初任給ランキング`,
    lead: '一般行政職の大学卒の初任給（初任給基準額）が高い順',
  },
  {
    key: 'shucho', slug: 'shucho', label: '首長の給料月額', short: '首長の給料', unit: '万円',
    title: (g) => ({ ken: '知事の給料ランキング', shi: '市長の給料ランキング', seirei: '政令市長の給料ランキング', ku: '区長の給料ランキング', chouson: '町村長の給料ランキング' }[g.key] || '知事・市区町村長の給料ランキング'),
    lead: '知事・市区町村長の給料月額（条例で決めた額。手当・ボーナスを含まない）が高い順',
  },
];
export const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

// 職員が少ないと平均が動きやすい。一般行政職がこの人数未満なら注記する
export const SMALL_STAFF = 30;
// 長いランキングは1ページこの件数で区切る
export const PER_PAGE = 300;
