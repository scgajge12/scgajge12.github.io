#!/usr/bin/env node
// ============================================================
// portfolio OGP（SVG 版）の生成スクリプト
//
//   ポートフォリオ全体で共通使用する 1200x630 の OGP を
//   static/images/og/home.svg に書き出す。
//   依存ゼロ（Node.js のみ）。アバター画像（static/images/morioka12.jpg）を
//   base64 でインライン化し、外部参照なしで完結させる。
//
//   ※ 静的ゲームサイト（/games/）は独自 OGP を持つため対象外。
//
// 使い方:
//   node scripts/ogp/gen_svg.mjs
//
// 出力:
//   static/images/og/home.svg
// ============================================================
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(repoRoot, "static", "images", "og");
mkdirSync(outDir, { recursive: true });

// アバター画像（500x500 JPG）を base64 でインライン化
const avatarPath = join(repoRoot, "static", "images", "morioka12.jpg");
const avatarB64 = readFileSync(avatarPath).toString("base64");
const avatarDataUri = `data:image/jpeg;base64,${avatarB64}`;

// XML エンティティをエスケープ
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * 1200x630 の OGP SVG を組み立てる（左テキスト + 右アバターのスプリット構図）
 * @param {{eyebrow:string, titleLine1:string, titleLine2:string, subtitle:string}} p
 */
