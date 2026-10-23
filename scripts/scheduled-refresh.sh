#!/usr/bin/env bash
# Windows のタスク スケジューラから週1回呼ぶ：日本の回線で最新データを取り、控えを差し替えて作り直す
# 動作確認だけするとき: bash scripts/scheduled-refresh.sh --check
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p data
LOG=data/refresh.log

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 $*"
  if ! GH_TOKEN=$(gh auth token --user mico95official-create); then
    echo "=== 失敗：gh のトークン（mico95official-create）を取れません"
    exit 1
  fi
  export GH_TOKEN
  if [ "${1:-}" = "--check" ]; then
    command -v node curl tar gh
    UA="Mozilla/5.0 (compatible; yakusho-nenshu/1.0; +https://micoficial.github.io/yakusho-nenshu/about/)"
    for u in "https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/teiin-kyuuyo02.html" "https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00200212&tstat=&cycle=0"; do
      code=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" --max-time 30 "$u")
      echo "応答 $code: $u"
    done
    gh release view data-latest -R micoficial/yakusho-nenshu --json assets --jq '.assets[] | "控え: \(.name) \(.size) \(.updatedAt)"'
    echo "=== 確認だけ（データは更新していません）"
    exit 0
  fi
  if bash scripts/refresh-data.sh; then echo "=== 完了"; else echo "=== 失敗（終了コード $?）"; fi
} >> "$LOG" 2>&1
