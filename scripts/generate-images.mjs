#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  ensureDir,
  fetchJson,
  inferExt,
  normalizeDraft,
  parseArgs,
  readJson,
  resolveGatewayBaseUrl,
  resolveGatewayIdentity,
  resolveApiKey,
  resolveDraftPath,
  writeJson
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const draft = normalizeDraft(readJson(draftPath));
const draftDir = path.dirname(draftPath);
const imagesDir = path.resolve(args["out-dir"] || path.join(draftDir, "images"));
const model = args.model || "doubao-seedream-5-0-260128";
const useDirectProvider = Boolean(args.direct || args["env-file"] || args["api-key"]);

ensureDir(imagesDir);

if (useDirectProvider) {
  await generateImagesDirect();
} else {
  await generateImagesViaGateway();
}

writeJson(draftPath, draft);
console.log(JSON.stringify({
  draftPath,
  imagesDir,
  posts: draft.posts.map((post) => ({
    platform: post.platform,
    images: post.images.map((image) => ({
      key: image.key,
      localImage: image.localImage,
      imageModel: image.imageModel
    }))
  }))
}, null, 2));

async function generateImagesDirect() {
  const baseUrl = args.baseUrl || "https://ark.cn-beijing.volces.com/api/v3";
  const apiKey = resolveApiKey({
    envFile: args["env-file"],
    envKey: args["env-key"] || "huoshan_API_KEY",
    apiKey: args["api-key"]
  });

  for (const [postIndex, post] of draft.posts.entries()) {
    for (const [imageIndex, imageSpec] of post.images.entries()) {
      const requestBody = {
        model,
        prompt: imageSpec.prompt
      };

      if (args.size) {
        requestBody.size = args.size;
      }

      const result = await fetchJson(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const image = result.data?.[0];
      if (!image?.url) {
        throw new Error(`No image URL returned for posts[${postIndex}].images[${imageIndex}]`);
      }

      await downloadAndAttachImage({
        postIndex,
        imageIndex,
        post,
        imageSpec,
        imageUrl: image.url,
        imageModel: result.model || model,
        imageSize: image.size || args.size || null
      });
    }
  }
}

async function generateImagesViaGateway() {
  const gatewayBaseUrl = resolveGatewayBaseUrl(args["gateway-base-url"]);
  const identity = resolveGatewayIdentity({
    explicitApiKey: args["gateway-api-key"],
    stateDir: args["state-dir"]
  });
  const items = [];

  for (const [postIndex, post] of draft.posts.entries()) {
    for (const [imageIndex, imageSpec] of post.images.entries()) {
      items.push({
        post_index: postIndex,
        image_index: imageIndex,
        platform: post.platform,
        key: imageSpec.key,
        prompt: imageSpec.prompt,
        size: args.size || null
      });
    }
  }

  const result = await fetchJson(`${gatewayBaseUrl}/relay/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${identity.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      job_id: draft.jobId || null,
      theme: draft.theme || null,
      model,
      size: args.size || null,
      items
    })
  });

  if (!Array.isArray(result.items) || result.items.length !== items.length) {
    throw new Error("Gateway image generation returned incomplete results.");
  }

  for (const item of result.items) {
    const post = draft.posts[item.post_index];
    const imageSpec = post?.images?.[item.image_index];
    if (!post || !imageSpec || !item.url) {
      throw new Error("Gateway image generation returned invalid item mapping.");
    }

    await downloadAndAttachImage({
      postIndex: item.post_index,
      imageIndex: item.image_index,
      post,
      imageSpec,
      imageUrl: item.url,
      imageModel: item.model || result.model || model,
      imageSize: item.size || args.size || null
    });
  }
}

async function downloadAndAttachImage({ postIndex, imageIndex, post, imageSpec, imageUrl, imageModel, imageSize }) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image for posts[${postIndex}].images[${imageIndex}]`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const extension = inferExt(imageResponse.headers.get("content-type"));
  const safeKey = String(imageSpec.key || `image-${imageIndex + 1}`).replace(/[^a-zA-Z0-9_-]+/g, "-");
  const fileName = `${String(postIndex + 1).padStart(2, "0")}-${post.platform}-${safeKey}${extension}`;
  const filePath = path.join(imagesDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

  imageSpec.imageModel = imageModel;
  imageSpec.imageGeneratedAt = new Date().toISOString();
  imageSpec.imageSize = imageSize;
  imageSpec.imageUrl = imageUrl;
  imageSpec.localImage = path.relative(draftDir, filePath).replaceAll("\\", "/");
}
