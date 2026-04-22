# Code Migration Roadmap — eScience Website (AWS Rewrite)

This document covers every file that must be created, rewritten, or deleted when migrating the codebase to AWS. Reference `AWS_MIGRATION_ROADMAP.md` for the infrastructure setup that must be completed before executing any step here.

---

## Files to Delete Entirely

These files have no AWS equivalent and should be removed:

| File | Reason |
|---|---|
| `server.js` | Replaced entirely by Lambda functions + API Gateway |
| `services/emailService.js` | Replaced by SES via AWS SDK v3 |
| `data/credentials.json` | Replaced by Cognito User Pool |
| `data/sessions.json` | Replaced by Cognito session management |
| `data/reset-tokens.json` | Replaced by Cognito `ForgotPassword` flow + DynamoDB TTL |
| `data/content.json` | Migrated to DynamoDB (`esc-content`) |
| `data/subscribers.json` | Migrated to DynamoDB (`esc-subscribers`) |
| `data/analytics.json` | Migrated to DynamoDB (`esc-analytics`) |
| `data/analytics-archives.json` | Migrated to DynamoDB (`esc-analytics-archives`) |
| `package.json` / `package-lock.json` | Node.js server dependencies no longer needed for the frontend |
| `npm` | Not needed |
| `env/env` / `.env.example` | Replaced by Lambda environment variables and Secrets Manager |

---

## New Files to Create

### `public/js/config.js`

Single source of truth for all API and media URLs. Every script in the project must import from here instead of using hardcoded paths.

```js
const CONFIG = {
  API_BASE: 'https://<your-cloudfront-domain>/api',
  UPLOADS_BASE: 'https://<your-cdn-domain>/uploads',
};
```

- Replace every hardcoded `/api/...` fetch path across all scripts with `CONFIG.API_BASE + '/...'`
- Replace every hardcoded `uploads/filename` image/video `src` with `CONFIG.UPLOADS_BASE + '/filename'`

---

### `lambda/` directory (new backend)

