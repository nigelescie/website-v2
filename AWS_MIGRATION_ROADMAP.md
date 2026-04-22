# AWS Migration Roadmap — eScience Website

## Architecture Overview

```
Browser → CloudFront (ACM cert) → S3 (static HTML/CSS/JS/assets)
                                → API Gateway → Lambda functions
                                                     ↓
                                              DynamoDB tables
                                              S3 uploads bucket
                                              Cognito (admin auth)
                                              SES (email)
```

---

## Phase 1 — AWS Infrastructure Setup

### 1.1 — DynamoDB Tables

Create 5 tables to replace the 5 JSON files in `/data`:

| Table Name | Partition Key | Notes |
|---|---|---|
| `esc-content` | `sectionKey` (String) | One item per top-level key in `content.json` |
| `esc-subscribers` | `email` (String) | Direct 1:1 migration from `subscribers.json` |
| `esc-analytics` | `date` (String) | Daily stats; add a `type` sort key (`current` / `archive`) |
| `esc-analytics-archives` | `archiveId` (String) | Replaces `analytics-archives.json` |
| `esc-reset-tokens` | `token` (String) | Add TTL attribute `expiresAt` for auto-expiry |

> `credentials.json` and `sessions.json` are fully replaced by Cognito — no DynamoDB table needed for them.

---

### 1.2 — Amazon Cognito

- Create a **User Pool** with a single admin user (replaces `credentials.json`)
- Enable **email-based password reset** (replaces `/api/forgot-password` + `/api/reset-password` + `reset-tokens.json`)
- Create an **App Client** (no client secret) for the SPA admin panel
- The admin panel's JWT auth flow becomes: `CognitoHostedUI` or `amazon-cognito-identity-js` SDK → returns `IdToken` → passed as `Authorization` header to API Gateway

---

### 1.3 — S3 Buckets

- `esc-website-static` — public static hosting for `/public/**`
- `esc-uploads` — private bucket for user-uploaded media (replaces `public/uploads/`), accessed via **pre-signed URLs** or CloudFront with OAC

---

### 1.4 — CloudFront + ACM

- Distribution origin: `esc-website-static` S3 bucket
- Second origin: API Gateway URL (path pattern `/api/*`)
- Request ACM certificate for `electronicscience.com` in `us-east-1`
- Enable HTTPS redirect, set default root object to `index.html`
- Add custom error response: 403/404 → `/index.html` (for SPA routing)

---

## Phase 2 — Lambda Functions

Replace every Express route in `server.js` with individual Lambda handlers, grouped by resource.

### Content
| Method | Route | Auth | Action |
|---|---|---|---|
| `GET` | `/api/content` | None | Read all items from `esc-content`, assemble into single JSON object |
| `POST` | `/api/content` | Cognito | Write each top-level key as a separate DynamoDB item |

### Subscribers
| Method | Route | Auth | Action |
|---|---|---|---|
| `POST` | `/api/subscribe` | None | `PutItem` to `esc-subscribers`, trigger SES welcome email |
| `GET` | `/api/subscribers` | Cognito | `Scan` `esc-subscribers` |
| `DELETE` | `/api/subscribers` | Cognito | `DeleteItem` by email |

### Uploads
| Method | Route | Auth | Action |
|---|---|---|---|
| `POST` | `/api/upload` | Cognito | Lambda returns a pre-signed S3 PUT URL; frontend uploads directly to S3 |
| `GET` | `/api/uploads` | Cognito | `ListObjectsV2` on `esc-uploads` bucket |
| `DELETE` | `/api/upload/{filename}` | Cognito | `DeleteObject` from S3 |

### Analytics
| Method | Route | Auth | Action |
|---|---|---|---|
| `POST` | `/api/analytics/track` | None | `UpdateItem` on `esc-analytics` |
| `GET` | `/api/analytics` | Cognito | `GetItem` from `esc-analytics` |
| `POST` | `/api/analytics/archive` | Cognito | Copy current item to `esc-analytics-archives`, reset current |
| `GET` | `/api/analytics/archives` | Cognito | `Scan` `esc-analytics-archives` |
| `GET` | `/api/analytics/archive/{id}` | Cognito | `GetItem` by `archiveId` |
| `DELETE` | `/api/analytics/archive/{id}` | Cognito | `DeleteItem` by `archiveId` |

### Admin Profile (Cognito replaces these routes entirely)
| Old Route | Replacement |
|---|---|
| `POST /api/login` | Cognito `InitiateAuth` |
| `POST /api/forgot-password` | Cognito `ForgotPassword` |
| `POST /api/reset-password` | Cognito `ConfirmForgotPassword` |
| `POST /api/change-password` | Cognito `ChangePassword` |
| `GET /api/admin/profile` | Cognito `GetUser` (Cognito authorizer on API Gateway) |
| `POST /api/change-email` | Cognito `UpdateUserAttributes` |
| `POST /api/change-username` | Cognito `UpdateUserAttributes` |