function svg(p) {
  const W = 1200, H = 630;
  const accent = "#38b48b";
  const accent2 = "#22d3ee";
  const fontSans = `"Helvetica Neue","Segoe UI","Hiragino Sans","Yu Gothic UI","Noto Sans CJK JP",Arial,sans-serif`;
  const fontMono = `"SF Mono","JetBrains Mono","Menlo","Consolas",ui-monospace,monospace`;

  // アバター位置（右側、垂直中央）
  const avCx = 950;
  const avCy = H / 2 + 10;
  const avR = 168;

  // ----- defs：グラデ・パターン・フィルタ・クリップ -----
  const defs = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#08111c"/>
        <stop offset="45%" stop-color="#0c1a28"/>
        <stop offset="100%" stop-color="#102434"/>
      </linearGradient>
      <radialGradient id="avGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
        <stop offset="55%" stop-color="${accent}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cyanGlow" cx="8%" cy="92%" r="65%">
        <stop offset="0%" stop-color="${accent2}" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="${accent2}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="ringStroke" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="${accent2}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.55"/>
      </linearGradient>
      <linearGradient id="underline" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0"/>
        <stop offset="22%" stop-color="${accent}" stop-opacity="0.85"/>
        <stop offset="52%" stop-color="${accent2}" stop-opacity="0.85"/>
        <stop offset="82%" stop-color="${accent}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="gridMask" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="white" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="white" stop-opacity="0.12"/>
      </linearGradient>
      <mask id="gridMaskRef">
        <rect width="${W}" height="${H}" fill="url(#gridMask)"/>
      </mask>
      <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="white" fill-opacity="0.05"/>
      </pattern>
      <filter id="lineGlow" x="-10%" y="-200%" width="120%" height="500%">
        <feGaussianBlur stdDeviation="6"/>
      </filter>
      <filter id="avDrop" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="14" in="SourceAlpha"/>
        <feOffset dx="0" dy="8"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <clipPath id="avatarClip">
        <circle cx="${avCx}" cy="${avCy}" r="${avR}"/>
      </clipPath>
    </defs>`;

  // ----- 背景 -----
  const bg = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#gridMaskRef)"/>
    <rect width="${W}" height="${H}" fill="url(#cyanGlow)"/>
    <!-- アバター後方の大きな光彩 -->
    <circle cx="${avCx}" cy="${avCy}" r="${avR * 2.2}" fill="url(#avGlow)"/>`;

  // ----- 左上ブランド：● morioka12 + ステータスチップ -----
  const brand = `
    <g transform="translate(64 60)">
      <circle cx="9" cy="14" r="9" fill="${accent}"/>
      <circle cx="9" cy="14" r="14" fill="none" stroke="${accent}" stroke-opacity="0.25" stroke-width="4"/>
      <text x="32" y="22" font-family='${fontMono}' font-size="22" font-weight="700" fill="#e9f6ee" letter-spacing="0.04em">morioka12</text>
    </g>
    <!-- 右上：ドメイン -->
    <text x="${W - 64}" y="82" text-anchor="end" font-family='${fontMono}' font-size="18" fill="#d6f1e3" fill-opacity="0.6" letter-spacing="0.04em">scgajge12.github.io</text>`;

  // ----- Eyebrow ピル "// PORTFOLIO" -----
  const eyebrowText = `// ${p.eyebrow.toUpperCase()}`;
  const ebFs = 17;
  const ebLs = 0.22;
  const ebCharAdv = ebFs * (0.65 + ebLs);
  const ebPadX = 16;
  const ebW = Math.ceil(eyebrowText.length * ebCharAdv + ebPadX * 2);
  const eyebrow = `
    <g transform="translate(64 156)">
      <rect x="0" y="0" rx="6" ry="6" width="${ebW}" height="34"
            fill="${accent}" fill-opacity="0.10"
            stroke="${accent}" stroke-opacity="0.45" stroke-width="1"/>
      <text x="${ebPadX}" y="23" font-family='${fontMono}' font-size="${ebFs}" font-weight="700"
            fill="${accent}" letter-spacing="${ebLs}em">${esc(eyebrowText)}</text>
    </g>`;

  // ----- タイトル（2 行スタック） -----
  // L1: "Yuta Morioka" 白 / L2: "morioka12" アクセント
  const titleFs = 92;
  const titleY1 = 156 + 34 + 30 + titleFs * 0.78;       // ≒ 292
  const titleY2 = titleY1 + titleFs * 1.02;             // ≒ 386
  const title = `
    <text x="64" y="${titleY1}" font-family='${fontSans}' font-size="${titleFs}" font-weight="900"
          fill="#ffffff" letter-spacing="-0.035em">${esc(p.titleLine1)}</text>
    <text x="64" y="${titleY2}" font-family='${fontSans}' font-size="${titleFs}" font-weight="900"
          fill="${accent}" letter-spacing="-0.035em">${esc(p.titleLine2)}</text>`;

  // ----- サブタイトル -----
  const subY = titleY2 + 50;                            // ≒ 436
  const subtitle = `
    <text x="64" y="${subY}" font-family='${fontSans}' font-size="26" font-weight="500"
          fill="#d6f1e3" fill-opacity="0.78">${esc(p.subtitle)}</text>`;

  // ----- アバター（右側、円形クリップ + 多重リング + ドロップシャドウ） -----
  const avatar = `
    <!-- 外側の薄い破線リング -->
    <circle cx="${avCx}" cy="${avCy}" r="${avR + 28}" fill="none"
            stroke="${accent}" stroke-opacity="0.30" stroke-width="1" stroke-dasharray="3 6"/>
    <!-- アバター画像（円形クリップ） -->
    <g filter="url(#avDrop)">
      <image href="${avatarDataUri}" xlink:href="${avatarDataUri}"
             x="${avCx - avR}" y="${avCy - avR}" width="${avR * 2}" height="${avR * 2}"
             preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
    </g>
    <!-- メインの太いアクセントリング -->
    <circle cx="${avCx}" cy="${avCy}" r="${avR + 6}" fill="none"
            stroke="url(#ringStroke)" stroke-width="4"/>
    <!-- 内側の細いハイライト -->
    <circle cx="${avCx}" cy="${avCy}" r="${avR - 2}" fill="none"
            stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>
    <!-- アバター右下：ターミナル風バッジ（&gt;_） -->
    <g transform="translate(${avCx + avR - 18} ${avCy + avR - 18})">
      <circle cx="0" cy="0" r="28" fill="#0c1a28" stroke="${accent}" stroke-width="2"/>
      <text x="-2" y="8" text-anchor="middle" font-family='${fontMono}' font-size="22" font-weight="800" fill="${accent}">&gt;_</text>
    </g>`;

  // ----- 下部の発光ライン -----
  const underline = `
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="url(#underline)"/>
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="url(#underline)" filter="url(#lineGlow)"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs}
  ${bg}
  ${avatar}
  ${brand}
  ${eyebrow}
  ${title}
  ${subtitle}
  ${underline}
</svg>
`;
}

// ============================================================
// ページ定義（portfolio 共通 OGP）
// ============================================================
const pages = [
  {
    out: "home.svg",
    eyebrow: "Portfolio",
    titleLine1: "Yuta Morioka",
    titleLine2: "morioka12",
    subtitle: "Security Engineer / Bug Hunter / Ethical Hacker",
  },
];

for (const p of pages) {
  const dest = join(outDir, p.out);
  writeFileSync(dest, svg(p));
  console.log(`wrote ${dest}`);
}
