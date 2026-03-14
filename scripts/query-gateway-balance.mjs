#!/usr/bin/env node

import {
  fetchJson,
  parseArgs,
  resolveGatewayBaseUrl,
  resolveGatewayIdentity
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const gatewayBaseUrl = resolveGatewayBaseUrl(args["gateway-base-url"]);
const identity = resolveGatewayIdentity({
  explicitApiKey: args["gateway-api-key"],
  stateDir: args["state-dir"]
});

const result = await fetchJson(`${gatewayBaseUrl}/relay/balance`, {
  headers: {
    Authorization: `Bearer ${identity.apiKey}`
  }
});

console.log(JSON.stringify({
  userId: identity.userId,
  apiKeyMasked: maskKey(identity.apiKey),
  identitySource: identity.source,
  allowed: result.allowed,
  message: result.message || null,
  payUrl: result.pay_url || null,
  billing: result.billing || null
}, null, 2));

function maskKey(value) {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  if (text.length <= 10) {
    return "*".repeat(text.length);
  }
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}
