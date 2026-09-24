# Q&A attachments (images + files) — plan

Status: draft for review · Date: 2026-09-24

## Decisions (confirmed)
- Display: thumbnail gallery **below the body** (same pattern as evidence), tap to open. Markdown is unchanged.
- Scope: **questions and teacher answers** (not clarifications).
- Limits: same as evidence: **max 5 per post, ≤ 25 MB each**, JPG/PNG/WebP, PDF, ZIP, TXT, MD.
- Storage: **new bucket `qa`** (fileSecurity on, `create("users")`, 25 MB, same extensions).

## Backend
1. **Upload purpose `qa`** (`contracts/api.ts` UploadPurpose, `schemas` uploadIntent enum, `services/uploads.ts` LIMITS + bucket choice).
   - No relation needed. Visibility on complete: `read(Role.users())` (Q&A is login-only), `delete(Role.user(owner))`.
   - Views still go through short-lived file tokens (`resolveAttachments`), so removed content stops resolving.
2. **Config**: `APPWRITE_QA_BUCKET_ID` (default `qa`) in `config.ts`, API function vars, `.env.example`.
3. **Schema** (`appwrite.config.json` + `backend/src/db/schema.ts`/`rows.ts` in sync):
   - `qa_questions.attachmentFileIds` varchar(36) array, optional.
   - `qa_answers.attachmentFileIds` varchar(36) array, optional.
4. **API**
   - `createQaQuestion` / `updateQaQuestion`: `attachmentFileIds?: string[] (max 5)`.
   - Answer create/edit (`qaBody` → new `qaAnswerBody`): `body` + `attachmentFileIds?` (clarifications keep `qaBody`).
   - Validation `assertQaAttachments(userId, ids)`: completed intents, owner = author, purpose `qa`; deduped, ≤ 5.
   - Question detail returns `attachments: Attachment[]` on the question and each answer (`resolveAttachments`). Lists/cards return `attachmentCount` only (no token minting in lists).
   - Edit replaces the list; files dropped by an edit are deleted from storage (best effort).
5. **Moderation / retention**
   - Report resolve `remove_content` on a question/answer also clears `attachmentFileIds` and deletes the files.
   - Retention purge: delete `qa` uploads that were completed but never attached after 24 h (orphans from abandoned drafts). Needs an `attached` marker: set intent `status: 'attached'` when bound to a post.
6. **Tests**: uploads (qa purpose, perms), qa routes (attach on create/edit/answer, reject others' files / wrong purpose / > 5), retention orphan purge, check-schema.

## Frontend
1. `infrastructure/uploads`: `UPLOAD_LIMITS.qa`, `uploadFile('qa', …)` (no relation).
2. `shared/ui/attachments.tsx`: generalise `AttachmentPicker` → props `purpose`, `relationId?`, `variant: 'full' | 'compact'`; strings moved to neutral `attachments.*` keys (evidence keeps working).
   - Existing attachments when editing appear as done items (from `Attachment`).
3. **Layout of the buttons (responsive)**
   - Buttons live in a **composer action bar directly under the Details field**: `[🖼 Image] [📎 File]` left, `n/5 · limits` right.
   - Phone: icon + short label, 44 pt touch targets; the bar wraps under the field; uploaded items show as a horizontal strip of 64 px thumbnails / file chips with progress and ×.
   - Tablet/desktop: same bar, items in a wrapping grid; on desktop (editor | preview split) the preview card shows the gallery live.
   - STEM topics: the LaTeX toolbar stays **above** Details, the attachment bar **below**, so they never compete for the same row.
   - Answer composer (`qa/[id].tsx`): compact variant (icon-only buttons with accessibility labels) next to Cancel/Submit.
   - Submit is disabled while any upload is in progress; failed items show red with retry/remove.
4. Detail page: `AttachmentList` under the question body and under each answer body. Question cards show a small “📎 n” badge when `attachmentCount > 0`.
5. i18n (en.ts): `attachments.*` (addImage, addFile, uploading, failed, hint, count).

## Rollout (needs your confirmation at each cloud step)
1. Code + tests locally (`npm run check`, backend tests, `build:web`).
2. Cloud: create bucket `qa`, add columns (ensure-tables), push API var `APPWRITE_QA_BUCKET_ID`, deploy API + purge function.
3. Commit + push → Vercel deploy.

## Out of scope
Inline images in Markdown, attachments on clarifications, image editing/cropping, virus scanning.