Create one Lambda handler file per resource group. Each handler uses the **AWS SDK v3** (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-ses`, `@aws-sdk/client-cognito-identity-provider`).

```
lambda/
  content.js          ← GET + POST /api/content
  subscribers.js      ← POST/GET/DELETE /api/subscribers
  upload.js           ← POST /api/upload (returns pre-signed URL)
  uploads-list.js     ← GET /api/uploads + DELETE /api/upload/:filename
  analytics-track.js  ← POST /api/analytics/track
  analytics.js        ← GET /api/analytics
  analytics-archive.js← POST/GET/DELETE /api/analytics/archive(s)
  icons.js            ← GET /api/icons
  save-page.js        ← POST /api/save-page
  backup-restore.js   ← GET /api/backup + POST /api/restore
  email.js            ← shared SES utility (not a Lambda handler, imported by others)
  template.yaml       ← AWS SAM template defining all functions + API Gateway
```

Key implementation notes per handler:

**`content.js`**
- `GET`: `Scan` the `esc-content` table, reconstruct the full content object by merging all items keyed by `sectionKey`
- `POST`: Split the incoming JSON body by top-level key, `PutItem` each one separately. Requires Cognito authorizer.

**`subscribers.js`**
- `POST /subscribe`: `PutItem` with `email` + `date`. Call `email.js` SES utility for welcome email. No auth required.
- `GET /subscribers`: `Scan` table. Cognito authorizer required.
- `DELETE /subscribers`: `DeleteItem` by `email`. Cognito authorizer required.

**`upload.js`**
- Does NOT receive the file. Generates a **pre-signed S3 PUT URL** using `@aws-sdk/s3-request-presigner` and returns it to the frontend. The frontend then PUTs the file directly to S3.
- Returns `{ uploadUrl, filePath }` where `filePath` is the key in the `esc-uploads` bucket.
- Cognito authorizer required.

**`analytics-track.js`**
- Uses `UpdateItem` with `ADD` expressions to atomically increment counters.
- Stores `uniqueHashes` as a DynamoDB `StringSet` to avoid double-counting.
- No auth required.

**`analytics-archive.js`**
- Monthly archive trigger: also registered as an **EventBridge Scheduler** target (replaces `node-cron`).

**`email.js`** (shared utility, not a handler)
- Replaces `services/emailService.js`
- Uses `@aws-sdk/client-ses` `SendEmailCommand`
- Reads email template settings from DynamoDB (`esc-content` table, `sectionKey = 'blogPage'`) instead of reading `content.json` from disk
- No SMTP credentials — SES handles delivery

---

## Files to Rewrite

### `public/js/config.js` ← NEW (see above)

---

### `public/admin/admin.js`

This is the largest rewrite. The file has three distinct concerns that each need updating:

**1. Authentication block (lines ~1–250 of the login/auth section)**

Remove:
- All `fetch(LOGIN_URL, ...)` calls
- All `fetch('/api/forgot-password', ...)` calls
- All `fetch('/api/reset-password', ...)` calls
- `localStorage.setItem('adminToken', data.token)` pattern
- `getAuthHeaders()` and `authenticatedFetch()` helper functions

Replace with:
- Import `amazon-cognito-identity-js` via CDN script tag in `admin/index.html`
- Create a `CognitoUserPool` instance using the User Pool ID and App Client ID from `config.js`
- `signIn(username, password)` → `cognitoUser.authenticateUser(authDetails, callbacks)`
- On success, store the `IdToken` from the session: `localStorage.setItem('adminToken', session.getIdToken().getJwtToken())`
- `forgotPassword` → `cognitoUser.forgotPassword(callbacks)` — no API call needed
- `confirmPassword` (reset) → `cognitoUser.confirmPassword(verificationCode, newPassword, callbacks)` — no API call needed
- `signOut` → `cognitoUser.signOut()` then clear localStorage

Update `authenticatedFetch()`:
- Keep the function signature but remove the `/api/` URL validation guard (API Gateway URL will be a full domain)
- The `Authorization: Bearer <token>` header pattern stays the same — Cognito `IdToken` is a JWT and API Gateway's Cognito authorizer validates it directly

**2. Upload flow (all `uploadImage`, `uploadProductImage`, `uploadVideo`, `handleFamilyCultureImageUpload`, etc.)**

Every upload function currently does:
```js
const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData, headers: { Authorization } });
const data = await res.json();
// data.filePath is the result
```

Replace with a two-step flow:
```js
// Step 1: Get pre-signed URL from Lambda
const { uploadUrl, filePath } = await getPresignedUploadUrl(file.name, file.type);

// Step 2: PUT directly to S3
await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });

