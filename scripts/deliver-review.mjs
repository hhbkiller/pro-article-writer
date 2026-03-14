#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { inferAgentId, nowStamp, parseArgs, readJson, resolveStateDir } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const filePath = path.resolve(args.file || args.media || args.path || "");

if (!filePath || !fs.existsSync(filePath)) {
  throw new Error("Use --file <review.single.html>. File must exist.");
}

const caption = args.caption || args.message || "审核状态：pending approval";
const stagedFilePath = stageMediaFile(filePath, args["state-dir"]);
const candidates = resolveDeliveryCandidates(args)
  .map((candidate) => ({
    ...candidate,
    target: normalizeTarget(candidate.target, candidate.channel)
  }))
  .filter((candidate) => candidate.channel && candidate.target);

if (candidates.length === 0) {
  throw new Error("Could not resolve delivery target. Provide --channel and --target explicitly.");
}

let delivered = null;
let lastFailure = null;

for (const candidate of candidates) {
  const result = sendMessage({
    channel: candidate.channel,
    target: candidate.target,
    account: candidate.accountId,
    stagedFilePath,
    caption,
    args
  });

  if (result.status === 0) {
    delivered = {
      channel: candidate.channel,
      target: candidate.target,
      accountId: candidate.accountId || null,
      stdout: (result.stdout || "").trim()
    };
    break;
  }

  const detail = (result.stderr || result.stdout || result.error?.message || "").trim();
  lastFailure = {
    channel: candidate.channel,
    target: candidate.target,
    accountId: candidate.accountId || null,
    detail
  };

  if (!isRetryableContextError(detail)) {
    throw new Error(`openclaw message send failed: ${detail || "unknown error"}`);
  }
}

if (!delivered) {
  const detail = lastFailure?.detail || "unknown error";
  throw new Error(`openclaw message send failed after trying ${candidates.length} target(s): ${detail}`);
}

const stdout = delivered.stdout;
let parsed;
try {
  parsed = stdout ? JSON.parse(stdout) : null;
} catch {
  parsed = null;
}

console.log(JSON.stringify({
  delivered: true,
  channel: delivered.channel,
  target: delivered.target,
  accountId: delivered.accountId,
  filePath,
  stagedFilePath,
  caption,
  result: parsed || stdout || null
}, null, 2));

function resolveDeliveryCandidates(cliArgs) {
  const explicit = resolveExplicitDelivery(cliArgs);
  if (explicit) {
    return [explicit];
  }

  if (cliArgs["session-key"] || cliArgs["session-id"]) {
    return resolveRequestedSession(cliArgs);
  }

  return [];
}

function resolveExplicitDelivery(cliArgs) {
  const channel = cliArgs.channel || process.env.OPENCLAW_DELIVERY_CHANNEL || null;
  const target = cliArgs.target || process.env.OPENCLAW_DELIVERY_TARGET || null;
  const accountId = cliArgs.account || process.env.OPENCLAW_DELIVERY_ACCOUNT || null;

  if (!channel && !target) {
    return null;
  }

  return {
    channel,
    target,
    accountId
  };
}

function resolveRequestedSession(cliArgs) {
  const stateDir = resolveStateDir(cliArgs["state-dir"]);
  const agentId = cliArgs.agent || inferAgentId();
  const sessionsPath = path.join(stateDir, "agents", agentId, "sessions", "sessions.json");
  if (!fs.existsSync(sessionsPath)) {
    return [];
  }

  const store = readJson(sessionsPath);
  const entries = Object.entries(store)
    .filter(([, value]) => value && typeof value === "object" && value.deliveryContext)
    .map(([key, value]) => ({ key, ...value }));

  const selected = selectSessions(entries, cliArgs);
  return dedupeCandidates(selected.map((entry) => {
    const context = entry.deliveryContext || {};
    return [{
      channel: context.channel || entry.lastChannel || null,
      target: context.to || entry.lastTo || null,
      accountId: context.accountId || entry.lastAccountId || null
    }];
  }).flat());
}

function selectSessions(entries, cliArgs) {
  if (entries.length === 0) {
    return [];
  }

  if (cliArgs["session-key"]) {
    const hit = entries.find((entry) => entry.key === cliArgs["session-key"]);
    if (hit) {
      return [hit];
    }
  }
  if (cliArgs["session-id"]) {
    const hit = entries.find((entry) => entry.sessionId === cliArgs["session-id"]);
    if (hit) {
      return [hit];
    }
  }

  return [];
}

function normalizeTarget(target, channel) {
  if (!target) {
    return target;
  }
  const prefix = `${channel}:`;
  if (target.startsWith(prefix)) {
    return target.slice(prefix.length);
  }
  return target;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const output = [];
  for (const candidate of candidates) {
    const key = [candidate.channel || "", candidate.target || "", candidate.accountId || ""].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function sendMessage({ channel, target, account, stagedFilePath, caption, args }) {
  const commandArgs = [
    "message",
    "send",
    "--channel", channel,
    "--target", target,
    "--media", stagedFilePath
  ];

  if (caption) {
    commandArgs.push("--message", caption);
  }
  if (account) {
    commandArgs.push("--account", account);
  }
  const replyTo = args["reply-to"] || process.env.OPENCLAW_DELIVERY_REPLY_TO || null;
  const threadId = args["thread-id"] || process.env.OPENCLAW_DELIVERY_THREAD_ID || null;
  if (replyTo) {
    commandArgs.push("--reply-to", replyTo);
  }
  if (threadId) {
    commandArgs.push("--thread-id", threadId);
  }
  if (args.json) {
    commandArgs.push("--json");
  }

  return spawnSync("openclaw", commandArgs, {
    encoding: "utf8",
    cwd: process.cwd()
  });
}

function isRetryableContextError(detail) {
  const text = String(detail || "").toLowerCase();
  return (
    text.includes("group chat was deleted") ||
    text.includes("chat not found") ||
    text.includes("bot was kicked") ||
    text.includes("have no rights to send") ||
    text.includes("forbidden: bot was blocked")
  );
}

function stageMediaFile(originalPath, customStateDir) {
  const stateDir = resolveStateDir(customStateDir);
  const outboxDir = path.join(stateDir, "media", "review-outbox");
  fs.mkdirSync(outboxDir, { recursive: true });

  const ext = path.extname(originalPath) || ".html";
  const base = path.basename(originalPath, ext).replace(/[^a-zA-Z0-9._-]+/g, "-") || "review";
  const stagedPath = path.join(outboxDir, `${nowStamp()}-${base}${ext}`);

  fs.copyFileSync(originalPath, stagedPath);
  return stagedPath;
}
