#!/usr/bin/env bash
# 日本の回線で最新データを取り、リリース「data-latest」の控え（raw-data.tar.gz）を差し替えて、サイトを作り直す
# 使い方: GH_TOKEN=<micoficial に書き込めるトークン> bash scripts/refresh-data.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="micoficial/yakusho-nenshu"
# 控えは国のサイトから直接取れたときだけ差し替える（fetch.sh のように控えへは切り替えない）
node scripts/fetch.mjs
rm -f data/raw-data.tar.gz
tar -czf data/raw-data.tar.gz -C data raw
ls -la data/raw-data.tar.gz
if ! gh release view data-latest -R "$REPO" > /dev/null 2>&1; then
  gh release create data-latest -R "$REPO" --title "最新の公開データ（控え）" --notes-file scripts/release-notes.md
fi
gh release upload data-latest data/raw-data.tar.gz -R "$REPO" --clobber
rm -f data/raw-data.tar.gz
gh workflow run deploy.yml -R "$REPO" --ref main
echo "控えを更新し、作り直しを始めました"
