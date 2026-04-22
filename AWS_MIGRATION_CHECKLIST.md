# AWS Code Migration Checklist

Follow in order. Each item maps to a section in `AWS_CODE_MIGRATION_ROADMAP.md`.

---

## Phase 1 — Create New Backend (`lambda/`) ✅

- [x] `lambda/content.js` — GET (Scan `esc-content`) + POST (PutItem per key, Cognito auth)
- [x] `lambda/subscribers.js` — POST /subscribe (no auth), GET + DELETE (Cognito auth), calls `email.js`
- [x] `lambda/upload.js` — returns pre-signed S3 PUT URL + filePath (Cognito auth)
- [x] `lambda/uploads-list.js` — GET /uploads + DELETE /upload/:filename (Cognito auth)
- [x] `lambda/analytics-track.js` — UpdateItem with ADD, StringSet for uniqueHashes (no auth)
- [x] `lambda/analytics.js` — GET /analytics (Cognito auth)
- [x] `lambda/analytics-archive.js` — POST/GET/DELETE + EventBridge Scheduler target (Cognito auth)
- [x] `lambda/icons.js` — GET /api/icons
- [x] `lambda/save-page.js` — PutObject to `esc-website-static` S3 + CloudFront cache invalidation
- [x] `lambda/backup-restore.js` — GET /backup + POST /restore
- [x] `lambda/email.js` — shared SES `SendEmailCommand` utility, reads config from `esc-content` DynamoDB
- [x] `lambda/template.yaml` — SAM template defining all functions + API Gateway

---

## Phase 2 — Create `public/js/config.js` ✅

- [x] Create file with `API_BASE`, `UPLOADS_BASE`, and `COGNITO` (`UserPoolId`, `ClientId`) fields

---

## Phase 3 — Add `config.js` Script Tag to All HTML Files ✅

- [x] `public/index.html`
- [x] `public/admin/index.html` — also add `amazon-cognito-identity-js` CDN script tag
- [x] `public/nav-pages/blog.html`
- [x] `public/nav-pages/careers.html`
- [x] `public/nav-pages/contact-us.html`
- [x] `public/nav-pages/solutions.html`
- [x] `public/nav-pages/product-detail.html`
- [x] `public/nav-pages/blog-post.html`

---

## Phase 4 — Rewrite `public/admin/admin.js` ✅

- [x] **Auth block** — remove all login/forgot/reset `fetch` calls; replace with Cognito SDK (`authenticateUser`, `forgotPassword`, `confirmPassword`, `signOut`)
- [x] **`authenticatedFetch()`** — remove `/api/` URL guard; keep `Authorization: Bearer` header pattern
- [x] **Remove hardcoded URL constants** — `API_URL`, `UPLOAD_URL`, `LOGIN_URL`, `CHANGE_PASSWORD_URL`
- [x] **Upload functions** — replace single FormData POST with two-step pre-signed URL flow; add shared `getPresignedUploadUrl()` helper
- [x] **Account settings** — replace `fetch('/api/change-password')`, `fetch('/api/change-username')`, `fetch('/api/change-email')`, `fetch('/api/admin/profile')` with Cognito SDK equivalents
- [x] **`saveData()`** — update to `authenticatedFetch(CONFIG.API_BASE + '/content', ...)`
- [x] **All `authenticatedFetch('/api/...')` calls** — replace all 12 endpoint paths with `CONFIG.API_BASE + '/...'` equivalents
- [x] **Media `src` in HTML builders** — update `renderList`, `renderSingleSectionEditor`, `renderHeroSlides`, `renderLeaderItems`, `renderPerkItems`, `renderWhyJoinCards`, `renderOurClientsEditor` to use `CONFIG.UPLOADS_BASE`
- [x] **Remove** `?mode=reset&token=` URL param handling (replaced by Cognito verification code flow)

---

## Phase 5 — Rewrite Other Frontend Scripts ✅

- [x] `public/admin/analytics-archive.js` — update all `/api/analytics/archives` + `/api/analytics/archive/...` fetches to `CONFIG.API_BASE`; add `Authorization` header
- [x] `public/scripts/analytics.js` — update `fetch('/api/analytics/track')` to `CONFIG.API_BASE + '/analytics/track'`
- [x] `public/scripts/main-script.js` — check/update any content data references (no API calls found — pure UI)
- [x] `public/scripts/hero-slider.js` — check/update any content data references (no API calls found — pure UI)
- [x] `public/scripts/solution-cards.js` — check/update any content data references (no API calls found — pure UI)
- [x] `public/scripts/testimonials-slider.js` — check/update any content data references (no API calls found — pure UI)
- [x] `public/scripts/stats-animation.js` — check/update any content data references (no API calls found — pure UI)
- [x] `public/js/utils.js` — update `API_CONTENT_URL` to use `CONFIG.API_BASE + '/content'`
- [x] `public/scripts/hero-image-slider.js` — update `/api/content` fetch to `CONFIG.API_BASE`
- [x] `public/scripts/chat-ai.js` — update `/api/content` fetch to `CONFIG.API_BASE`
- [x] `public/nav-pages/blog.html` inline script — update `/api/content` + `/api/subscribe` fetches
- [x] `public/nav-pages/careers.html` inline script — update `/api/content` fetch
- [x] `public/nav-pages/contact-us.html` inline script — update `/api/content` fetch
- [x] `public/nav-pages/solutions.html` inline script — update `/api/content` fetch
- [x] `public/nav-pages/product-detail.html` inline script — update `/api/content` fetch
- [x] `public/nav-pages/blog-post.html` inline script — update `/api/content` + `/api/subscribe` fetches
- [x] `public/nav-pages/company.html` inline script — update `/api/content` fetch
- [x] `public/index.html` — fix `config.js` script load order (no inline fetches; content loaded via `utils.js`)
- [x] `public/admin/index.html` — fix `config.js` script load order (before `admin.js` and `analytics-archive.js`)

---

## Phase 6 — Delete Legacy Files ✅

- [x] `server.js`
- [x] `services/emailService.js`
- [x] `data/credentials.json`
- [x] `data/sessions.json`
- [x] `data/reset-tokens.json`
- [x] `data/content.json`
- [x] `data/subscribers.json`
- [x] `data/analytics.json`
- [x] `data/analytics-archives.json`
- [x] `package.json` + `package-lock.json`
- [x] `env/env` + `.env.example`
- [x] `api/timeline.js` (replaced by `lambda/content.js`)
- [x] `node_modules/` (cleaned up)
- [x] Empty directories removed: `services/`, `data/`, `env/`, `api/`

---

## Phase 7 — Deploy & Validate

- [ ] Deploy Lambda functions + API Gateway (SAM deploy)
- [ ] Update `config.js` with real `API_BASE` and `UPLOADS_BASE` URLs
- [ ] Deploy frontend to S3
- [ ] End-to-end test (auth, uploads, content save, analytics, subscribe)
- [ ] Run data migration (JSON → DynamoDB)
- [ ] Cut over DNS to CloudFront
