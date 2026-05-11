#!/usr/bin/env node
// bonsai-recon の SCENARIOS データ中の `role: "essential"` / `role: "junk"` を
// XOR + Base64 で難読化し、`r: "<token>"` に置き換える。
//
// 各行ごとに line.code を salt に含めるため、同じ role でも token が一意になる。
// HTML 側の _decRole / roleOf と KEY を一致させること。
// SCENARIOS データに新しい行を追加した場合、本スクリプトを再実行すれば
// 平文の `role:` だけが変換される（既に `r:` に変換済みの行は無視）。
//
// 使い方:
//   node scripts/encode_bonsai_recon.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FILE = resolve(
  __dirname,
  "..",
  "static",
  "games",
  "bonsai-recon",
  "index.html",
);

// JS 側 _decRole と完全一致させる必要がある共有鍵
const KEY = "B0nsa1R3con7";

function encode(role, salt) {
  // salt を先に置くことで、role が短くても出力バイト列が salt 由来になる
  const k = salt + "|" + KEY;
  const bytes = Buffer.from(role, "utf8");
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ k.charCodeAt(i % k.length);
  }
  return out.toString("base64");
}

let src = readFileSync(FILE, "utf8");

// 単一行で `{ code: "...", role: "essential|junk", reason: ... }` 形式の行を抽出
// code 内の \" は escape された JS 文字列リテラルとして扱う
const re =
  /(\{ code: ")((?:[^"\\]|\\.)*)(", )role: "(essential|junk)"/g;

let count = 0;
src = src.replace(re, (match, head, codeRaw, mid, role) => {
  // codeRaw は JS リテラル形式。salt には実際の文字列値を使う
  const salt = JSON.parse('"' + codeRaw + '"');
  const token = encode(role, salt);
  count++;
  return head + codeRaw + mid + 'r: "' + token + '"';
});

writeFileSync(FILE, src, "utf8");
console.log(`encoded ${count} lines.`);
