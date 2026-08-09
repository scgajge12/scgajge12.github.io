#!/usr/bin/env bash
# ============================================================
# portfolio 共通 OGP 画像生成（home.png のみ）
#   scripts/ogp/template.html を Headless Chrome で 1200x630 に
#   レンダリングし、static/images/og/home.png に書き出す。
#   ※ 静的ゲームサイト（/games/）は独自 OGP を持つため対象外。
#
# 必要:
#   - Google Chrome (macOS 既定パス想定。CHROME 環境変数で上書き可)
#
# 使い方:
#   bash scripts/ogp/generate.sh
#
# 出力:
#   static/images/og/home.png
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TPL="file://${ROOT}/scripts/ogp/template.html"
OUT_DIR="${ROOT}/static/images/og"
mkdir -p "$OUT_DIR"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [[ ! -x "$CHROME" ]]; then
  echo "error: Google Chrome not found at: $CHROME" >&2
  echo "       Override with CHROME=/path/to/chrome bash $0" >&2
  exit 1
fi

# Chrome 一時データ用ディレクトリ（実行ごとに分離）
TMP_BASE="${TMPDIR:-/tmp}"
TMP_DATA="${TMP_BASE%/}/ogp-chrome-$$"
mkdir -p "$TMP_DATA"
trap 'rm -rf "$TMP_DATA"' EXIT

# URL エンコード (Python は環境差分があるので bash で実装)
urlencode() {
  local s="$1" out="" i c
  for ((i=0; i<${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9._~-]) out+="$c" ;;
      ' ') out+='+' ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

# 1 ページぶん生成
# 引数: out-name eyebrow title accent subtitle chips stats
render_one() {
  local name="$1" eyebrow="$2" title="$3" accent="$4" subtitle="$5" chips="$6" stats="$7"
  local url="${TPL}?eyebrow=$(urlencode "$eyebrow")&title=$(urlencode "$title")&accent=$(urlencode "$accent")&subtitle=$(urlencode "$subtitle")&chips=$(urlencode "$chips")&stats=$(urlencode "$stats")"
  local out="${OUT_DIR}/${name}.png"

  echo "==> ${name}.png"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --user-data-dir="$TMP_DATA" \
    --window-size=1200,630 \
    --virtual-time-budget=4000 \
    --default-background-color=00000000 \
    --screenshot="$out" \
    "$url" >/dev/null 2>&1

  if [[ ! -s "$out" ]]; then
    echo "  warn: empty output for ${name}.png" >&2
  fi
}

# Home: ポートフォリオ共通 OGP（名前を主役に、stats でハイライト）
render_one "home" \
  "Portfolio" \
  "Yuta Morioka / morioka12" \
  "morioka12" \
  "Security Engineer and Bug Hunter" \
  "" \
  "15+|CVEs;6th|Intigriti;2|Books;20+|Talks"

echo
echo "Done. PNG is in: ${OUT_DIR}"
ls -1 "$OUT_DIR"
