#!/usr/bin/env bash
# ============================================================
# portfolio 共通 OGP 画像生成（home.svg → home.png）
#
#   デザインの唯一の定義元は scripts/ogp/gen_svg.mjs。
#   本スクリプトは
#     1) gen_svg.mjs で static/images/og/home.svg を生成
#     2) その SVG を 1200x630 の PNG にラスタライズ
#   の2段で home.png まで一気に更新する。
#
#   OGP として配信するのは home.png（SVG は X / Facebook 等が
#   og:image として解釈しないため）。SVG は中間生成物兼デザイン確認用。
#
#   ※ 静的ゲームサイト（/games/）は独自 OGP を持つため対象外。
#
# Why not: 以前は Canvas 版 gen_png.html をブラウザで手動実行して
#   PNG を保存していたが、デザイン定義が SVG 側と二重化し、
#   PNG だけ更新漏れで陳腐化した。定義元を gen_svg.mjs 1本に絞り、
#   PNG はそこから機械的に導出する形へ変更した。
#
# 必要:
#   - Node.js
#   - Google Chrome（CHROME 環境変数でパス上書き可）
#     もしくは npx が使える環境（@resvg/resvg-js にフォールバック）
#     ※ フォールバックで取得する npm パッケージは RESVG_VERSION で版を固定する
#
# 使い方:
#   bash scripts/ogp/generate.sh
#
# 出力:
#   static/images/og/home.svg
#   static/images/og/home.png
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${ROOT}/static/images/og"
SVG="${OUT_DIR}/home.svg"
PNG="${OUT_DIR}/home.png"
WIDTH=1200
HEIGHT=630

# SVG→PNG フォールバックで使う npm パッケージのバージョン（固定）
RESVG_VERSION="2.6.2"

command -v node >/dev/null 2>&1 || { echo "error: node not found" >&2; exit 1; }

echo "==> home.svg"
node "${ROOT}/scripts/ogp/gen_svg.mjs"
[[ -s "$SVG" ]] || { echo "error: ${SVG} was not generated" >&2; exit 1; }

# ------------------------------------------------------------
# SVG → PNG
# ------------------------------------------------------------
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

rasterize_with_chrome() {
  local work
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' RETURN
  # SVG を余白ゼロの HTML に埋めてスクリーンショットを撮る
  {
    printf '<!doctype html><meta charset="utf-8">'
    printf '<style>html,body{margin:0;padding:0;background:#0b1622}svg{display:block}</style>'
    cat "$SVG"
  } > "${work}/wrap.html"

  "$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
    --hide-scrollbars --force-device-scale-factor=1 \
    --user-data-dir="${work}/profile" \
    --window-size="${WIDTH},${HEIGHT}" \
    --screenshot="${work}/home.png" \
    "file://${work}/wrap.html" >/dev/null 2>&1

  [[ -s "${work}/home.png" ]] || return 1
  mv "${work}/home.png" "$PNG"
}

rasterize_with_resvg() {
  local work
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' RETURN
  cat > "${work}/render.mjs" <<'MJS'
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
const [ , , src, dst, width ] = process.argv;
const r = new Resvg(readFileSync(src, 'utf8'), {
  fitTo: { mode: 'width', value: Number(width) },
  font: { loadSystemFonts: true },
  background: '#0b1622',
});
writeFileSync(dst, r.render().asPng());
MJS
  # Why not: `npx --yes --package @resvg/resvg-js`（バージョン無指定）は使わない。
  #   実行のたびに最新版を取りに行くため、npm 側で乗っ取り・依存混同が起きた場合に
  #   そのまま開発機でのコード実行になる。版を固定して取得対象を確定させる。
  # Why not: npm_config_ignore_scripts も併せて有効にし、postinstall 等の
  #   インストールスクリプトは走らせない。resvg-js のネイティブバイナリは
  #   optionalDependencies によるプラットフォーム別解決なので、これで動作する。
  (
    cd "$work" &&
      npm_config_ignore_scripts=true \
        npx --yes --package "@resvg/resvg-js@${RESVG_VERSION}" -- \
        node render.mjs "$SVG" "${work}/home.png" "$WIDTH"
  ) >/dev/null 2>&1
  [[ -s "${work}/home.png" ]] || return 1
  mv "${work}/home.png" "$PNG"
}

echo "==> home.png"
if [[ -x "$CHROME" ]] && rasterize_with_chrome; then
  echo "    rasterized with Google Chrome"
elif command -v npx >/dev/null 2>&1 && rasterize_with_resvg; then
  echo "    rasterized with @resvg/resvg-js@${RESVG_VERSION}"
else
  echo "error: could not rasterize ${SVG}" >&2
  echo "       Google Chrome を入れるか、CHROME=/path/to/chrome を指定してください" >&2
  exit 1
fi

echo "done:"
echo "  ${SVG}"
echo "  ${PNG}"
