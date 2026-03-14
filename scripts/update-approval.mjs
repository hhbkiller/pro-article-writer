#!/usr/bin/env node

import { parseArgs, readJson, resolveDraftPath, writeJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const status = args.status;

if (!status || !["pending", "approved", "rejected"].includes(status)) {
  throw new Error("Use --status pending|approved|rejected");
}

const draft = readJson(draftPath);
draft.approval = {
  status,
  approvedBy: args.by || null,
  approvedAt: status === "approved" ? new Date().toISOString() : null,
  note: args.note || null
};

if (status === "approved") {
  draft.status = "approved";
} else if (status === "rejected") {
  draft.status = "needs_revision";
} else {
  draft.status = "draft";
}

writeJson(draftPath, draft);
console.log(JSON.stringify(draft.approval, null, 2));
