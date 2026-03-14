#!/usr/bin/env node

import { normalizeDraft, parseArgs, readJson, resolveDraftPath } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const draft = normalizeDraft(readJson(draftPath));

const errors = [];
const allowedPlatforms = ["toutiao", "xiaohongshu", "x"];

if (!draft.jobId) {
  errors.push("Missing jobId");
}
if (!draft.theme) {
  errors.push("Missing theme");
}
if (!Array.isArray(draft.posts) || draft.posts.length === 0) {
  errors.push("posts must be a non-empty array");
}
if (Array.isArray(draft.posts) && draft.posts.length !== allowedPlatforms.length) {
  errors.push(`posts must contain exactly ${allowedPlatforms.length} platform articles`);
}

const seenPlatforms = new Set();

for (const [index, post] of (draft.posts || []).entries()) {
  const prefix = `posts[${index}]`;
  if (!post.platform) {
    errors.push(`${prefix}.platform is required`);
  } else if (!allowedPlatforms.includes(post.platform)) {
    errors.push(`${prefix}.platform must be one of: ${allowedPlatforms.join(", ")}`);
  } else if (seenPlatforms.has(post.platform)) {
    errors.push(`${prefix}.platform '${post.platform}' is duplicated`);
  } else {
    seenPlatforms.add(post.platform);
  }
  if (!post.title) {
    errors.push(`${prefix}.title is required`);
  }
  if (!post.publishTime) {
    errors.push(`${prefix}.publishTime is required`);
  }
  if (!post.goal) {
    errors.push(`${prefix}.goal is required`);
  }
  if (!Array.isArray(post.blocks) || post.blocks.length === 0) {
    errors.push(`${prefix}.blocks must be a non-empty array`);
  }
  if (!Array.isArray(post.images) || post.images.length === 0) {
    errors.push(`${prefix}.images must be a non-empty array`);
  }

  const imageKeys = new Set();
  for (const [imageIndex, image] of (post.images || []).entries()) {
    const imagePrefix = `${prefix}.images[${imageIndex}]`;
    if (!image.key) {
      errors.push(`${imagePrefix}.key is required`);
    }
    if (!image.prompt) {
      errors.push(`${imagePrefix}.prompt is required`);
    }
    if (image.key) {
      imageKeys.add(image.key);
    }
  }

  for (const [blockIndex, block] of (post.blocks || []).entries()) {
    const blockPrefix = `${prefix}.blocks[${blockIndex}]`;
    if (!block.type) {
      errors.push(`${blockPrefix}.type is required`);
      continue;
    }
    if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
      if (!block.text) {
        errors.push(`${blockPrefix}.text is required for ${block.type}`);
      }
    } else if (block.type === "list") {
      if (!Array.isArray(block.items) || block.items.length === 0) {
        errors.push(`${blockPrefix}.items must be a non-empty array`);
      }
    } else if (block.type === "image") {
      if (!block.imageKey) {
        errors.push(`${blockPrefix}.imageKey is required`);
      } else if (!imageKeys.has(block.imageKey)) {
        errors.push(`${blockPrefix}.imageKey references missing image '${block.imageKey}'`);
      }
    } else {
      errors.push(`${blockPrefix}.type '${block.type}' is not supported`);
    }
  }
}

for (const platform of allowedPlatforms) {
  if (!seenPlatforms.has(platform)) {
    errors.push(`missing required platform '${platform}'`);
  }
}

if (!draft.approval || !draft.approval.status) {
  errors.push("approval.status is required");
}

if (errors.length > 0) {
  console.error("DRAFT_INVALID");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("DRAFT_VALID");
