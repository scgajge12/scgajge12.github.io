#!/usr/bin/env node
// スコア別／ランク別シェアランディングページを生成するスクリプト。
//
// 出力:
//   static/games/<game-slug>/share/<key>/index.html
//
// 各ページは:
//   - スコア／ランク固有の og:image / twitter:image を持つ（X クローラ用）
//   - 人間が訪問した際は結果サマリと「クイズに挑戦」CTA を表示
//   - 何もしなくても 4 秒後に元のゲームページへリダイレクト
//
// 使い方:
//   node scripts/gen_share_pages.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const GAMES_DIR = join(REPO_ROOT, "static", "games");
const SITE_ORIGIN = "https://scgajge12.github.io";

// クイズ系：0..total の 11 段階
const SCORE_GAMES = [
  {
    slug: "bug-bounty-top-10-quiz",
    titleJa: "バグバウンティ脆弱性ランキング・クイズ",
    titleEn: "Bug Bounty Top 10 Quiz",
    total: 10,
  },
  {
    slug: "claude-bug-bounty",
    titleJa: "Claude Bug Bounty 機能クイズ",
    titleEn: "Claude Bug Bounty Capability Quiz",
    total: 10,
  },
];

// ランク系：固定数のランクごと
const RANK_GAMES = [
  {
    slug: "kaiten-bounty",
    titleJa: "Sushi Bounty（回転寿司バウンティ）",
    titleEn: "Sushi Bounty — Kaiten Bug Bounty Arcade",
    ranks: [
      {
        key: "shirouto",
        labelJa: "素人客",
        labelEn: "Newcomer",
        tagJa: "★ SHIROUTO",
        tagEn: "★ SHIROUTO",
        copyJa: "ここからが伸びしろ。",
        copyEn: "Plenty of room to grow.",
        accent: "#f97316",
      },
      {
        key: "joren",
        labelJa: "常連",
        labelEn: "Regular",
        tagJa: "★ JOREN",
        tagEn: "★ JOREN",
        copyJa: "感覚は掴めてきた。次は速度を。",
        copyEn: "You feel the rhythm — push speed next.",
        accent: "#fbbf24",
      },
      {
        key: "itamae",
        labelJa: "板前見習い",
        labelEn: "Apprentice Itamae",
        tagJa: "★ ITAMAE",
        tagEn: "★ ITAMAE",
        copyJa: "基礎は固まりつつ、応用に挑む段階。",
        copyEn: "Fundamentals are landing — onto the harder stuff.",
        accent: "#fbbf24",
      },
      {
        key: "taisho",
        labelJa: "大将",
        labelEn: "Taisho (Master)",
        tagJa: "★ TAISHO",
        tagEn: "★ TAISHO",
        copyJa: "板場を任せても安心の腕前。",
        copyEn: "You can run the kitchen.",
        accent: "#22d3ee",
      },
      {
        key: "legendary",
        labelJa: "伝説のバグハンター",
        labelEn: "Legendary Hunter",
        tagJa: "★ LEGENDARY HUNTER",
        tagEn: "★ LEGENDARY HUNTER",
        copyJa: "回転寿司を一周する前にレーンが折れます。",
        copyEn: "The belt gives up before you do.",
        accent: "#22d3ee",
      },
    ],
  },
  {
    slug: "bug-kanji",
    titleJa: "Bug Kanji（バグ漢字クイズ）",
    titleEn: "Bug Kanji — Vulnerability Kanji Quiz",
    ranks: [
      {
        key: "c",
        labelJa: "Cランク・ルーキー",
        labelEn: "C Rank · Rookie",
        tagJa: "★ C RANK · ROOKIE",
        tagEn: "★ C RANK · ROOKIE",
        copyJa: "ここから伸びる時期です。",
        copyEn: "Plenty of room to grow.",
        accent: "#f97316",
      },
      {
        key: "b",
        labelJa: "Bランク・ジュニア",
        labelEn: "B Rank · Junior Hunter",
        tagJa: "★ B RANK · JUNIOR HUNTER",
        tagEn: "★ B RANK · JUNIOR HUNTER",
        copyJa: "基礎は固まりつつあります。",
        copyEn: "Solid foundation in place.",
        accent: "#fbbf24",
      },
      {
        key: "a",
        labelJa: "Aランク・シニア",
        labelEn: "A Rank · Senior Hunter",
        tagJa: "★ A RANK · SENIOR HUNTER",
        tagEn: "★ A RANK · SENIOR HUNTER",
        copyJa: "業界の主要脆弱性は確実に押さえています。",
        copyEn: "You've got the major vuln classes locked down.",
        accent: "#fbbf24",
      },
      {
        key: "s",
        labelJa: "Sランク・エリート",
        labelEn: "S Rank · Elite Hunter",
        tagJa: "★ S RANK · ELITE HUNTER",
        tagEn: "★ S RANK · ELITE HUNTER",
        copyJa: "脆弱性を漢字で見抜く達人。",
        copyEn: "A master at reading vulnerabilities through kanji.",
        accent: "#22d3ee",
      },
    ],
  },
  // トリアージ・シミュレーションは BBR-Review 100 点法に準拠して
  // 5 つの readiness band（Submit-ready / Almost / Needs work /
  // Major rewrite / Do not submit）を使う。
  {
    slug: "triage-sim",
    titleJa: "トリアージ・シミュレーション",
    titleEn: "Bug Bounty Triage Simulator",
    ranks: [
      {
        key: "do-not-submit",
        labelJa: "Do not submit",
        labelEn: "Do not submit",
        tagJa: "★ DO NOT SUBMIT",
        tagEn: "★ DO NOT SUBMIT",
        copyJa: "BBR-Review 0–39。提出は控え、まず 13 軸を読み直す段階。",
        copyEn: "BBR-Review 0–39. Don't submit — re-read the 13-axis frame first.",
        accent: "#fb7185",
      },
      {
        key: "major-rewrite",
        labelJa: "Major rewrite",
        labelEn: "Major rewrite",
        tagJa: "★ MAJOR REWRITE",
        tagEn: "★ MAJOR REWRITE",
        copyJa: "BBR-Review 40–59。構造から書き直し。Informative リスクあり。",
        copyEn: "BBR-Review 40–59. Heavy rewrite needed; risk of Informative closure.",
        accent: "#f97316",
      },
      {
        key: "needs-work",
        labelJa: "Needs work",
        labelEn: "Needs work",
        tagJa: "★ NEEDS WORK",
        tagEn: "★ NEEDS WORK",
        copyJa: "BBR-Review 60–74。トリアージから 1〜2 ラウンド質問が来る水準。",
        copyEn: "BBR-Review 60–74. Expect 1–2 rounds of triage questions.",
        accent: "#fbbf24",
      },
      {
        key: "almost-ready",
        labelJa: "Almost ready",
        labelEn: "Almost ready",
        tagJa: "★ ALMOST READY",
        tagEn: "★ ALMOST READY",
        copyJa: "BBR-Review 75–89。微修正で提出可。",
        copyEn: "BBR-Review 75–89. Minor revisions away from submission.",
        accent: "#fbbf24",
      },
      {
        key: "submit-ready",
        labelJa: "Submit-ready",
        labelEn: "Submit-ready",
        tagJa: "★ SUBMIT-READY",
        tagEn: "★ SUBMIT-READY",
        copyJa: "BBR-Review 90–100。即提出可能なクオリティ。13 軸を読みこなしている。",
        copyEn: "BBR-Review 90–100. Ships straight to triage; you read all 13 axes fluently.",
        accent: "#22d3ee",
      },
    ],
  },
  // Bonsai Recon（偵察盆栽）：100 点法 5 ランク（種〜達人）
  {
    slug: "bonsai-recon",
    titleJa: "Bonsai Recon（偵察盆栽）",
    titleEn: "Bonsai Recon — Prune Recon Output to Hot Leads",
    ranks: [
      {
        key: "seed",
        labelJa: "種：もう一度",
        labelEn: "Bonsai Seed",
        tagJa: "★ BONSAI SEED",
        tagEn: "★ BONSAI SEED",
        copyJa: "40 点未満。ホットリードを切ったか、ノイズを溜め込んだか — 種から再挑戦。",
        copyEn: "Under 40. You cut a hot lead or hoarded noise. Start over from seed.",
        accent: "#fb7185",
      },
      {
        key: "novice",
        labelJa: "種から学ぶ",
        labelEn: "Bonsai Novice",
        tagJa: "★ BONSAI NOVICE",
        tagEn: "★ BONSAI NOVICE",
        copyJa: "40+ 点。まずは「絶対に切らない」リストを固める段階。",
        copyEn: "40+. Lock in your never-cut list first.",
        accent: "#f97316",
      },
      {
        key: "apprentice",
        labelJa: "剪定見習い",
        labelEn: "Bonsai Apprentice",
        tagJa: "★ BONSAI APPRENTICE",
        tagEn: "★ BONSAI APPRENTICE",
        copyJa: "60+ 点。recon の輪郭は見えてきた段階。",
        copyEn: "60+. The shape of recon is starting to show.",
        accent: "#fbbf24",
      },
      {
        key: "master",
        labelJa: "剪定上手",
        labelEn: "Bonsai Master",
        tagJa: "★ BONSAI MASTER",
        tagEn: "★ BONSAI MASTER",
        copyJa: "75+ 点。recon ノイズの 8 割は反射で切れる段階。",
        copyEn: "75+. You reflexively prune ~80% of recon noise.",
        accent: "#22d3ee",
      },
      {
        key: "sensei",
        labelJa: "盆栽の達人",
        labelEn: "Bonsai Sensei",
        tagJa: "★ BONSAI SENSEI",
        tagEn: "★ BONSAI SENSEI",
        copyJa: "90+ 点。recon の信号雑音比を本能で見抜ける達人。",
        copyEn: "90+. You read signal vs. noise on instinct.",
        accent: "#22d3ee",
      },
    ],
  },
  // Caido 忍者道場：スコアレンジに応じて 6 帯（白〜影忍）
  {
    slug: "caido-ninja",
    titleJa: "Caido 忍者道場",
    titleEn: "Caido Ninja Dojo",
    ranks: [
      {
        key: "white",
        labelJa: "白帯",
        labelEn: "White Belt",
        tagJa: "★ WHITE BELT",
        tagEn: "★ WHITE BELT",
        copyJa: "スコア 0〜299。まずは巻物の流れを掴む段階。",
        copyEn: "Score 0–299. Warming up — get the flow of the scrolls.",
        accent: "#f97316",
      },
      {
        key: "yellow",
        labelJa: "黄帯",
        labelEn: "Yellow Belt",
        tagJa: "★ YELLOW BELT",
        tagEn: "★ YELLOW BELT",
        copyJa: "スコア 300〜799。Replay と Automate の境界が見え始めた。",
        copyEn: "Score 300–799. The Replay-vs-Automate line is starting to click.",
        accent: "#fbbf24",
      },
      {
        key: "purple",
        labelJa: "紫帯",
        labelEn: "Purple Belt",
        tagJa: "★ PURPLE BELT",
        tagEn: "★ PURPLE BELT",
        copyJa: "スコア 800〜1,499。5 忍術の使い分けがほぼ即答できる。",
        copyEn: "Score 800–1,499. You can pick the right jutsu on reflex.",
        accent: "#fbbf24",
      },
      {
        key: "black",
        labelJa: "黒帯",
        labelEn: "Black Belt",
        tagJa: "★ BLACK BELT",
        tagEn: "★ BLACK BELT",
        copyJa: "スコア 1,500〜2,499。Match & Replace と Workflows の役割分担まで完璧。",
        copyEn: "Score 1,500–2,499. You separate Match & Replace from Workflows cleanly.",
        accent: "#22d3ee",
      },
      {
        key: "master",
        labelJa: "師範",
        labelEn: "Master",
        tagJa: "★ MASTER",
        tagEn: "★ MASTER",
        copyJa: "スコア 2,500〜3,999。道場を任せても安心な腕前。実戦投入レベル。",
        copyEn: "Score 2,500–3,999. Battle-ready — you can run the dojo.",
        accent: "#22d3ee",
      },
      {
        key: "elite",
        labelJa: "影忍",
        labelEn: "Shadow Ninja",
        tagJa: "★ SHADOW NINJA",
        tagEn: "★ SHADOW NINJA",
        copyJa: "スコア 4,000 以上。Caido の言語で世界を見る達人。",
        copyEn: "Score 4,000+. You see the world in Caido's vocabulary.",
        accent: "#22d3ee",
      },
    ],
  },
];

