# social-content-pipeline

Review-first content generation skill for Toutiao, Xiaohongshu, and X.

This template generates:

- platform-specific draft content
- image prompts and generated images
- a self-contained `review.single.html`
- an `artifacts.json` manifest for runtime-owned attachment delivery

It does not publish content and it does not send chat attachments by itself.

## Contract

The skill owns content generation.

The runtime owns delivery.

After a successful run, the job directory contains:

- `draft.json`
- `review.single.html`
- `artifacts.json`
- `images/`

`artifacts.json` is the machine-readable handoff for the host application. The host should read it and send the HTML attachment back to the current request conversation.

## Install

Copy or symlink this folder into your OpenClaw skills directory, for example:

```bash
ln -s /path/to/social-content-pipeline ~/.openclaw/skills/social-content-pipeline
```

## Workflow

1. Initialize a job

```bash
node scripts/init-job.mjs --root ./jobs --theme "AI 自动化" --platforms toutiao,xiaohongshu,x
```

2. Fill `draft.json`

3. Validate the draft

```bash
node scripts/validate-draft.mjs --draft jobs/<job-id>/draft.json
```

4. Generate images

Gateway mode:

```bash
node scripts/generate-images.mjs --draft jobs/<job-id>/draft.json
```

Direct provider mode:

```bash
node scripts/generate-images.mjs --draft jobs/<job-id>/draft.json --direct --env-file /path/to/.env
```

5. Render the final review package

```bash
node scripts/render-review.mjs --draft jobs/<job-id>/draft.json --out jobs/<job-id>/review.single.html
```

This writes both `review.single.html` and `artifacts.json`.

## Artifact Manifest

Example:

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

## Runtime Requirements

To avoid wrong delivery targets, the host must send artifacts using the current request context only.

Do not:

- scan historical sessions
- pick the latest active session
- infer delivery targets across agents

Do:

- bind delivery to the current chat/channel/request
- read `artifacts.json`
- send the attachment from the runtime layer

## Notes

- `jobs/` is ignored by git
- image generation defaults to the managed relay gateway
- direct image provider mode is for developer debugging only
