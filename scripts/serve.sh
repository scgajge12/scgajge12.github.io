#!/usr/bin/env bash
# ローカル開発サーバの起動スクリプト
# 既にPATH上にhugoがあればそれを使い、なければHugo公式リリースを
# .cache/hugo/ にダウンロードして利用する（システム改変なし）。

set -euo pipefail

# プロジェクトのルートディレクトリへ移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Hugoのバージョン（.github/workflows/gh-pages.yml の HUGO_VERSION と揃える）
# バージョンを変えるときは下の ARCHIVE_SHA256 も必ずセットで更新すること。
HUGO_VERSION="${HUGO_VERSION:-0.164.0}"
PORT="${PORT:-1313}"

# OS/Arch と、公式リリースの配布物名・期待する SHA-256 の対応付け。
# 値は公式の hugo_<version>_checksums.txt から転記する。
#
# Why not: 非 extended 版は使わない。CI（gh-pages.yml）が extended を使うため、
#   ローカルだけビルド結果が変わる余地を残さない。
# Why not: macOS を tar.gz で取らない。Hugo は macOS 版を .pkg でしか配布しておらず
#   （hugo_<ver>_darwin-universal.tar.gz は存在しない）、URL が 404 になる。
#   .pkg は sudo でインストールせず、pkgutil でペイロードだけ取り出す
#   （このスクリプトの「システム改変なし」方針を保つため）。
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS" in
  darwin)
    ARCHIVE="hugo_extended_${HUGO_VERSION}_darwin-universal.pkg"
    ARCHIVE_SHA256="618491f40cbb36a9f55d4da761c55d89f79312130f926ff7f3e1dfa83ca15eb0"
    ;;
  linux)
    UNAME_M="$(uname -m)"
    if [[ "$UNAME_M" == "x86_64" ]]; then
      ARCHIVE="hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
      ARCHIVE_SHA256="fea17b8c076f950bb2e9f9486667bdaa29422883888d509d63931c73e8a9b3a4"
    elif [[ "$UNAME_M" == "aarch64" ]] || [[ "$UNAME_M" == "arm64" ]]; then
      ARCHIVE="hugo_extended_${HUGO_VERSION}_linux-arm64.tar.gz"
      ARCHIVE_SHA256="232d3bc2d1d9510625985ff7c89767598ffea5bc6e5e2882c791313f5a43f723"
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

# ダウンロードした配布物を、スクリプトに固定した期待値と突き合わせる。
#
# Why not: リリースに同梱の checksums.txt は取りに行かない。配布物と同じ場所に
#   置かれている以上、両方まとめて差し替えられれば検証にならない。
#   期待値はリポジトリ側（＝レビュー対象の差分に残る場所）に置く。
verify_sha256() {
  local file="$1" expected="$2" actual
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$file" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  else
    echo "error: sha256sum / shasum が無いため検証できません" >&2
    return 1
  fi

  if [[ "$actual" != "$expected" ]]; then
    echo "error: checksum mismatch: ${file##*/}" >&2
    echo "  expected: $expected" >&2
    echo "  actual  : $actual" >&2
    return 1
  fi
}

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
  # 初回のみ、リリースをダウンロード → ハッシュ検証 → .cache/hugo/ に展開
  echo "Hugo が見つからないため $HUGO_VERSION をダウンロードします ..."
  URL="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${ARCHIVE}"
  WORK="$(mktemp -d -t hugo-dl.XXXXXX)"
  trap 'rm -rf "$WORK"' EXIT

  curl -fsSL --retry 3 -o "${WORK}/${ARCHIVE}" "$URL"

  echo "==> checksum を検証しています ..."
  verify_sha256 "${WORK}/${ARCHIVE}" "$ARCHIVE_SHA256"

  mkdir -p ".cache/hugo/${HUGO_VERSION}"
  if [[ "$OS" == "darwin" ]]; then
    # インストーラは実行せず、ペイロード内の hugo バイナリだけ取り出す
    pkgutil --expand-full "${WORK}/${ARCHIVE}" "${WORK}/expanded"
    PAYLOAD_BIN="$(find "${WORK}/expanded" -type f -name hugo -perm -u+x | head -1)"
    if [[ -z "$PAYLOAD_BIN" ]]; then
      echo "error: ${ARCHIVE} から hugo バイナリを取り出せませんでした" >&2
      exit 1
    fi
    cp "$PAYLOAD_BIN" "$HUGO_BIN_LOCAL"
    chmod +x "$HUGO_BIN_LOCAL"
  else
    tar -xzf "${WORK}/${ARCHIVE}" -C ".cache/hugo/${HUGO_VERSION}/" hugo
  fi

  rm -rf "$WORK"
  trap - EXIT
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
