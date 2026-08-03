# TikTok post customization

**Date:** 2026-08-03
**Status:** stage 1 approved and building; stage 2 specced, not started

## Problem

A scheduled post carries one `caption`. `publishTikTokPhoto` derives *both* TikTok
fields from it:

```js
const title = (caption || '').slice(0, 90);
const description = (caption || '').slice(0, 4000);
```

So the title is the first 90 characters of the caption. TikTok shows the title on
the post and the description as its body — they want different text, and today
you cannot write them separately.

Everything else TikTok accepts (privacy, comments, commercial disclosure) is
hardcoded.

## Field reference

Confirmed against TikTok's photo-post API reference on 2026-08-03, not from
memory — the field names differ between video and photo posts, and guessing here
is how payloads get silently rejected.

`post_info` for a PHOTO direct post:

| Field | Notes |
|---|---|
| `title` | max **90** UTF-16 runes for photos |
| `description` | max **4000** UTF-16 runes |
| `privacy_level` | `PUBLIC_TO_EVERYONE`, `MUTUAL_FOLLOW_FRIENDS`, `FOLLOWER_OF_CREATOR`, `SELF_ONLY` — must match one of *the creator's* options |
| `disable_comment` | boolean |
| `auto_add_music` | boolean, photo-only |
| `brand_content_toggle` | paid partnership |
| `brand_organic_toggle` | creator promoting their own business |

`source_info`: `source` must be `PULL_FROM_URL` (FILE_UPLOAD is video-only),
`photo_images` (up to 35 URLs), `photo_cover_index`.

Video-only and NOT valid for photos: `disable_duet`, `disable_stitch`,
`video_cover_timestamp_ms`, `music_id`, `music_platform`.

## Stage 1 — data model and separate title (this change)

### Schema (migration 062)

```sql
alter table content_posts add column title text;
alter table content_posts add column options jsonb not null default '{}'::jsonb;
```

Both optional, so every existing row stays valid. `content_posts` has
table-level grants and **no column ACLs** (verified against `pg_class.relacl` and
`pg_attribute.attacl`), so new columns are client-writable automatically — unlike
`brands`, where a new column must be added to the `grant update`/`grant insert`
lists or the save fails with a permission error.

`title` is a real column because YouTube and Pinterest have titles too and the
calendar will want to display one. The TikTok-only toggles live in `options`
because they are written once and read at publish, never queried.

### Composer

- **Title** — optional, 90-character counter, shown for every platform.
- **Caption / Description** — unchanged, gains a 4000-character counter.

### Publish path

```js
publishTikTokPhoto(token, { title, caption, mediaUrl, options })
```

- `title = post.title || caption.slice(0, 90)` — existing posts behave exactly as
  they do today, which is what makes this migration safe to apply to live data.
- `description = caption`
- `disable_comment` and the brand toggles read from `options`, defaulting to the
  TikTok-safe values (comments on, both disclosures off).

### The privacy clamp

**Privacy is resolved server-side and never trusted from the client.** The
request may express a preference, but the backend sends nothing wider than
`TIKTOK_PRIVACY_LEVEL` permits (default `SELF_ONLY`). An unaudited client that
asks for `PUBLIC_TO_EVERYONE` gets the call rejected by TikTok outright, and
letting the browser decide what visibility a post gets is the same class of
mistake as the client-writable `plan_tier` this codebase already closed.

### Out of scope for stage 1

No privacy selector in the UI. While unaudited the only reachable value is
`SELF_ONLY`, and offering a dropdown whose other options always fail is exactly
the dishonesty this project avoids. The selector arrives with stage 2, when it
can tell the truth.

## Stage 2 — audit-compliant "Post to TikTok" page (not started)

Required to lift `SELF_ONLY` and post publicly. Sourced from TikTok's Content
Sharing Guidelines on 2026-08-03.

1. **Creator Info query is mandatory.** `/v2/post/publish/creator_info/query/`
   must be called *each time* the post page renders, and the creator's nickname
   shown. No such endpoint exists in `api/index.js` today.
2. **Privacy dropdown with no preselected value.** The user must actively choose,
   and the options must come from what Creator Info returns — not a hardcoded
   list.
3. **Commercial disclosure toggle, off by default.** Enabling it forces a choice:
   *Your Brand* → content labelled "Promotional content"; *Branded Content* →
   labelled "Paid partnership".
4. **Interlock:** branded content may not be private. `SELF_ONLY` must be
   disabled, with a tooltip explaining why.
5. **Content preview** before publishing.
6. **Music Usage Confirmation / Branded Content Policy** declarations.
7. **Tell the user publishing takes time** — the publish is asynchronous.

### The bind

Requirements 2 and 4 cannot be satisfied honestly while unaudited: every post
must currently be `SELF_ONLY`, yet the guidelines require free choice and forbid
private for branded content. The resolution is that the compliant UI is built in
order to *pass* the audit, and becomes truthful the moment it does. Until then
the clamp keeps the actual request legal.

### Why it is separate

It needs a connected TikTok account to exercise, and none is connected yet.
Building it now would mean shipping a compliance flow that could not be verified
end to end — and a compliance flow nobody has run is not evidence of compliance.

## Verification plan

Stage 1: apply 062, then confirm a post round-trips `title` and `options` through
the composer into `content_posts` (checked in Postgres, not in the UI), that the
built payload carries the separate values, and that a post saved before the
migration still publishes with the old fallback behaviour.

Publishing to TikTok itself stays untested until an account is connected and the
domain is verified. That will be stated plainly rather than implied.
