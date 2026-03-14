---
name: social-content-pipeline
description: Prepare review-first HTML article preview pages for Toutiao, Xiaohongshu, and X. Use when the user asks to pick topics, write platform-specific posts, generate article images, assemble a single HTML review page before any publishing, or uses phrases like 生成图文 / 写一篇软文.
---

# Social Content Pipeline

This skill is for content production, not blind auto-posting.

It handles:

- topic selection
- per-platform draft writing
- image prompt generation
- HuoShan Seedream image generation
- HTML review page assembly
- explicit approval state tracking

It does not publish anything by default.

## Core Rule

Human approval is mandatory before publishing.

If the user has not explicitly approved the draft package, stop at the review stage.

Every time the user asks to generate a new review package, create a fresh job with `scripts/init-job.mjs`.
Do not reuse an old job directory unless the user explicitly asks to continue that exact job.

When review output is ready, the skill must stop after generating local artifacts.
Attachment delivery is owned by the runtime or host application, not by this skill.

The skill must produce:

- `jobs/<job-id>/review.single.html`
- `jobs/<job-id>/artifacts.json`

`artifacts.json` is the handoff contract for the runtime.
The runtime must read that file and send the HTML attachment back to the current request conversation.

The skill must not:

- call `openclaw message send`
- guess delivery targets from sessions
- scan historical sessions
- send Telegram / Feishu / Slack / Discord / WhatsApp attachments by itself

After artifacts are ready, do not paste the article inline.
If the runtime still expects text, reply only with a short status line that the review package is ready.

Do not convert paths to Windows-only host paths.
Do not use hard-coded directories or static job ids.

## Mandatory Triggers

The following phrases are hard triggers for this skill and must not be answered with inline article text:

- `生成图文`
- `写一篇软文`
- `写软文`
- `图文内容`
- `配图软文`

If the user message contains any of the phrases above, or asks for article generation plus images, you must invoke this skill immediately.

Before doing anything else for these trigger phrases, re-read this SKILL.md in the current turn even if you believe you already know the workflow from earlier messages in the same session.

If the user does not specify a platform and only asks for a soft article or image-text article package, default to generating the standard 3-platform review package for:

- Toutiao
- Xiaohongshu
- X

The final output for these trigger phrases must be a review-first HTML package.
Do not reply with正文成稿 first.
Do not skip HTML assembly.
Do not skip artifact manifest generation.

If the trigger phrase is `生成图文`, `图文内容`, or `配图软文`, image generation is mandatory.
For those requests, you must run `scripts/generate-images.mjs` before `scripts/render-review.mjs`.
If image generation does not complete successfully, do not emit the HTML review package. Report image-generation failure plainly and stop.


## Runtime Handoff Safety

In Telegram, Feishu, QQ, Slack, Discord, WhatsApp, or any other remote chat channel:

- do not return `file://` links
- do not return `\\wsl.localhost\...` paths
- do not return local filesystem paths as the primary review method
- do not ask the user to open a local path unless the user explicitly asked for the local file path

For remote-chat users, the runtime must send the HTML attachment by consuming `artifacts.json`.

This skill must only hand off artifact metadata. It must not perform remote attachment delivery itself.

If a host runtime cannot consume `artifacts.json` yet, that is a runtime integration gap, not a reason for the skill to guess or reuse old delivery contexts.
## Recommended Workflow

### 1. Create a draft job

Initialize a new job folder:

```bash
node scripts/init-job.mjs --root ./jobs --theme "AI 自动化" --platforms toutiao,xiaohongshu,x
```

This creates:

- `jobs/<job-id>/draft.json`
- `jobs/<job-id>/review.single.html`
- `jobs/<job-id>/artifacts.json`
- `jobs/<job-id>/images/`

### 2. Fill `draft.json`

Write platform-specific publish structures into `draft.json`.

Required shape:

```json
{
  "jobId": "20260313-081500-ai-automation",
  "theme": "AI 自动化",
  "status": "draft",
  "approval": {
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "note": null
  },
  "posts": [
    {
      "platform": "toutiao",
      "title": "标题",
      "publishTime": "2026-03-13 08:30",
      "goal": "阅读量",
      "blocks": [
        { "type": "paragraph", "text": "开场段落" },
        { "type": "image", "imageKey": "main-1", "caption": "图注" },
        { "type": "heading", "text": "小标题" },
        { "type": "paragraph", "text": "正文段落" },
        { "type": "list", "items": ["要点1", "要点2"] }
      ],
      "images": [
        {
          "key": "main-1",
          "prompt": "配图提示词",
          "alt": "图片替代文本",
          "caption": "图注"
        }
      ]
    }
  ]
}
```

Rules:

- `posts` must stay platform-specific
- do not reuse the exact same copy across platforms
- every post should have at least one `image`
- images must be referenced from `blocks`
- the final reading order must come from `blocks`, not from a single flat `content` field
- only generate 3 platform articles: Toutiao, Xiaohongshu, and X
- include each of those 3 platforms exactly once
- do not generate X reply drafts in this skill
- never store API keys inside the draft file

