#!/usr/bin/env python3
"""Hugoテンプレートを経由しない静的HTML（public/games配下など）に Google Analytics の gtag.js を注入する。

CI のビルド完了後・デプロイ前に実行することを想定。
- 既に gtag が含まれているファイルはスキップ（冪等）
- `</head>` がない HTML はスキップ
- GA測定IDは引数 or 環境変数 GA_MEASUREMENT_ID から受け取る
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

# gtag.js 検出用のマーカー（重複注入を防ぐため）
GTAG_MARKER = "googletagmanager.com/gtag/js"

# `</head>` を見つけるための正規表現（前方の空白も拾う）
HEAD_CLOSE_RE = re.compile(r"([ \t]*)</head>", re.IGNORECASE)


def build_snippet(measurement_id: str) -> str:
  """gtag.js スニペットを生成する。"""
  return (
    f'    <!-- Google tag (gtag.js) -->\n'
    f'    <script async src="https://www.googletagmanager.com/gtag/js?id={measurement_id}"></script>\n'
    f'    <script>\n'
    f'      window.dataLayer = window.dataLayer || [];\n'
    f'      function gtag(){{dataLayer.push(arguments);}}\n'
    f"      gtag('js', new Date());\n"
    f"      gtag('config', '{measurement_id}');\n"
    f'    </script>\n'
  )


def inject(path: Path, snippet: str) -> str:
  """単一HTMLへ注入する。戻り値は "injected" / "skipped-existing" / "skipped-no-head"。"""
  html = path.read_text(encoding="utf-8")

  # 既にgtagが含まれていれば何もしない
  if GTAG_MARKER in html:
    return "skipped-existing"

  match = HEAD_CLOSE_RE.search(html)
  if not match:
    return "skipped-no-head"

  # `</head>` の直前にスニペットを差し込む（インデントは既存と揃える）
  insert_at = match.start()
  new_html = html[:insert_at] + snippet + html[insert_at:]
  path.write_text(new_html, encoding="utf-8")
  return "injected"


def main() -> int:
  parser = argparse.ArgumentParser(description="Inject GA gtag.js into static HTML files.")
  parser.add_argument("target_dir", help="HTMLを再帰的に探索する対象ディレクトリ（例: public/games）")
  parser.add_argument(
    "--measurement-id",
    default=os.environ.get("GA_MEASUREMENT_ID"),
    help="GA4測定ID（未指定時は環境変数 GA_MEASUREMENT_ID を使用）",
  )
  args = parser.parse_args()

  if not args.measurement_id:
    print("error: GA measurement id is required (--measurement-id or GA_MEASUREMENT_ID)", file=sys.stderr)
    return 2

  target = Path(args.target_dir)
  if not target.is_dir():
    print(f"error: not a directory: {target}", file=sys.stderr)
    return 2

  snippet = build_snippet(args.measurement_id)

  counts = {"injected": 0, "skipped-existing": 0, "skipped-no-head": 0}
  for html_file in sorted(target.rglob("*.html")):
    status = inject(html_file, snippet)
    counts[status] += 1
    if status == "injected":
      print(f"  injected: {html_file}")
    elif status == "skipped-no-head":
      print(f"  warning: no </head> tag in {html_file}", file=sys.stderr)

  print(
    f"GA injection summary: injected={counts['injected']} "
    f"already-had-gtag={counts['skipped-existing']} "
    f"no-head={counts['skipped-no-head']}"
  )
  return 0


if __name__ == "__main__":
  sys.exit(main())
