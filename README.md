# Tagstash for Firefox

A Firefox WebExtension that saves the active tab to your [Tagstash](https://tagstash.pages.dev) bookmark manager.

## What it does

- Signs in to your Tagstash account using email and password
- Reads the active browser tab's URL and title
- Optionally fetches page title and description from the Tagstash metadata endpoint
- Saves the page as a bookmark with comma-separated tags
- Works with [tagstash.pages.dev](https://tagstash.pages.dev) or a self-hosted instance

## Installation

Install from [Firefox Add-ons (AMO)](https://addons.mozilla.org) — search for **Tagstash**.

Or load it temporarily for development (see below).

## Configuration

By default the extension points to `https://tagstash.pages.dev/api`. To use a self-hosted instance:

1. Click the extension icon → **Settings** (gear icon)
2. Enter your API base URL, e.g. `https://your-instance.com/api`
3. Click **Save** — Firefox will ask you to grant access to that URL
4. Sign in again in the popup

## Folder layout

- `manifest.json` - Firefox WebExtension manifest
- `popup.html`, `popup.css`, `popup.js` - Extension popup UI and logic
- `options.html`, `options.css`, `options.js` - Extension settings page
- `lib/storage.js` - Local extension storage helpers
- `lib/tagstash-client.js` - Minimal API client for Tagstash

## Load temporarily in Firefox (development)

1. Open Firefox and go to `about:debugging`
2. Click **This Firefox**
3. Click **Load Temporary Add-on...**
4. Select `manifest.json` from this folder

## Notes

- The popup only supports `http` and `https` pages
- Firefox internal pages (`about:*`) cannot be saved from the popup
- Changing the API base URL in settings clears the current session