// スコア → 称号
function scoreRank(score, total) {
  const pct = (score / total) * 100;
  if (pct === 100) return { ja: "PERFECT！全問正解", en: "PERFECT — flawless run" };
  if (pct >= 80) return { ja: "EXCELLENT", en: "EXCELLENT" };
  if (pct >= 60) return { ja: "GOOD JOB", en: "GOOD JOB" };
  if (pct >= 40) return { ja: "もう一歩！", en: "ALMOST THERE" };
  if (pct >= 20) return { ja: "まずは挑戦", en: "WARMING UP" };
  return { ja: "リトライしよう", en: "TRY AGAIN" };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// クイズ（スコア）系の HTML 1ページ
function buildScoreHtml(game, score) {
  const total = game.total;
  const pct = Math.round((score / total) * 100);
  const r = scoreRank(score, total);
  const accent = pct >= 80 ? "#22d3ee" : pct >= 50 ? "#fbbf24" : "#f97316";
  const quizUrl = `${SITE_ORIGIN}/games/${game.slug}/`;
  const shareUrl = `${SITE_ORIGIN}/games/${game.slug}/share/${score}/`;
  const ogImage = `${SITE_ORIGIN}/images/games/${game.slug}/score-${score}.png`;

  const ogTitle = `${score}/${total} 正解 — ${game.titleJa} | morioka12 game site`;
  const ogDesc = `正答率 ${pct}% / ${r.ja}。あなたも 4 択クイズに挑戦してみよう！ — Score ${score}/${total} (${pct}%) on the ${game.titleEn}.`;

  return renderTemplate({
    ogTitle,
    ogDesc,
    quizUrl,
    shareUrl,
    ogImage,
    accent,
    titleJa: game.titleJa,
    titleEn: game.titleEn,
    altText: `${score}/${total} 正解 - ${game.titleJa}`,
    primaryNumberHtml: `
      <div class="score" aria-label="score">
        <span class="num">${escapeHtml(String(score))}</span>
        <span class="sep">/</span>
        <span class="total">${escapeHtml(String(total))}</span>
      </div>
      <div class="pct">正答率 <b>${escapeHtml(String(pct))}%</b> · ${escapeHtml(String(score))} correct out of ${escapeHtml(String(total))}</div>
    `,
    rankHtml: `<div class="rank">${escapeHtml(`${r.ja} / ${r.en}`)}</div>`,
  });
}

// ランク系（kaiten-bounty / bug-kanji）の HTML 1ページ
function buildRankHtml(game, rank) {
  const quizUrl = `${SITE_ORIGIN}/games/${game.slug}/`;
  const shareUrl = `${SITE_ORIGIN}/games/${game.slug}/share/${rank.key}/`;
  const ogImage = `${SITE_ORIGIN}/images/games/${game.slug}/rank-${rank.key}.png`;
  const ogTitle = `${rank.labelJa} — ${game.titleJa} | morioka12 game site`;
  const ogDesc = `${rank.copyJa} ${rank.copyEn} — ${rank.tagEn} on ${game.titleEn}.`;

  return renderTemplate({
    ogTitle,
    ogDesc,
    quizUrl,
    shareUrl,
    ogImage,
    accent: rank.accent,
    titleJa: game.titleJa,
    titleEn: game.titleEn,
    altText: `${rank.labelJa} — ${game.titleJa}`,
    primaryNumberHtml: `
      <div class="rank-display" aria-label="rank">
        <span class="rank-tag">${escapeHtml(rank.tagJa)}</span>
        <div class="rank-title">${escapeHtml(rank.labelJa)}</div>
        <div class="rank-title-en">${escapeHtml(rank.labelEn)}</div>
      </div>
    `,
    rankHtml: `<div class="rank">${escapeHtml(`${rank.copyJa} / ${rank.copyEn}`)}</div>`,
  });
}

function renderTemplate(opts) {
  const {
    ogTitle,
    ogDesc,
    quizUrl,
    shareUrl,
    ogImage,
    accent,
    titleJa,
    titleEn,
    altText,
    primaryNumberHtml,
    rankHtml,
  } = opts;

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(ogTitle)}</title>
    <meta name="description" content="${escapeHtml(ogDesc)}" />
    <link rel="canonical" href="${escapeHtml(shareUrl)}" />

    <!-- ===== OGP / Twitter Card（スコア／ランク別画像） ===== -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDesc)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(altText)}" />
    <meta property="og:site_name" content="morioka12 game site" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:locale:alternate" content="en_US" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@scgajge12" />
    <meta name="twitter:creator" content="@scgajge12" />
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDesc)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

    <style>
      :root {
        --bg: #04111e;
        --bg2: #082336;
        --bg3: #0e3149;
        --text: #e6f4f9;
        --text-muted: #93c5d8;
        --text-dim: #5b8597;
        --accent: ${accent};
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        min-height: 100dvh;
        background:
          radial-gradient(circle at 18% 18%, rgba(34,211,238,0.12), transparent 55%),
          radial-gradient(circle at 82% 82%, rgba(251,191,36,0.08), transparent 55%),
          linear-gradient(135deg, #04111e 0%, #082336 55%, #0e3149 100%);
        color: var(--text);
        font-family:
          -apple-system,
          "Hiragino Sans",
          "Helvetica Neue",
          Arial,
          sans-serif;
        display: flex; flex-direction: column; align-items: center;
        padding: 32px 20px 40px;
        -webkit-font-smoothing: antialiased;
      }
      header { width: 100%; max-width: 720px; display: flex; align-items: center; gap: 12px; }
      .logo {
        width: 40px; height: 40px; border-radius: 10px;
        background: linear-gradient(135deg, #155e75, #0891b2);
        display: flex; align-items: center; justify-content: center;
        font-weight: 800; color: var(--text);
        border: 1px solid rgba(148,197,216,0.2);
      }
      header .name { font-weight: 700; font-size: 16px; }
      header .sub  { font-size: 11px; color: var(--text-muted); letter-spacing: 0.24em; text-transform: uppercase; }

      main {
        margin-top: 36px; width: 100%; max-width: 720px;
        background: rgba(8,35,54,0.55);
        border: 1px solid rgba(148,197,216,0.18);
        border-radius: 16px;
        padding: 32px 28px;
        text-align: center;
      }
      .game-title {
        font-size: 18px; color: var(--text-muted); font-weight: 600;
        letter-spacing: 0.04em;
      }
      .game-title small { display: block; font-size: 12px; color: var(--text-dim); margin-top: 4px; letter-spacing: 0.08em; }
      .score {
        margin: 24px 0 8px;
        display: flex; align-items: baseline; justify-content: center; gap: 8px;
      }
      .score .num {
        font-size: 96px; font-weight: 800; color: var(--accent);
        line-height: 1; letter-spacing: -0.04em;
      }
      .score .sep { font-size: 48px; color: var(--text-dim); font-weight: 300; }
      .score .total { font-size: 48px; color: var(--text-muted); font-weight: 600; }
      .pct {
        font-size: 14px; color: var(--text-muted); margin-top: 8px;
      }
      .pct b { color: var(--accent); font-weight: 700; font-size: 16px; }
      .rank-display { margin: 28px 0 12px; }
      .rank-display .rank-tag {
        display: inline-block; padding: 6px 14px;
        border-radius: 999px;
        background: rgba(8,35,54,0.6);
        border: 1px solid var(--accent);
        color: var(--accent);
        font-size: 12px; font-weight: 700;
        letter-spacing: 0.18em; text-transform: uppercase;
      }
      .rank-display .rank-title {
        margin-top: 14px;
        font-size: 40px; font-weight: 800; color: var(--accent);
        letter-spacing: -0.01em;
      }
      .rank-display .rank-title-en {
        margin-top: 4px;
        font-size: 14px; color: var(--text-muted);
        letter-spacing: 0.06em;
      }
      .rank {
        display: inline-block; margin-top: 18px;
        padding: 10px 18px; border-radius: 10px;
        background: rgba(8,35,54,0.7);
        border: 1px solid var(--accent);
        color: var(--accent);
        font-size: 13px; font-weight: 700;
        letter-spacing: 0.12em; text-transform: uppercase;
      }
      .cta {
        margin-top: 32px;
        display: flex; flex-direction: column; gap: 12px; align-items: center;
      }
      .cta a {
        display: inline-flex; align-items: center; justify-content: center;
        padding: 14px 28px; border-radius: 10px;
        font-weight: 700; font-size: 15px;
        text-decoration: none;
        transition: transform 0.15s ease, opacity 0.15s ease;
      }
      .cta a:hover { transform: translateY(-1px); opacity: 0.92; }
      .cta .primary {
        background: var(--accent);
        color: #04111e;
        min-width: 260px;
      }
      .cta .secondary {
        background: transparent;
        color: var(--text-muted);
        border: 1px solid rgba(148,197,216,0.3);
      }
      .note {
        margin-top: 20px; font-size: 12px; color: var(--text-dim);
      }
      footer {
        margin-top: 32px; font-size: 12px; color: var(--text-dim);
      }
      footer a { color: var(--text-muted); text-decoration: none; }
    </style>

    <!--
      4 秒後にゲーム本体へ遷移する。
      meta http-equiv="refresh" は使わない理由：
        Twitterbot 等のクローラがリダイレクトと解釈し、遷移先 URL の
        OGP を見に行く挙動があるため、スコア別 og:image が反映されない。
      JS で navigator.userAgent を確認し、ボットでない場合のみ遷移する。
    -->
    <script>
      (function () {
        try {
          var ua = (navigator && navigator.userAgent) || "";
          var isBot = /bot|crawl|spider|slurp|twitterbot|discordbot|facebookexternalhit|slackbot|linkedinbot|embedly|telegrambot|whatsapp|skypeuripreview|preview|fetch|http|google|bing|duckduckgo|baidu|yandex/i.test(ua);
          if (isBot) return;
          window.setTimeout(function () {
            window.location.replace(${JSON.stringify(quizUrl)});
          }, 4000);
        } catch (e) {
          // 失敗時はシェアページに留まる
        }
      })();
    </script>
  </head>
  <body>
    <header>
      <div class="logo">M</div>
      <div>
        <div class="name">morioka12 game site</div>
        <div class="sub">SHARED RESULT</div>
      </div>
    </header>

    <main>
      <div class="game-title">
        ${escapeHtml(titleJa)}
        <small>${escapeHtml(titleEn)}</small>
      </div>

      ${primaryNumberHtml}

      ${rankHtml}

      <div class="cta">
        <a class="primary" href="${escapeHtml(quizUrl)}" rel="noopener">あなたも挑戦する / Try the game</a>
        <a class="secondary" href="${SITE_ORIGIN}/" rel="noopener">morioka12 game site のトップへ</a>
      </div>

      <p class="note">
        ※ このページは X(Twitter) などからシェアされた結果ページです。<br />
        ※ 4 秒後に自動でゲーム本体へ移動します。
      </p>
    </main>

    <footer>
      <a href="${escapeHtml(quizUrl)}" rel="noopener">${escapeHtml(quizUrl)}</a> · <a href="https://x.com/scgajge12" rel="noopener noreferrer">@scgajge12</a>
    </footer>
  </body>
</html>
`;
}

function main() {
  let count = 0;
  for (const game of SCORE_GAMES) {
    for (let s = 0; s <= game.total; s++) {
      const dir = join(GAMES_DIR, game.slug, "share", String(s));
      mkdirSync(dir, { recursive: true });
      const file = join(dir, "index.html");
      writeFileSync(file, buildScoreHtml(game, s), "utf8");
      count++;
    }
  }
  for (const game of RANK_GAMES) {
    for (const rank of game.ranks) {
      const dir = join(GAMES_DIR, game.slug, "share", rank.key);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, "index.html");
      writeFileSync(file, buildRankHtml(game, rank), "utf8");
      count++;
    }
  }
  console.log(`generated ${count} share pages.`);
}

main();
