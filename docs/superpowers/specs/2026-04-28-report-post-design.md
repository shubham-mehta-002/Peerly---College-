# Report Post — Design Spec

**Date:** 2026-04-28  
**Status:** Approved

## Problem

Users have no way to flag problematic posts. Admins have no moderation tooling. Posts with spam, harassment, or inappropriate content remain visible with no recourse.

## Goals

- Any logged-in user can report a post with a fixed reason + optional custom text
- One report per user per post (enforced at DB level)
- Admin panel shows all reported posts sorted by report count, filterable by reason
- Admin can hide a post; hidden posts disappear from feeds and show "Removed by admin" on direct URL
- Reporter sees a persistent "Reported" badge on posts they have reported

## Out of Scope

- Unhiding posts (admin action is final for now)
- Reporting comments
- Email notifications to admins
- Auto-hide on threshold

---

## Database

### Changes to `posts` table

```sql
ALTER TABLE posts ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN report_count INT NOT NULL DEFAULT 0;
```

### New `post_reports` table

```sql
CREATE TABLE post_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('spam','harassment','misinformation','inappropriate','other')),
  custom_text TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
```

**Invariants:**
- `UNIQUE (post_id, reporter_id)` — DB-level dedup, returns 409 on duplicate
- `custom_text` only populated when `reason = 'other'`
- `posts.report_count` incremented atomically on each new report
- `ON DELETE CASCADE` — reports cleaned up if post is deleted

---

## Backend

### New module: `peerly-backend/src/modules/reports/`

| File | Responsibility |
|---|---|
| `reports.types.ts` | Zod `ReportPostSchema`, `AdminReportsQuerySchema`, TypeScript interfaces |
| `reports.service.ts` | `createReport()`, `getAdminReports()`, `hidePost()` |
| `reports.controller.ts` | Request handlers |
| `reports.router.ts` | Route definitions |

### User endpoint

```
POST /api/posts/:id/report
  Auth: any authenticated user
  Body: { reason: 'spam'|'harassment'|'misinformation'|'inappropriate'|'other', custom_text?: string }
  → INSERT into post_reports
  → UPDATE posts SET report_count = report_count + 1
  → 404 if post not found
  → 409 if already reported (UNIQUE constraint violation)
  → 200 { success: true }
```

Validation: `custom_text` required when `reason === 'other'`.

### Admin endpoints

```
GET /api/admin/reports
  Auth: requireAdmin
  Query: ?reason=spam&page=1&limit=20
  → SELECT posts WHERE report_count > 0 ORDER BY report_count DESC
  → Optional filter: WHERE post_reports.reason = ?
  → Returns: PostReportSummary[]

PATCH /api/admin/posts/:id/hide
  Auth: requireAdmin
  → UPDATE posts SET is_hidden = true WHERE id = ?
  → 404 if post not found
  → 200 { success: true }
```

### `PostReportSummary` shape

```ts
interface PostReportSummary {
  id: string;
  content: string;
  display_author: DisplayAuthor;
  created_at: string;
  report_count: number;
  is_hidden: boolean;
  reason_breakdown: Record<string, number>; // { spam: 3, harassment: 1 }
}
```

### Changes to existing `PostResponse`

Add two fields:
```ts
is_hidden: boolean;
user_has_reported: boolean;
```

`user_has_reported` — LEFT JOIN on `post_reports` for current user's ID.

### Feed filtering

All feed queries in `posts.service.ts` (campus feed, global feed) gain `.eq('is_hidden', false)`.

`getPost()` still returns hidden posts (so detail page can show the "Removed" message), but `is_hidden` is included in the response.

---

## Frontend

### New files

| File | Responsibility |
|---|---|
| `components/ui/report-modal.tsx` | Shared report modal with reason radios + custom text |
| `lib/hooks/useReports.ts` | `useReportPost()`, `useAdminReports()`, `useHidePost()` hooks |

### Modified files

| File | Change |
|---|---|
| `components/post-card.tsx` | Add ⋯ menu with "Report" option; show "Reported" badge when `user_has_reported` |
| `app/posts/[id]/page.tsx` | Add ⋯ menu with "Report"; show "Removed by admin" when `is_hidden`; "Reported" badge |
| `app/admin/page.tsx` | Add "Reports" tab alongside "Colleges" |
| `lib/hooks/useFeed.ts` | Add `is_hidden` and `user_has_reported` to `PostResponse` type |

### Report modal

- 4 reason radio buttons: Spam / Harassment / Misinformation / Inappropriate content
- "Other" radio + `<textarea>` (required, min 1 char when selected)
- Submit / Cancel buttons
- On success: toast notification, modal closes, `user_has_reported` updated via query invalidation

### "Reported" badge

When `user_has_reported === true`:
- Small muted "Reported" badge visible on post card and detail
- Report option in ⋯ menu is disabled/replaced with "Already reported"

### "Removed by admin" state

In `app/posts/[id]/page.tsx`: if `post.is_hidden === true`, render centered message:
> *"This post has been removed by an admin."*
instead of post content. No 404.

### Admin Reports tab

New tab "Reports" in `app/admin/page.tsx`:
- Reason filter dropdown (All / Spam / Harassment / Misinformation / Inappropriate / Other)
- Table rows: post preview (truncated) · author · report count · reason breakdown chips · hidden status badge
- "Hide post" button per row — disabled + shows "Hidden" when already hidden
- Sorted by `report_count DESC` (server-side, no client re-sort needed)
- Pagination: 20 per page

---

## Reason Values

| Value | Display label |
|---|---|
| `spam` | Spam |
| `harassment` | Harassment |
| `misinformation` | Misinformation |
| `inappropriate` | Inappropriate content |
| `other` | Other (requires text) |
