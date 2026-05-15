#!/usr/bin/env bash
# ローカル開発サーバの起動スクリプト
# 既にPATH上にhugoがあればそれを使い、なければHugo公式リリースを
# .cache/hugo/ にダウンロードして利用する（システム改変なし）。

set -euo pipefail

# プロジェクトのルートディレクトリへ移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Hugoのバージョン（CIと揃えるなら 0.110.0、本スクリプトでは新版を使用）
HUGO_VERSION="${HUGO_VERSION:-0.151.0}"
PORT="${PORT:-1313}"

# OS/Arch 判定（darwin universal / linux amd64）
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS" in
  darwin)
    ARCHIVE="hugo_${HUGO_VERSION}_darwin-universal.tar.gz"
    ;;
  linux)
    UNAME_M="$(uname -m)"
    if [[ "$UNAME_M" == "x86_64" ]]; then
      ARCHIVE="hugo_${HUGO_VERSION}_linux-amd64.tar.gz"
    elif [[ "$UNAME_M" == "aarch64" ]] || [[ "$UNAME_M" == "arm64" ]]; then
      ARCHIVE="hugo_${HUGO_VERSION}_linux-arm64.tar.gz"
    else
      echo "error: unsupported linux arch: $UNAME_M" >&2
      exit 1
    fi
    ;;
  *)
    echo "error: unsupported OS: $OS" >&2
    exit 1
    ;;
esac

# Hugoバイナリの解決順位:
# 1. 環境変数 HUGO_BIN
# 2. PATH 上の hugo
# 3. .cache/hugo/<version>/hugo
HUGO_BIN_LOCAL=".cache/hugo/${HUGO_VERSION}/hugo"

if [[ -n "${HUGO_BIN:-}" ]] && [[ -x "$HUGO_BIN" ]]; then
  RESOLVED_HUGO="$HUGO_BIN"
elif command -v hugo >/dev/null 2>&1; then
  RESOLVED_HUGO="$(command -v hugo)"
elif [[ -x "$HUGO_BIN_LOCAL" ]]; then
  RESOLVED_HUGO="$HUGO_BIN_LOCAL"
else
  # 初回のみ、リリースをダウンロードして .cache/hugo/ に展開
  echo "Hugo が見つからないため $HUGO_VERSION をダウンロードします ..."
  mkdir -p ".cache/hugo/${HUGO_VERSION}"
  URL="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${ARCHIVE}"
  TMP="$(mktemp -t hugo-dl.XXXXXX)"
  curl -fsSL -o "$TMP" "$URL"
  tar -xzf "$TMP" -C ".cache/hugo/${HUGO_VERSION}/" hugo
  rm -f "$TMP"
  RESOLVED_HUGO="$HUGO_BIN_LOCAL"
fi

echo "Using Hugo: $RESOLVED_HUGO ($($RESOLVED_HUGO version | head -1))"
echo "Serving on http://127.0.0.1:${PORT}/  (Ctrl+C で停止)"
echo ""

exec "$RESOLVED_HUGO" server \
  --port "$PORT" \
  --bind 127.0.0.1 \
  --buildDrafts \
  --disableFastRender
