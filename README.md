# 役所の年収しらべ

全国1,788の自治体（都道府県・政令市・市・東京23区・町村）の職員の平均年収（推計）、給料、ボーナス、退職金、ラスパイレス指数、初任給、職員数、首長・議員の給料を、総務省の公表データから自治体ごとに比べられる静的サイトです。

公開先：https://micoficial.github.io/yakusho-nenshu/

## データ

| データ | 提供 | 使い方 |
|---|---|---|
| [地方公共団体別給与等の比較](https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/teiin-kyuuyo02.html)（Excel、最新年＋過去4年） | 総務省 | ラスパイレス指数・平均給与月額・手当の内訳・期末勤勉手当・退職手当・技能労務職・首長の給料・民間との比較 |
| [地方公務員給与実態調査](https://www.e-stat.go.jp/stat-search/files?toukei=00200212)（e-Stat、別冊1〜3と第7表） | 総務省 | 職員数・初任給・採用と退職の人数・議員報酬・教育長、年齢別の平均（全国） |
| [地方公共団体定員管理調査](https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/index_00005.html)（団体別データ） | 総務省 | 部門別の職員数 |

どれも公共データ利用規約（第1.0版）準拠。出典と「加工して作成」の記載が必要（全ページのフッターに入れている）。国が作成したように見せないこと。

推計年収＝一般行政職の平均給与月額（4月1日現在）×12＋期末・勤勉手当（前年度の1人あたり支給額）。寒冷地手当は含めない（団体ページに参考で出す）。新聞・雑誌（東洋経済など）の比較と同じ式で、1位〜3位（小平市・川崎市・武蔵野市）は東洋経済の令和7年版と一致した。

## 動かし方

```bash
node scripts/fetch.mjs      # データを data/raw/ に取得（約13MB・Excel 53本。日本の回線で）
node scripts/build.mjs      # dist/ に約2,000ページを生成（10秒ほど）
node scripts/serve.mjs      # http://localhost:4178/yakusho-nenshu/ で確認
```

- `LIMIT=50 node scripts/build.mjs` で団体ページを50件だけ作れる（試すとき用）
- `node scripts/check-load.mjs [団体コード]` で読み込んだ値を確かめられる
- `node scripts/inspect.mjs [ファイル名の一部]` で Excel の列の見出しを一覧できる（総務省が様式を変えたときの調べ用）

## 仕組み

- `scripts/fetch.mjs`：総務省のページ（給与等の比較・定員管理調査）と e-Stat のファイル一覧を読んで、Excel の URL を見つけて取る。最新の年はページの「令和◯年のラスパイレス指数」から読む。e-Stat の詳しい表は総務省の公表（12月）より半年ほど遅れるので、まだなければ前の年を使う
- `scripts/lib/xlsx.mjs`：依存なしの xlsx 読み取り（ZIP を開いて XML を読む）
- `scripts/lib/table.mjs`：見出しの文字で列を探す。団体コードは検査数字で見分ける（6桁の給料と区別するため）
- `scripts/lib/load.mjs`：全ファイルを団体コードでまとめる。団体の数（47・20・1,721）が合わない、列がない、などのときは止まる
- `scripts/pages/`：団体ページ（`dantai.mjs`）、トップ・ランキング・都道府県・職種別・年齢別など（`hubs.mjs`）
- `.github/workflows/deploy.yml`：push と毎週月曜3:30（日本時間）に作り直して GitHub Pages に出す。`data/summary.json` を毎回コミットするので、定期実行が60日で止まることもない
- 国のサイトに海外から入れないときに備えて、リリース `data-latest` の控え（`raw-data.tar.gz`）を使う（`scripts/fetch.sh`）。控えは日本の回線で `GH_TOKEN=... bash scripts/refresh-data.sh` を実行すると差し替わり、作り直しも始まる。このPCではタスク スケジューラ（mico-yakusho-nenshu-data-refresh）が毎週月曜9:15に `scripts/scheduled-refresh.sh` 経由で実行する

## 注意

- 年収は推計。個人の給与ではない。平均は職員の年齢構成で上下する（ランキングに平均年齢を並べ、年齢をそろえた比較はラスパイレス指数を案内）
- 令和5年は5年に1度の基幹統計調査の年で、全国平均でも手当が前後の年より高い（推移の表に注記）
- 技能労務職の「民間の似た仕事」は、清掃職員だけ全国平均、ほかは都道府県の平均（総務省の表の注記どおり。値が全部同じなら全国平均と判定）
- 対象職員が1〜2人の欄は国の表で「＊」（非公表）
