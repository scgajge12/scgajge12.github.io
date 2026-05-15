#!/usr/bin/env python3
"""
ポスト記事のタグを統一された分類体系に再付与する。

最終タグ体系（9つ、整理済み）:
  - bugbounty  : バグバウンティ全般
  - security   : セキュリティ（bugbounty以外のセキュリティ文脈）
  - cloud      : クラウド / AWS
  - web        : Webセキュリティ（XSS, JWT等）
  - ctf        : CTF / HTB
  - event      : イベント参加・レポート
  - interview  : インタビュー記事
  - slide      : スライド資料
  - career     : キャリア・就活・年振り返り

ルール:
  - bugbounty に security は付けない（暗黙的に含まれるため）
  - 各記事は通常 1-3 タグ
  - 削除: "blog"（情報量ゼロ）, "book"（1件のみ）, "htb"（1件のみ→ctf）
"""

from __future__ import annotations
import re
import sys
from pathlib import Path

POSTS_DIR = Path(__file__).resolve().parent.parent / "content" / "posts"

# ファイル名 → 新しいタグリスト
TAG_MAP: dict[str, list[str]] = {
    # 年次振り返り
    "2022_year.md": ["career", "bugbounty"],
    "2023_year.md": ["career", "bugbounty"],
    "2024_year.md": ["career", "bugbounty"],
    "2025_year.md": ["career", "bugbounty"],
    "2024_bbjppodcast.md": ["bugbounty"],

    # キャリア・コミュニティ
    "aws_community_builder.md": ["cloud", "career"],
    "bbjp_podcast.md": ["bugbounty"],
    "ipfactory_books_2022.md": ["career"],
    "student_blog_best_5.md": ["career"],
    "student_cve.md": ["bugbounty", "career"],
    "student_security_engineer_job.md": ["career"],
    "securityengineer_job_bugbounty.md": ["bugbounty", "career"],
    "intigriti_q1_2024.md": ["bugbounty", "career"],
    "bugbountyhunter_type.md": ["bugbounty", "career"],
    "bugbountyhunter.md": ["bugbounty", "career"],

    # バグバウンティ系
    "bugbounty.md": ["bugbounty"],
    "bughunt.md": ["bugbounty"],
    "bbjp_podcast.md": ["bugbounty"],
    "browser_extensions_10.md": ["bugbounty"],
    "burp_extensions_10.md": ["bugbounty"],
    "bugbounty_tools.md": ["bugbounty"],
    "bugbounty_video.md": ["bugbounty"],
    "bugbounty_llm.md": ["bugbounty"],
    "bugbounty_mobile.md": ["bugbounty"],
    "bugbounty_reports_2024.md": ["bugbounty"],
    "bugbounty_reports_2025.md": ["bugbounty"],
    "hacktivity_votes_2023.md": ["bugbounty"],
    "caido.md": ["bugbounty"],
    "oss_bughunt.md": ["bugbounty"],
    "supplychain_bughunter.md": ["bugbounty"],

    # バグバウンティ x Web
    "bugbounty_js_analyze.md": ["bugbounty", "web"],
    "bugbounty_js_monitoring.md": ["bugbounty", "web"],
    "bugbounty_web_critical.md": ["bugbounty", "web"],
    "bugbounty_xss_escalation.md": ["bugbounty", "web"],

    # Web セキュリティ（バグバウンティ寄りでない）
    "jwt_security.md": ["web", "security"],
    "jwt_security_2026.md": ["web", "security"],

    # クラウドセキュリティ
    "bedrock_security.md": ["cloud", "security"],
    "ec2_security_ssrf.md": ["cloud", "security"],
    "lambda_and_serverless_security.md": ["cloud", "security"],
    "lambda_library_security.md": ["cloud", "security"],
    "offensive_cloud_security.md": ["cloud", "security"],
    "phishing_aws_mfa.md": ["cloud", "security"],
    "s3_security.md": ["cloud", "security"],

    # クラウド x CTF
    "ctf_cloud_2021.md": ["cloud", "ctf"],
    "ctf_cloud_2022.md": ["cloud", "ctf"],
    "ctf_cloud_2023.md": ["cloud", "ctf"],
    "htb_cloud.md": ["cloud", "ctf"],

    # スライド
    "bugbounty_practical.md": ["bugbounty", "slide"],
    "p3nfest_2025_winter_bugbounty.md": ["bugbounty", "slide"],
    "software_supply_chain.md": ["bugbounty", "slide"],
    "isc2_cloud.md": ["cloud", "security", "slide"],
    "jaws_lambda.md": ["cloud", "security", "slide"],
    "jaws_pankration_2024.md": ["cloud", "security", "slide"],
    "jaws_serverside.md": ["cloud", "security", "slide"],

    # イベント
    "code_blue.md": ["event"],
    "seccon.md": ["event"],
    "review_sechack365.md": ["event"],
    "sechack365_return.md": ["event"],
    "securitycamp2022b_tutor.md": ["event"],
    "jaws_days_2024_speaker.md": ["cloud", "event"],
    "nahamcon_2024.md": ["bugbounty", "event"],
    "bug_bounty_village_2024.md": ["bugbounty", "event"],
    "p3nfest_2024_summer_bugbounty.md": ["bugbounty", "event"],
    "p3nfest_2026_spring.md": ["bugbounty", "event"],
    "secjaws30_ctf.md": ["cloud", "ctf", "event"],

    # インタビュー
    "bugbounty_interview_levtech.md": ["bugbounty", "interview"],
    "interview_bughunter.md": ["bugbounty", "interview"],
    "bughunter_interview_11.md": ["bugbounty", "interview"],
    "sec_wakate_interview.md": ["interview", "career"],
    "mbsd_interview.md": ["event", "interview"],
    "sechack365_interview.md": ["event", "interview"],
}


def format_tag_line(tags: list[str]) -> str:
    """tagsをHugo front matterで使う形式に整形する"""
    quoted = [f'"{t}"' for t in tags]
    return f'tags: [{", ".join(quoted)}]'


def update_file(path: Path, new_tags: list[str]) -> bool:
    """単一の記事のtags行を新しい値に置き換える。
    変更があればTrueを返す。"""
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^tags:\s*\[.*\]\s*$", re.MULTILINE)
    new_line = format_tag_line(new_tags)
    if not pattern.search(text):
        print(f"[warn] {path.name}: tags行が見つからない", file=sys.stderr)
        return False
    new_text = pattern.sub(new_line, text, count=1)
    if new_text == text:
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def main() -> int:
    if not POSTS_DIR.exists():
        print(f"error: posts dir not found: {POSTS_DIR}", file=sys.stderr)
        return 1

    changed = 0
    skipped = 0
    missing_in_map: list[str] = []

    # マップに無い記事をリストアップ（template.md以外）
    for path in sorted(POSTS_DIR.glob("*.md")):
        name = path.name
        if name == "template.md":
            continue
        if name not in TAG_MAP:
            missing_in_map.append(name)
            continue
        if update_file(path, TAG_MAP[name]):
            changed += 1
        else:
            skipped += 1

    if missing_in_map:
        print("error: 以下の記事がTAG_MAPに登録されていません:", file=sys.stderr)
        for n in missing_in_map:
            print(f"  - {n}", file=sys.stderr)
        return 1

    print(f"更新: {changed}件 / 変更なし: {skipped}件 / 登録漏れ: {len(missing_in_map)}件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
