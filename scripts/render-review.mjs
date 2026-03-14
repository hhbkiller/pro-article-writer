#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { imagePathToDataUri, normalizeDraft, parseArgs, readJson, resolveDraftPath, writeJson, writeText } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const draft = normalizeDraft(readJson(draftPath));
const outPath = path.resolve(args.out || path.join(path.dirname(draftPath), "review.single.html"));
const artifactManifestPath = path.resolve(args["artifacts-out"] || path.join(path.dirname(outPath), "artifacts.json"));
const draftDir = path.dirname(draftPath);
const postsHtml = (draft.posts || []).map((post) => renderPost(post, draftDir)).join("\n");
const embeddedImageCount = (draft.posts || []).reduce((count, post) => {
  return count + (post.images || []).filter((image) => image.localImage).length;
}, 0);
const selfContained = true;
const notesHtml = Array.isArray(draft.notes) && draft.notes.length > 0
  ? `<section class="notes"><h2>备注</h2><ul>${draft.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></section>`
  : "";

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(draft.theme)} - 审核页</title>
  <style>
    :root {
      --bg: #f4efe7;
      --ink: #1f1b18;
      --muted: #665d55;
      --card: rgba(255,255,255,0.86);
      --line: rgba(31,27,24,0.12);
      --accent: #d6602b;
      --accent-2: #145f63;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(214,96,43,0.15), transparent 32%),
        radial-gradient(circle at top right, rgba(20,95,99,0.16), transparent 28%),
        linear-gradient(180deg, #f7f1e8 0%, #efe5d7 100%);
    }
    .page {
      width: min(1200px, calc(100vw - 32px));
      margin: 24px auto 48px;
    }
    .hero {
      border: 1px solid var(--line);
      background: linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,248,239,0.74));
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 24px 60px rgba(56, 42, 24, 0.10);
    }
    .eyebrow {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(214,96,43,0.12);
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    h1 {
      margin: 16px 0 10px;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.08;
    }
    .meta, .rules {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
      color: var(--muted);
      font-size: 14px;
    }
    .chip {
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255,255,255,0.72);
    }
    .stack {
      display: grid;
      gap: 18px;
      margin-top: 24px;
    }
    .card {
      border: 1px solid var(--line);
      background: var(--card);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 40px rgba(44, 33, 19, 0.08);
    }
    .article-flow img, .img-missing {
      display: block;
      width: 100%;
      border-radius: 18px;
      object-fit: cover;
      background: linear-gradient(135deg, rgba(214,96,43,0.15), rgba(20,95,99,0.16));
    }
    .img-missing {
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 14px;
      min-height: 240px;
    }
    .body {
      padding: 20px;
    }
    .platform {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(20,95,99,0.10);
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 24px;
      line-height: 1.2;
    }
    .post-meta {
      display: grid;
      gap: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      color: var(--muted);
    }
    .content {
      font-size: 15px;
      line-height: 1.85;
      white-space: pre-wrap;
    }
    .article-flow {
      display: grid;
      gap: 14px;
    }
    .article-flow h3 {
      margin: 8px 0 0;
      font-size: 18px;
      line-height: 1.35;
    }
    .article-flow p, .article-flow blockquote {
      margin: 0;
      font-size: 15px;
      line-height: 1.9;
    }
    .article-flow blockquote {
      padding: 14px 16px;
      border-left: 4px solid rgba(214,96,43,0.55);
      background: rgba(214,96,43,0.06);
      border-radius: 12px;
      color: #473730;
    }
    .article-flow ul {
      margin: 0;
      padding-left: 20px;
    }
    figure {
      margin: 0;
      display: grid;
      gap: 8px;
    }
    figcaption {
      font-size: 13px;
      color: var(--muted);
    }
    .prompt {
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px dashed var(--line);
    }
    .prompt strong {
      display: block;
      margin-bottom: 8px;
      color: var(--accent);
    }
    .notes {
      margin-top: 24px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.76);
      border-radius: 20px;
      padding: 22px;
    }
    ul {
      margin: 10px 0 0;
      padding-left: 18px;
      line-height: 1.8;
    }
    @media (max-width: 980px) {
      .page { width: min(100vw - 20px, 1200px); }
      .hero { padding: 22px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <span class="eyebrow">REVIEW ONLY</span>
      <h1>${escapeHtml(draft.theme)} 三平台待审核文章页</h1>
      <div class="meta">
        <span class="chip">Job ID: ${escapeHtml(draft.jobId || "")}</span>
        <span class="chip">当前状态: ${escapeHtml(draft.status || "draft")}</span>
        <span class="chip">审核状态: ${escapeHtml(draft.approval?.status || "pending")}</span>
      </div>
      <div class="rules">
        <span class="chip">规则 1：未明确批准前，不得发布</span>
        <span class="chip">规则 2：只生成头条 / 小红书 / X 三个平台内容</span>
        <span class="chip">规则 3：图片与正文一并审核</span>
      </div>
    </section>
    <section class="stack">
      ${postsHtml}
    </section>
    ${notesHtml}
  </main>
</body>
</html>
`;

writeText(outPath, html);
const artifactManifest = buildArtifactManifest();
writeJson(artifactManifestPath, artifactManifest);
console.log(JSON.stringify({
  outPath,
  artifactManifestPath,
  embeddedImageCount,
  selfContained,
  artifacts: artifactManifest.artifacts
}, null, 2));

function buildArtifactManifest() {
  const stat = fs.statSync(outPath);
  return {
    schemaVersion: 1,
    jobId: draft.jobId || "",
    theme: draft.theme || "",
    generatedAt: new Date().toISOString(),
    delivery: {
      owner: "runtime",
      mode: "current_request_only"
    },
    artifacts: [
      {
        id: "review_html",
        kind: "html_review",
        role: "review",
        path: outPath,
        filename: path.basename(outPath),
        mimeType: "text/html",
        caption: `审核状态：${draft.approval?.status || "pending approval"}`,
        selfContained,
        embeddedImageCount,
        fileSizeBytes: stat.size
      }
    ]
  };
}

function labelPlatform(platform) {
  switch (platform) {
    case "toutiao":
      return "今日头条";
    case "xiaohongshu":
      return "小红书";
    case "x":
      return "X";
    default:
      return platform;
  }
}

function renderPost(post, draftDir) {
  const articleFlow = renderBlocks(post, draftDir);
  return `<article class="card">
    <div class="body">
      <span class="platform">${escapeHtml(labelPlatform(post.platform))}</span>
      <h2>${escapeHtml(post.title || "")}</h2>
      <div class="post-meta">
        <span>建议发布时间：${escapeHtml(post.publishTime || "")}</span>
        <span>内容目标：${escapeHtml(post.goal || "")}</span>
        ${post.images?.[0]?.imageModel ? `<span>配图模型：${escapeHtml(post.images[0].imageModel)}</span>` : ""}
      </div>
      <div class="article-flow">${articleFlow}</div>
      <div class="prompt">
        <strong>本篇图片提示词</strong>
        <div class="content">${escapeHtml((post.images || []).map((image) => `[${image.key}] ${image.prompt}`).join("\n\n"))}</div>
      </div>
    </div>
  </article>`;
}

function renderBlocks(post, draftDir) {
  const imageMap = new Map((post.images || []).map((image) => [image.key, image]));
  return (post.blocks || []).map((block) => {
    if (block.type === "paragraph") {
      return `<p>${escapeHtml(block.text || "")}</p>`;
    }
    if (block.type === "heading") {
      return `<h3>${escapeHtml(block.text || "")}</h3>`;
    }
    if (block.type === "quote") {
      return `<blockquote>${escapeHtml(block.text || "")}</blockquote>`;
    }
    if (block.type === "list") {
      return `<ul>${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }
    if (block.type === "image") {
      const image = imageMap.get(block.imageKey);
      if (!image?.localImage) {
        return `<div class="img-missing">图片待生成：${escapeHtml(block.imageKey || "")}</div>`;
      }
      const dataUri = imagePathToDataUri(path.resolve(draftDir, image.localImage));
      const caption = block.caption || image.caption || "";
      const alt = image.alt || post.title || labelPlatform(post.platform);
      return `<figure><img src="${escapeAttr(dataUri)}" alt="${escapeAttr(alt)}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
    }
    return "";
  }).filter(Boolean).join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

