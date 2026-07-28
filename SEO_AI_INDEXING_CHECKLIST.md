# SEO & AI-Indexing Optimization Checklist

Actionable checklist for improving search-engine and AI-crawler (GPTBot, PerplexityBot, CCBot, Claude-Web, etc.) indexing of the eScience website. Grouped by tier, in increasing order of code-change effort and risk — **complete Tier 1 in full before starting Tier 2 or Tier 3**. Nothing on this list has been implemented yet; work through it item by item.

Site: `esc-web-main/` (static HTML/CSS/JS), served via S3 + CloudFront at `https://electronicscience.net`. Some page content is CMS-driven from `esc-host-main/`'s DynamoDB via `GET /api/content`.

---

## Tier 1 — Zero-to-trivial code changes (static file edits only)

No logic changes, no new dependencies, no infra access required. Highest benefit-to-risk ratio — do these first.

**Status: complete except the domain-hygiene check, which requires manual verification (see below).**

- [x] **Fill in missing `<head>` metadata on 7 pages.** `nav-pages/contact-us.html`, `nav-pages/blog.html`, `nav-pages/blog-post.html`, `nav-pages/product-detail.html`, `nav-pages/npc-seal.html`, `nav-pages/privacy.html`, `nav-pages/terms.html` currently lack canonical link, Open Graph, Twitter Card, and JSON-LD tags (and have generic/weak `<title>`/description text). Copy the established pattern from `index.html` and `nav-pages/company.html` / `nav-pages/solutions.html` / `nav-pages/careers.html`, and write a unique, non-generic title + description per page. Add a `WebPage` (or more specific type, e.g. `ContactPage`) JSON-LD block to each.

- [x] **Add `noindex` to the admin panel.** `public/admin/index.html` has no robots meta tag at all. Add to its `<head>`:
  ```html
  <meta name="robots" content="noindex, nofollow">
  ```

- [x] **Fix the `robots.txt` AI-bot group inheritance bug.** In `public/robots.txt`, the AI-crawler groups (`GPTBot`, `ChatGPT-User`, `PerplexityBot`, `CCBot`, `Google-Extended`, `Claude-Web`, `Anthropic-AI`, `OAI-SearchBot`) each only have `Allow: /` — per the robots.txt spec, user-agent groups are independent and do **not** inherit the `Disallow: /admin/` / `Disallow: /uploads/` rules from the `User-agent: *` group above them. Add explicit disallows to each bot's own group, e.g.:
  ```
  User-agent: GPTBot
  Allow: /
  Disallow: /admin/
  Disallow: /uploads/
  ```
  Repeat for every AI-bot group (or consolidate by listing all user-agents together before one shared rule block).

- [x] **Rebuild `public/sitemap.xml` for completeness and freshness.** Currently only 6 of 9 static pages are listed, and every `<lastmod>` is hardcoded to a stale `2026-03-17`. Add the missing pages:
  - `https://electronicscience.net/nav-pages/privacy.html`
  - `https://electronicscience.net/nav-pages/terms.html`
  - `https://electronicscience.net/nav-pages/npc-seal.html`

  Leave `blog-post.html` and `product-detail.html` out of the sitemap for now — they have no distinct per-item URLs yet (see Tier 3). Update every `<lastmod>` to the actual last-modified date of each page.

- [x] **Add `public/llms.txt`.** New file, alongside `robots.txt` and `sitemap.xml`, following the emerging llms.txt convention for LLM/answer-engine consumption. Should be a concise markdown summary covering: what eScience Corporation does, links to key pages (home, company, solutions, careers, contact), a short products/services summary, and contact info.

