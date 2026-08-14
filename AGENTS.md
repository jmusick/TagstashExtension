# AGENTS.md

Conventions and gotchas for working in this repo, gathered from hands-on sessions. Read this before making non-trivial changes.

## What this is

A Firefox (Manifest V3) WebExtension companion to [Tagstash](https://tagsta.sh) — the main app lives in a separate repo/checkout (`Tagstash`, sibling directory). This extension has **no build step**: no bundler, no framework, no `package.json`/`node_modules`. It's plain ES modules loaded directly by the browser via `<script type="module">` in `popup.html`/`sidebar.html`/`options.html`. Test changes by loading it unpacked (`about:debugging` → "This Firefox" → "Load Temporary Add-on..." → select `manifest.json`) — there's no `npm run dev` or test suite.

## Structure

- `popup.html`/`popup.css`/`popup.js` — the toolbar popup: log in, quick-save the active tab, edit title/description/tags/URL before saving (includes Base URL / Trim URL buttons and title/description auto-fetch).
- `sidebar.html`/`sidebar.css`/`sidebar.js` — the persistent sidebar panel: browse/search/edit/favorite all bookmarks, organized by tags. Listens for `browserApi.storage.onChanged` on the token key and reloads itself on login/logout so it never shows stale auth state.
- `options.html`/`options.css`/`options.js` — settings page for pointing the extension at a self-hosted Tagstash instance instead of `https://tagsta.sh/api`.
- `theme.css` — the three shared palettes (`slate`, `midnight`, `light`) as CSS custom properties, linked by all three pages *before* their own stylesheet. The page stylesheets define no colors of their own; they only consume these tokens.
- `lib/theme.js` — resolves and applies the active theme.
- `lib/storage.js` — thin wrapper around `browser.storage.local` (`getSettings`/`saveApiBaseUrl`/`saveSession`/`clearSession`) for the API base URL, JWT token, and cached user object. This is the extension's equivalent of the web app's `localStorage` session persistence — same purpose, different browser API.
- `lib/tagstash-client.js` — minimal `fetch`-based client for the Tagstash REST API (Bearer JWT via `Authorization` header, same auth scheme as the web app).

Every file that touches WebExtension APIs uses `const browserApi = globalThis.browser ?? globalThis.chrome;` for Firefox/Chrome compatibility — follow that pattern rather than calling `browser.*`/`chrome.*` directly in new code.

## Keep in sync with the main Tagstash repo

This extension talks to the same backend (`functions/api/[[path]].js` in the `Tagstash` repo) and duplicates a couple of pieces of frontend logic rather than sharing code across repos:

- **`normalizeBookmarkUrl`** (in `popup.js`) is a copy of the same function in `Tagstash/src/App.jsx` and `Tagstash/functions/api/[[path]].js`. It prefixes a missing `https://` and strips a trailing slash on a bare root path only (`https://example.com/` → `https://example.com`, but `https://example.com/docs/` is left alone). The **Base URL** button (`handleBaseUrl`) relies on the same root-stripping via `new URL(...).origin`. If you change the normalization rules, update all three copies — see `Tagstash/AGENTS.md` for the canonical description.
- **`lib/tagstash-client.js`'s `fetchMetadata`** calls `POST /bookmarks/meta` once and reads both `response.title` and `response.description` off the same call (see `popup.js`'s fetch-title and fetch-description handlers). The web app instead calls two separate endpoints, `POST /bookmarks/meta` and `POST /bookmarks/meta-description`. Both hit the same `fetchSiteMetadata` server-side helper, so behavior is equivalent, but don't assume the two frontends call the API the same way when tracing a metadata-fetch bug.
- Any new Tagstash API route the popup or sidebar should use has to be added to `lib/tagstash-client.js` explicitly — there's no shared API-client package between the two repos.

## Theming: mirrors the account's theme, not a local setting

The extension has no theme picker. It renders whatever theme the signed-in user chose on tagsta.sh, which the API returns as `user.theme` (`slate` | `midnight` | `light`) from both `/auth/login` and `/auth/me`.

- `lib/theme.js` is a **classic script**, not an ES module, and is loaded from each page's `<head>` (`<script src="lib/theme.js"></script>`). Both parts matter: extension pages can't run inline scripts (CSP), and a `type="module"` script is deferred — so this is the only way to set `<html data-theme>` before first paint. It exposes `globalThis.tagstashTheme`, which the page modules read (`const themeApi = globalThis.tagstashTheme;`), the same way they read `browserApi`.
- It applies a `localStorage`-cached theme synchronously at load, then pages call `themeApi.applyUserTheme(user)` once the API answers. `applyUserTheme` ignores a missing/invalid `theme` — it's `null` for accounts that never picked one, and on self-hosted instances whose D1 hasn't had the theme migration applied. The cache is `localStorage` (synchronous) rather than `browser.storage.local` (async) purely to avoid the flash; the server value is the source of truth.
- The `storage` event listener in `lib/theme.js` re-applies the theme in *other* open extension pages, so signing in via the popup restyles an already-open sidebar without a reload.
- The sidebar fires its own `getCurrentUser()` call solely to refresh the theme — it otherwise never hits `/auth/me`. Don't "optimize" it away; without it a sidebar-only user keeps a stale theme indefinitely.
- The palettes in `theme.css` are hand-copied from `Tagstash/src/index.css` (`:root`, `:root[data-theme='midnight']`, `:root[data-theme='light']`) with the extension's own token names. There's no shared stylesheet across the repos — if the web app's palette changes, update `theme.css` to match.
- When adding CSS, **never hardcode a color** — every color, gradient, shadow, and overlay in `popup.css`/`sidebar.css`/`options.css` goes through a token, or it will look wrong in Light.

## Auth

`popup.js` logs in via `POST /auth/login` with email/password, stores the returned JWT + user object via `saveSession`, and every subsequent request attaches it as `Authorization: Bearer <token>`. Changing the configured API base URL in Settings clears the current session (`clearSession`) since the token is only valid for the instance that issued it.

## Release process

`manifest.json`'s `version` field is the source of truth for the extension version. Pushing a `v*` git tag triggers `.github/workflows/release.yml`, which zips the repo (excluding `.git`, `.github`, `README.md`, and any `*.zip`) and publishes it as a GitHub Release — it does **not** read or validate `manifest.json`'s version against the tag, so bump `manifest.json` and tag in the same change to avoid a mismatch between the release name and the shipped manifest.