### Misc
| Method | Route | Auth | Action |
|---|---|---|---|
| `GET` | `/api/icons` | None | `ListObjectsV2` on static S3 bucket under `assets/icons/` prefix |
| `POST` | `/api/save-page` | Cognito | `PutObject` to S3 static bucket for `careers.html`, `blog.html`, `contact-us.html` |
| `GET` | `/api/backup` | Cognito | Assemble full content from DynamoDB, return as JSON download |
| `POST` | `/api/restore` | Cognito | Batch write all sections back to DynamoDB |
| `POST /api/validate` | Cognito | Validate content structure (can remain as pure Lambda logic, no DB call) |

> **Monthly analytics archive** — replace `node-cron` with an **EventBridge Scheduler** rule (`cron(0 0 1 * ? *)`) that triggers the archive Lambda automatically.

---

## Phase 3 — API Gateway

- Create a **REST API** (or HTTP API for lower cost)
- Wire each Lambda to its route + method
- Attach a **Cognito User Pool Authorizer** to all protected routes
- Leave the following routes **open** (no authorizer):
  - `POST /api/subscribe`
  - `POST /api/analytics/track`
  - `GET /api/content`
  - `GET /api/icons`
- Enable **CORS** on all routes (origin: your CloudFront domain)

---

## Phase 4 — Email (SES replaces Nodemailer)

- Verify `sales@electronicscience.net` domain in SES
- Move out of SES sandbox (submit production access request)
- Rewrite `services/emailService.js` as a Lambda utility using the **AWS SDK v3 SES client** (`SendEmailCommand`)
- The subscribe Lambda calls this utility directly — no SMTP credentials or app passwords needed

---

## Phase 5 — Frontend Changes

These are the only frontend JS changes required.

### 5.1 — API Base URL
- Create `public/js/config.js`:
  ```js
  const API_BASE = 'https://your-cloudfront-domain.com/api';
  ```
- Replace all hardcoded `/api/...` fetch paths across all scripts to use `API_BASE`

### 5.2 — Admin Auth (`public/admin/admin.js`)
- Remove all JWT `localStorage` logic and the `/api/login` fetch call
- Add `amazon-cognito-identity-js` (or AWS Amplify Auth) for:
  - `signIn(username, password)`
  - `signOut()`
  - `getSession()` → extract `IdToken`
- Pass `IdToken` as `Authorization: Bearer <IdToken>` on all protected API calls
- Password reset and change flows call Cognito SDK methods directly from the browser

### 5.3 — Upload Flow (`public/admin/admin.js`)
- Replace `POST /api/upload` with FormData approach:
  1. Call Lambda to get a **pre-signed S3 PUT URL**
  2. `PUT` the file directly to S3 from the browser using the pre-signed URL
  3. Construct the final public URL from the CloudFront uploads domain

### 5.4 — Media URL References
- All `uploads/filename.ext` src references need to point to the CloudFront uploads URL:
  ```
  https://cdn.electronicscience.com/uploads/filename.ext
  ```
- Update any hardcoded paths in `content.json` during the data migration step

---

## Phase 6 — Data Migration

Run these steps **once** before go-live:

1. **Content** — Split each top-level key of `content.json` into a DynamoDB `PutItem` call:
   - `sectionKey` = the key name (e.g., `hero`, `stats`, `solutions`, `blogPage`, etc.)
   - `data` = the full value object

2. **Subscribers** — Batch write all items from `subscribers.json` to `esc-subscribers`

3. **Analytics** — Write current `analytics.json` to `esc-analytics` and all entries from `analytics-archives.json` to `esc-analytics-archives`

4. **Uploads** — Sync all files from `public/uploads/` to the `esc-uploads` S3 bucket, preserving filenames:
   ```bash
   aws s3 sync public/uploads/ s3://esc-uploads/uploads/
   ```

5. **Admin User** — Create the Cognito admin user with existing credentials; set `FORCE_CHANGE_PASSWORD` so the admin resets on first login

---

## Phase 7 — Deployment & CI/CD

- Use **AWS SAM** or **Terraform** to define all Lambda functions, API Gateway, DynamoDB tables, and S3 buckets as IaC
- Add a **GitHub Actions** workflow with two jobs:
  - **Frontend**: On push to `main`, sync `public/` to `esc-website-static` S3, then invalidate the CloudFront cache
  - **Backend**: Deploy Lambda functions and API Gateway via `sam deploy`

---

## Service Mapping Summary

| Current | AWS Replacement |
|---|---|
| `server.js` (Express) | API Gateway + Lambda |
| `data/content.json` | DynamoDB (`esc-content`) |
| `data/subscribers.json` | DynamoDB (`esc-subscribers`) |
| `data/analytics.json` | DynamoDB (`esc-analytics`) |
| `data/analytics-archives.json` | DynamoDB (`esc-analytics-archives`) |
| `data/credentials.json` | Amazon Cognito User Pool |
| `data/sessions.json` | Amazon Cognito (session managed by SDK) |
| `data/reset-tokens.json` | DynamoDB (`esc-reset-tokens`) with TTL |
| `public/uploads/` | S3 (`esc-uploads`) |
| `public/` static files | S3 (`esc-website-static`) + CloudFront |
| JWT auth (`jsonwebtoken`) | Cognito User Pool + IdToken |
| `node-cron` monthly archive | EventBridge Scheduler |
| Nodemailer (SMTP/Gmail) | Amazon SES |
| Render/Heroku hosting | S3 + CloudFront (serverless, no EC2) |