- [x] **Fix the duplicate `<h1>` on `index.html`.** Lines 223 and 304 both render an `<h1>` with the identical text "ARCHITECTS OF INNOVATION" — line 223 (`h1.splash-title`) is the decorative splash-screen overlay, line 304 (`h1.hero-headline`) is the real page hero. Demote the splash-screen element to a `<div>` or `<span>` carrying the same class (verify `styles.css` doesn't select the bare `h1` tag itself, only `.splash-title`, before changing the element type).

- [x] **Fix heading order on `index.html`.** An `<h3>` at line 377 appears before the first `<h2>` at line 387, breaking the heading hierarchy. Demote it to `<h4>`, or reorder the section so a proper `<h2>` precedes it.

- [x] **Add `loading="lazy"` to below-the-fold images.** Applied site-wide (`index.html` + all 10 `nav-pages/*.html`) to every `<img>` except each page's nav-bar logo and `index.html`'s splash-screen logo, which stay eager-loaded since they're above-the-fold/first-paint content.

- [ ] **Verify domain hygiene.** Confirm `electronicscience.com` either 301-redirects to `electronicscience.net` or is not publicly resolvable/indexable — all canonical tags, OG tags, and `sitemap.xml`/`robots.txt` currently standardize on `.net`, so a live, non-redirecting `.com` would create duplicate-domain indexing. This is a DNS/CloudFront check, not a code change. **Not verified in this session — this environment has no outbound network access.** Run `curl -IL https://electronicscience.com/` manually and note the result here.

---

## Tier 2 — Infra/config-only changes (no app code diff, requires AWS console/CLI access)

- [ ] **Fix the CloudFront soft-404.** Custom error responses currently map both `403` and `404` to `/index.html` with an overridden `200` status (documented in `PHASE_7_DEPLOYMENT_GUIDE.md`, Step 6, and provisioned out-of-band — not modeled in `esc-host-main/lambda/template.yaml`). This means CloudFront never returns a real 404 for any broken/removed URL, which both search engines and AI crawlers read as a signal of low content quality ("soft 404"). Before changing: confirm no part of the site's own navigation relies on the current fallback behavior. Then change the custom error responses to return their real HTTP status codes (a friendly branded error body is fine, but the status code must be accurate). Update `PHASE_7_DEPLOYMENT_GUIDE.md` Step 6 to reflect the corrected configuration once done.

- [x] **404 page created**: `public/404.html` — branded error page (site nav/footer, `noindex, follow` meta so the page itself is never indexed, big "404" hero, links back to Home/Company/Solutions/Careers/Blog/Contact, loads `scripts/analytics.js` so 404 hits get tracked and broken links can be found later). This is the response body CloudFront's custom error response for `404` should serve — **still requires the actual CloudFront config change**: set the 404 custom error response's response page path to `/404.html` **and** its HTTP response code to `404` (not `200`) in the CloudFront distribution settings (console/CLI — no further code change needed). The `403` custom error response can point at the same page if a distinct 403 body isn't needed.
- [x] **Fixed nested-path bug**: when CloudFront serves `/404.html`'s body for a broken URL like `/nav-pages/whatever.html`, the browser's address bar still shows that nested path, so the page's relative asset/link paths (`assets/...`, `scripts/...`, `nav-pages/company.html`, etc.) were resolving against `/nav-pages/` instead of the site root, breaking styling, scripts, and navigation for any 404 below the top level. Fixed by adding `<base href="/">` as the first element in `404.html`'s `<head>`, which forces every relative URL in the page to resolve from the site root regardless of the broken URL's depth.

- [ ] **(Optional, lower priority) Tune `/api/*` caching.** The CloudFront behavior for `/api/*` is currently `CachingDisabled`, and `GET /api/content` (`esc-host-main/lambda/content.js`) performs a full DynamoDB table scan on every single request with no `Cache-Control` header set anywhere. Consider enabling a short-TTL cache policy on this behavior. This is a page-speed/cost improvement (indirect Core Web Vitals ranking signal), not a direct indexing fix — verify content-freshness requirements (how quickly admin edits need to appear live) tolerate a TTL before enabling.

---

## Tier 3 — Blog/product crawlability alternatives

The single biggest structural gap: `nav-pages/blog-post.html` and `nav-pages/product-detail.html` are shared templates representing an unbounded number of blog posts / products, selected via `location.hash` or query param at runtime. Every post/product currently has the *same* URL, the *same* static `<title>`/description, and zero per-item canonical/OG/JSON-LD — content is invisible to crawlers that don't execute JS (most AI crawlers). Three options below, **ranked by effort vs. correctness — pick one, do not implement more than one**:

- [ ] **Option (a) — Minimal.** Switch internal links from `blog-post.html#id=X` to `blog-post.html?id=X` (query strings are crawlable and indexable distinctly; hash fragments are never sent to the server and are invisible to any crawler). `product-detail-page.js` already supports both `?id=` and `#id=` — verify `blog-post-page.js` has the same query-param support, or add it. Then extend `blog-post-page.js` (~line 73) and `product-detail-page.js` (~line 58) so that once the async content fetch resolves, they also set the canonical `<link>`, OG/Twitter meta tags, and JSON-LD (`Article` for posts, `Product` for products) — not just `document.title` as they do today. While in this code, also set `alt` text on the two placeholder images in `product-detail.html` (`#detail-image`, `#detail-intro-image`) in the same JS that populates `src` — they currently ship with permanently empty `alt`.

- [ ] **Option (b) — Middle.** Add a prerendering step to the `Jenkinsfile` deploy stage: a new script (e.g. `esc-web-main/scripts/prerender.js`) that fetches `GET /api/content` at deploy time and generates static per-item HTML snapshots (or injects per-item meta + JSON-LD directly into the templates before S3 upload), each with a real, unique URL, and auto-appends entries to `public/sitemap.xml`. Works for both JS-executing and non-JS-executing crawlers. Tradeoff: snapshots go stale between deploys until the next build runs.

- [ ] **Option (c) — Most correct, most effort.** Render and upload an individual static HTML page per blog post/product from the backend at publish time. Extend `esc-host-main/lambda/save-page.js` (or add a new Lambda), plus `esc-host-main/lambda/content.js` and `template.yaml` for IaC, with automatic `sitemap.xml` regeneration triggered on publish. Fully correct — real content is crawlable instantly with zero JS dependency and no staleness window — but the largest lift: new Lambda logic, S3 write permissions, and sitemap-regeneration concurrency handling.

---

## Notes

- Complete all of Tier 1 first — it's the highest-benefit, lowest-risk work and requires no infrastructure access.
- Tier 2's CloudFront 404 fix is high-benefit and low application risk once the "nothing relies on the fallback" check is done — prioritize it over Tier 3.
- Choose exactly one Tier 3 option based on how frequently blog posts/products are published and how much engineering time is available; don't implement more than one.

## Tier 1 completion log

Tier 1 has been implemented (2026-07-06), with one exception noted below:

- Added canonical/OG/Twitter/JSON-LD metadata to all 7 pages listed above.
- Added `<meta name="robots" content="noindex, nofollow">` to `public/admin/index.html`.
- Added explicit `Disallow: /admin/` and `Disallow: /uploads/` to every AI-bot group in `public/robots.txt`.
- Rebuilt `public/sitemap.xml`: added `privacy.html`, `terms.html`, `npc-seal.html`; refreshed `lastmod` on every page actually touched during this pass (pages not otherwise modified, e.g. `company.html`/`solutions.html`/`careers.html`, kept their existing `lastmod`).
- Added `public/llms.txt`.
- Fixed the duplicate `<h1>` on `index.html` by changing the decorative splash-screen title (`.splash-title`) from `<h1>` to `<div>` — verified no CSS rule selects the bare `h1` tag, only the class, so no styling broke.
- Fixed the heading-hierarchy break on `index.html` by demoting the "TRUSTED BY 100+ INDUSTRY LEADERS" heading from `<h3>` to `<h4>` (it sits under `.section-title-small`, a class-based selector, so styling is unaffected).
- Added `loading="lazy"` to every `<img>` site-wide (`index.html` + all 10 `nav-pages/*.html`) except each page's nav-bar logo and the `index.html` splash-screen logo, which remain eager since they render above the fold immediately on load.
- **Not completed**: the domain-hygiene check (`electronicscience.com` → `.net` redirect) could not be verified — this session's environment has no outbound network access. Run `curl -IL https://electronicscience.com/` manually and update this checklist with the result.

## Domain correction (2026-07-06)

The site's actual live domains turned out to be **`electronicscience.com` and its `www`/staging variants** (`www.electronicscience.com`, `staging.electronicscience.com`, `www.staging.electronicscience.com`) — not `electronicscience.net`, which every canonical/OG/JSON-LD tag, `sitemap.xml`, `robots.txt`, and `llms.txt` had been pointing to (matching what `CLAUDE.md` documented, which is now known to be stale).

Chosen canonical production URL: **`https://electronicscience.com`** (apex, non-www). Per web standards a canonical tag / `og:url` can only reference one URL — you cannot "list" all four domain variants in a single tag. Instead, all four variants should collapse to this one canonical form via redirects, and every canonical/OG/JSON-LD reference in the codebase now points at it.

- [x] Replaced every `electronicscience.net` reference with `electronicscience.com` across `index.html`, all 10 `nav-pages/*.html`, `robots.txt`, `sitemap.xml`, and `llms.txt` (112 occurrences total — canonical links, `og:url`, `twitter:url`, image URLs, JSON-LD `url`/`item` fields, sitemap `<loc>` entries). Re-validated: all JSON-LD blocks still parse as valid JSON, `sitemap.xml` still parses as valid XML.
- [x] Left the `sales@`/`support@`/`hrd@electronicscience.net` email addresses untouched (found in `admin.js`, `chat-ai.js`, `contact-page.js`, `index-page-init.js`) — email domains aren't necessarily tied to the website's canonical domain, and changing them without confirming mailboxes exist at `.com` would break real mail delivery. Confirm with whoever manages DNS/mail whether these should also move to `.com`.

### New follow-ups this surfaced (not yet done)

- [ ] **Urgent — verify CORS still works.** `CLAUDE.md` documents the backend's `ALLOWED_ORIGINS` (enforced per-Lambda, injected via SSM at deploy time) as `['https://electronicscience.net']`. If the live site now actually serves from `electronicscience.com`, every browser-side `fetch()` call to `/api/*` (content, contact form, uploads, analytics) would send `Origin: https://electronicscience.com` and could be **rejected by CORS** unless the SSM parameter / Lambda config has already been updated to match. This is a functional bug, not just an SEO issue — check `esc-host-main`'s deployed `AllowedOrigin` SSM parameter value before anything else.
- [ ] **www → apex redirect.** Confirm `www.electronicscience.com` 301-redirects to `https://electronicscience.com` at the CloudFront/DNS level (Tier 2, infra-only, no code change).
- [ ] **Staging must never be indexed.** Confirm `staging.electronicscience.com` and `www.staging.electronicscience.com` serve a fully blocking `robots.txt` (`Disallow: /`) the same way `robots.dev.txt` already does for the legacy dev environment — verify the Jenkinsfile/deploy pipeline's dev-vs-prod robots.txt swap actually targets these `.com` staging hosts (it may still be wired to old `.net`-era infrastructure and need updating).
- [ ] **`CLAUDE.md` is stale.** It documents `electronicscience.net` as the CORS origin and production domain. Once the CORS/SSM question above is resolved, update `CLAUDE.md` to reflect the real `.com` domain so future work doesn't repeat this mistake.