### 3. Validate the draft

```bash
node scripts/validate-draft.mjs --draft jobs/<job-id>/draft.json
```

If validation fails, fix the draft before continuing.

### 4. Generate images when requested

If the user wants actual images, call:

```bash
node scripts/generate-images.mjs --draft jobs/<job-id>/draft.json
```

Default behavior:

- use the managed relay gateway image endpoint by default
- do not require the end user to configure `huoshan_API_KEY`
- reuse or auto-create a local user identity token and let the gateway handle billing + HuoShan API keys server-side
- default image model remains `doubao-seedream-5-0-260128` unless overridden

Direct provider mode is only for developer debugging, not normal end-user flow:

```bash
node scripts/generate-images.mjs --draft jobs/<job-id>/draft.json --direct --env-file /path/to/.env
```

If the default model fails because it was retired, discover current image models first:

```bash
node scripts/list-volc-image-models.mjs --env-file /path/to/.env
```

Then retry in direct mode with:

```bash
node scripts/generate-images.mjs --draft jobs/<job-id>/draft.json --direct --env-file /path/to/.env --model <model-id>
```

### 5. Render the HTML review page

```bash
node scripts/render-review.mjs --draft jobs/<job-id>/draft.json --out jobs/<job-id>/review.single.html
```

The HTML page is what should be sent to the human for review.
It should be self-contained when possible, with generated images embedded directly into the page.

The page must include:

- three platform article cards
- generated images placed inside the article at their intended positions
- title, publish time, goal
- article block flow
- image prompts
- pending approval status

Always use the fresh job id returned by `scripts/init-job.mjs`.
Do not reuse hard-coded filenames or static ids like `20260313-content-pipeline-real`.

### 6. Emit the runtime handoff artifacts

After rendering succeeds, the review package handoff is:

- `jobs/<job-id>/review.single.html`
- `jobs/<job-id>/artifacts.json`

`scripts/render-review.mjs` writes both files.

The runtime should parse `artifacts.json` and send the attachment back to the current request conversation.

Expected manifest shape:

```json
{
  "schemaVersion": 1,
  "jobId": "20260314-140334-demo",
  "theme": "示例主题",
  "generatedAt": "2026-03-14T06:20:00.000Z",
  "delivery": {
    "owner": "runtime",
    "mode": "current_request_only"
  },
  "artifacts": [
    {
      "id": "review_html",
      "kind": "html_review",
      "role": "review",
      "path": "/abs/path/jobs/<job-id>/review.single.html",
      "filename": "review.single.html",
      "mimeType": "text/html",
      "caption": "审核状态：pending",
      "selfContained": true,
      "embeddedImageCount": 3,
      "fileSizeBytes": 123456
    }
  ]
}
```

The final text reply should stay short, for example:

```text
审核包已生成，等待宿主发送审核页附件。
```

### 7. Stop and wait for approval

Do not publish yet.

Only after the human explicitly approves, update approval state:

```bash
node scripts/update-approval.mjs --draft jobs/<job-id>/draft.json --status approved --by "老板"
```

If the human rejects or asks for edits:

```bash
node scripts/update-approval.mjs --draft jobs/<job-id>/draft.json --status rejected --note "按意见重写"
```

## Review-First Policy

Before approval, you may:

- plan topics
- write drafts
- generate image prompts
- generate actual images
- assemble review HTML

Before approval, you must not:

- publish to Toutiao
- publish to Xiaohongshu
- post to X

## Platform Rules

### Toutiao

- prioritize click-through titles
- prefer information density and trend interpretation
- optimize for read depth and recommendation traffic
- prefer a strong lead paragraph, one key image near the opening, then clear section blocks

### Xiaohongshu

- write like a real note, not a newsroom article
- prefer practical lists, experience, and "I tested this" framing
- optimize for saves and comments
- images should feel lifestyle-oriented and should sit naturally between sections instead of only at the top

### X

- write shorter, sharper, and more opinionated
- only include the standalone post draft for review
- do not include reply drafts in this skill
- image placement should support the single post mood, not turn into a long-article layout

## Files

- `scripts/init-job.mjs`: create a new job scaffold
- `scripts/validate-draft.mjs`: enforce required fields
- `scripts/list-volc-image-models.mjs`: list available HuoShan image models
- `scripts/generate-images.mjs`: call Seedream and save images locally
- `scripts/query-gateway-balance.mjs`: query current user's gateway billing status and payment link
- `scripts/render-review.mjs`: build the self-contained single-file HTML review page and emit `artifacts.json`
- `scripts/deliver-review.mjs`: manual developer-only delivery helper; not part of the public skill contract
- `scripts/update-approval.mjs`: update approval state

## Operational Notes

- Keep job folders under `./jobs/`
- Prefer one job per campaign or one job per daily content batch
- If the user asks to publish immediately, still present the HTML review page first. Urgency is not approval.
- If publisher skills exist later, use this skill first and hand off only after approval



