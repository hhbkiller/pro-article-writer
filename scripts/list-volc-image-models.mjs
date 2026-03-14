#!/usr/bin/env node

import { fetchJson, parseArgs, resolveApiKey } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || "https://ark.cn-beijing.volces.com/api/v3";
const apiKey = resolveApiKey({
  envFile: args["env-file"],
  envKey: args["env-key"] || "huoshan_API_KEY",
  apiKey: args["api-key"]
});

const payload = await fetchJson(`${baseUrl}/models`, {
  headers: {
    Authorization: `Bearer ${apiKey}`
  }
});

const imageModels = (payload.data || []).filter((model) => {
  const taskTypes = Array.isArray(model.task_type) ? model.task_type : [];
  return model.domain === "ImageGeneration" ||
    taskTypes.includes("TextToImage") ||
    taskTypes.includes("ImageToImage");
});

console.log(JSON.stringify(imageModels, null, 2));