// filePath is now the S3 key — prepend CONFIG.UPLOADS_BASE for display
```

Create a shared helper `getPresignedUploadUrl(filename, contentType)` that calls `CONFIG.API_BASE + '/upload'` with the Cognito token.

**3. Account settings section**

Remove:
- `fetch('/api/change-password', ...)` → replace with `cognitoUser.changePassword(oldPass, newPass, callback)`
- `fetch('/api/change-username', ...)` → replace with `cognitoUser.updateAttributes([{ Name: 'preferred_username', Value: newUsername }], callback)`
- `fetch('/api/change-email', ...)` → replace with `cognitoUser.updateAttributes([{ Name: 'email', Value: newEmail }], callback)` — note: Cognito will send a verification code to the new email
- `fetch('/api/admin/profile', ...)` → replace with `cognitoUser.getUserAttributes(callback)` to populate the profile form

**4. API URL constants at the top of the file**

Remove:
```js
const API_URL = '/api/content';
const UPLOAD_URL = '/api/upload';
const LOGIN_URL = '/api/login';
const CHANGE_PASSWORD_URL = '/api/change-password';
```

Replace with references to `CONFIG.API_BASE` from `config.js`.

**5. `saveData()` function**

The function body stays the same except:
- Change `authenticatedFetch(API_URL, ...)` to `authenticatedFetch(CONFIG.API_BASE + '/content', ...)`

**6. `renderDashboard()` and all `authenticatedFetch('/api/...')` calls**

Do a project-wide find-and-replace:
- `/api/content` → `CONFIG.API_BASE + '/content'`
- `/api/analytics` → `CONFIG.API_BASE + '/analytics'`
- `/api/subscribers` → `CONFIG.API_BASE + '/subscribers'`
- `/api/upload` → `CONFIG.API_BASE + '/upload'`
- `/api/uploads` → `CONFIG.API_BASE + '/uploads'`
- `/api/backup` → `CONFIG.API_BASE + '/backup'`
- `/api/restore` → `CONFIG.API_BASE + '/restore'`
- `/api/save-page` → `CONFIG.API_BASE + '/save-page'`
- `/api/icons` → `CONFIG.API_BASE + '/icons'`
- `/api/analytics/track` → `CONFIG.API_BASE + '/analytics/track'`
- `/api/analytics/archive` → `CONFIG.API_BASE + '/analytics/archive'`
- `/api/analytics/archives` → `CONFIG.API_BASE + '/analytics/archives'`

**7. Media `src` references in rendered HTML**

Every place in `admin.js` that constructs an `<img src="/${filePath}">` or `<video src="/${filePath}">` must change to:
```js
`<img src="${CONFIG.UPLOADS_BASE}/${filePath}">`
```
This affects: `renderList`, `renderSingleSectionEditor`, `renderHeroSlides`, `renderLeaderItems`, `renderPerkItems`, `renderWhyJoinCards`, `renderOurClientsEditor`, and all other inline HTML builders.

---

### `public/admin/analytics-archive.js`

- Replace all `fetch('/api/analytics/archives', ...)` calls with `CONFIG.API_BASE + '/analytics/archives'`
- Replace all `fetch('/api/analytics/archive/...')` calls similarly
- Add `Authorization: Bearer ${localStorage.getItem('adminToken')}` header to all requests (same pattern as `admin.js`)

---

### `public/scripts/analytics.js`

- Replace `fetch('/api/analytics/track', ...)` with `fetch(CONFIG.API_BASE + '/analytics/track', ...)`
- No auth header needed (this endpoint is public)

---

### `public/scripts/main-script.js`

- Replace `fetch('/api/content')` with `fetch(CONFIG.API_BASE + '/content')`
- Replace all `uploads/filename` image `src` values that are dynamically set from content data with `CONFIG.UPLOADS_BASE + '/filename'`

---

### All other frontend scripts that call `/api/content`

Do a project-wide search for `fetch('/api/` and update every occurrence. Files likely affected:

| File | What changes |
|---|---|
| `public/scripts/main-script.js` | `/api/content` fetch |
| `public/scripts/hero-slider.js` | May reference content data |
| `public/scripts/solution-cards.js` | May reference content data |
| `public/scripts/testimonials-slider.js` | May reference content data |
| `public/scripts/stats-animation.js` | May reference content data |
| `public/nav-pages/blog.html` (inline script) | `/api/content` fetch |
| `public/nav-pages/careers.html` (inline script) | `/api/content` fetch |
| `public/nav-pages/contact-us.html` (inline script) | `/api/content` fetch, `/api/subscribe` |
| `public/nav-pages/solutions.html` (inline script) | `/api/content` fetch |
| `public/nav-pages/product-detail.html` (inline script) | `/api/content` fetch |
| `public/nav-pages/blog-post.html` (inline script) | `/api/content` fetch |
| `public/index.html` (inline script) | `/api/content` fetch, `/api/subscribe` |
| `api/timeline.js` | `/api/content` fetch — this file can be deleted and replaced by the Lambda |

---

### `public/admin/index.html`

Add the following script tags before the closing `</body>`:

```html
<!-- Cognito SDK -->
<script src="https://cdn.jsdelivr.net/npm/amazon-cognito-identity-js/dist/amazon-cognito-identity.min.js"></script>
<!-- Site config (API base URL, uploads URL, Cognito pool config) -->
<script src="../js/config.js"></script>
```

Add Cognito pool config to `config.js`:
```js
const CONFIG = {
  API_BASE: 'https://<cloudfront-domain>/api',
  UPLOADS_BASE: 'https://<cdn-domain>/uploads',
  COGNITO: {
    UserPoolId: 'ap-southeast-1_XXXXXXXXX',
    ClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  },
};
```

Remove the existing password reset URL param handling (`?mode=reset&token=...`) from `admin.js` — Cognito's hosted UI or SDK handles this natively via a verification code flow instead of a URL token.

---

### `public/index.html` and all nav-pages HTML files

Add to `<head>` or before `</body>`:
```html
<script src="/js/config.js"></script>
```

Update the newsletter subscribe form handler (currently posts to `/api/subscribe`) to use `CONFIG.API_BASE + '/subscribe'`.

---

## Files That Do NOT Need Changes

These files are purely presentational and have no API dependencies:

- `public/styles.css`
- `public/browser-fixes.css`
- `public/admin/admin-style.css`
- `public/assets/**` (all icons, images, logos)
- `public/robots.txt`
- `public/sitemap.xml`
- `public/scripts/page-transition.js`
- `public/scripts/mobile-nav.js`
- `public/scripts/nav-dropdown.js`
- `public/scripts/nav-state-manager.js`
- `public/scripts/section-scroll-animation.js`
- `public/scripts/hero-image-slider.js`
- `public/scripts/chat-ai.js`

---

## Execution Order

Follow this order to avoid breaking the site mid-migration:

1. **Create `lambda/` directory** and write all Lambda handlers (backend first, nothing breaks yet)
2. **Create `public/js/config.js`** with placeholder URLs
3. **Add `config.js` script tag** to all HTML files
4. **Rewrite `admin.js` auth block** — swap JWT localStorage for Cognito SDK
5. **Rewrite all upload functions** in `admin.js` — swap FormData POST for pre-signed URL flow
6. **Update all `fetch('/api/...')` calls** across all scripts to use `CONFIG.API_BASE`
7. **Update all media `src` references** to use `CONFIG.UPLOADS_BASE`
8. **Deploy Lambda + API Gateway** (Phase 2 & 3 of infrastructure roadmap)
9. **Update `config.js`** with real API Gateway / CloudFront URLs
10. **Deploy frontend to S3** and test end-to-end
11. **Run data migration** (Phase 6 of infrastructure roadmap)
12. **Cut over DNS** to CloudFront

---

## Key Behavioural Differences After Migration

| Behaviour | Before | After |
|---|---|---|
| File uploads | Server receives file, saves to `public/uploads/` | Browser PUTs file directly to S3 via pre-signed URL |
| Media URLs in content | Relative path `uploads/filename.ext` | Full CDN URL `https://cdn.domain/uploads/filename.ext` |
| Admin login | POST to `/api/login`, receive JWT | Cognito `authenticateUser()`, receive `IdToken` |
| Password reset | Email link with token in URL query param | Cognito sends 6-digit verification code to email |
| Monthly analytics archive | `node-cron` inside the running server process | EventBridge Scheduler triggers Lambda independently |
| Email sending | Nodemailer via Gmail SMTP | SES `SendEmailCommand` — no SMTP credentials |
| `save-page` (careers/blog/contact HTML) | Writes file to disk on the server | `PutObject` to `esc-website-static` S3 bucket, then CloudFront cache invalidation |
| Session persistence | JWT in `localStorage` (24h expiry) | Cognito `IdToken` in `localStorage` (1h, auto-refreshed via `RefreshToken`) |
