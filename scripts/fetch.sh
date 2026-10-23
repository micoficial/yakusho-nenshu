#!/usr/bin/env bash
# 総務省・e-Stat の公開データ（Excel）を data/raw/ に取ってくる
# 国のサイトが海外（GitHub Actions など）からのアクセスを断るときに備えて、
# 取れないときはリポジトリのリリース「data-latest」に置いた控え（raw-data.tar.gz）を使う。
# 控えの更新は日本の回線で scripts/refresh-data.sh を実行する。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data

if node scripts/fetch.mjs; then
  echo "国のサイトから取得しました"
else
  echo "国のサイトから取れなかったので、リリース data-latest の控えを使います" >&2
  rm -f data/raw-data.tar.gz
  gh release download data-latest --pattern raw-data.tar.gz --dir data --clobber
  rm -rf data/raw
  tar -xzf data/raw-data.tar.gz -C data
  rm -f data/raw-data.tar.gz
fi
test -f data/raw/manifest.json
echo "データの時点：$(node -e 'const m=require("./data/raw/manifest.json");console.log(`令和${m.reiwa}年（${m.year}年4月1日現在）、取得 ${m.fetchedAt}`)')"
