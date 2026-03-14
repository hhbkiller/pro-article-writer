# Draft Schema

Use this schema for `jobs/<job-id>/draft.json`.

## Root

```json
{
  "jobId": "20260314-153000-user-topic",
  "theme": "用户指定主题",
  "direction": "用户指定方向",
  "brief": "用户给出的简要思路",
  "createdAt": "2026-03-14T07:30:00.000Z",
  "status": "draft",
  "approval": {
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "note": null
  },
  "research": {
    "userIntent": {
      "topic": "用户指定主题",
      "direction": "用户指定方向",
      "brief": "用户给出的简要思路"
    },
    "searchQueries": [
      "用户主题 关键词 1",
      "用户主题 关键词 2"
    ],
    "sources": [
      {
        "title": "Example source title",
        "url": "https://example.com/report",
        "publishedAt": "2026-03-13",
        "note": "Explain exactly what this source contributes to the article."
      }
    ],
    "findings": [
      "A concrete finding derived from the sources.",
      "Another concrete finding derived from the sources."
    ]
  },
  "plan": {
    "angle": "State the article's chosen angle based on the user's direction.",
    "audience": "The intended reader group",
    "promise": "What the reader should understand or gain after reading",
    "sections": [
      {
        "heading": "Section heading",
        "purpose": "What this section is doing for the article",
        "keyPoints": [
          "Key point 1",
          "Key point 2"
        ]
      }
    ],
    "imagePlan": [
      {
        "key": "image-1",
        "placement": "opening",
        "purpose": "What this image adds to the article",
        "prompt": "Prompt for image generation",
        "alt": "Image alt text",
        "caption": "Image caption"
      },
      {
        "key": "image-2",
        "placement": "middle",
        "purpose": "What this image adds to the article",
        "prompt": "Second image prompt",
        "alt": "Second image alt text",
        "caption": "Second image caption"
      }
    ]
  },
  "article": {
    "title": "Article title",
    "subtitle": "Article subtitle",
    "summary": "Summarize the article's core judgment in 1-2 sentences",
    "humanizer": {
      "required": true,
      "source": "bundled-humanizer",
      "status": "done",
      "appliedAt": "2026-03-14T07:45:00.000Z",
      "notes": [
        "Removed vague authority phrases.",
        "Tightened section transitions."
      ]
    },
    "blocks": [
      { "type": "paragraph", "text": "Opening paragraph" },
      { "type": "image", "imageKey": "image-1", "caption": "Image caption" },
      { "type": "heading", "text": "Section heading" },
      { "type": "paragraph", "text": "Body paragraph" },
      { "type": "image", "imageKey": "image-2", "caption": "Second image caption" },
      { "type": "list", "items": ["Point 1", "Point 2"] }
    ],
    "images": [
      {
        "key": "image-1",
        "prompt": "Prompt for image generation",
        "alt": "Image alt text",
        "caption": "Image caption",
        "placement": "opening",
        "purpose": "What this image adds to the article"
      },
      {
        "key": "image-2",
        "prompt": "Second image prompt",
        "alt": "Second image alt text",
        "caption": "Second image caption",
        "placement": "middle",
        "purpose": "What this image adds to the article"
      }
    ]
  },
  "notes": []
}
```

## Validation Rules

- `research.searchQueries` must contain at least 1 query.
- `research.sources` must contain at least 2 sources.
- Every source needs `title`, `url`, and `note`.
- `plan.sections` must be non-empty.
- `plan.imagePlan` must contain at least 2 image plans.
- `article.title` and `article.summary` are required.
- `article.images` must contain at least 2 images.
- `article.blocks` must contain at least 2 image blocks.
- Every `image` block must reference an existing `article.images[*].key`.
- `article.humanizer.required` must stay `true`.
- `article.humanizer.status` must be `done` before final validation passes.

## Writing Notes

- Use `blocks` as the exact reading order.
- Keep image placement intentional. Images should support argument progression, not act as decorative filler.
- Keep source notes concrete. Say what each source contributes.
