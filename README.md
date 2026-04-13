# TagstashExtension

A Firefox WebExtension that saves the active tab into your local Tagstash app.

## What it does

- Signs into the existing Tagstash backend using the same email and password flow
- Reads the active browser tab
- Optionally fetches page title and description from the Tagstash metadata endpoint
- Saves the page as a bookmark with comma-separated tags
- Stores its session and API base URL in Firefox local extension storage

## Folder layout

- `manifest.json` - Firefox WebExtension manifest
- `popup.html`, `popup.css`, `popup.js` - Extension popup UI and logic
- `options.html`, `options.css`, `options.js` - Extension settings page
- `lib/storage.js` - Local extension storage helpers
- `lib/tagstash-client.js` - Minimal API client for Tagstash

## Load it in Firefox

1. Open Firefox.
2. Go to `about:debugging`.
3. Click `This Firefox`.
4. Click `Load Temporary Add-on...`.
5. Select `manifest.json` from this folder.

## Local development setup

1. Start Tagstash locally so the API is available at `http://localhost:5000/api`.
2. Load the extension temporarily in Firefox.
3. Open the extension popup.
4. Sign in with your Tagstash account.
5. Save the current page.

## Notes

- The popup only supports `http` and `https` pages.
- Firefox internal pages such as `about:*` cannot be saved from the popup.
- If you change the API base URL in settings, the extension clears the current session and asks you to sign in again.
