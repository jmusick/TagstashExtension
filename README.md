# Tagstash for Firefox

A Firefox WebExtension that saves the active tab to your [Tagstash](https://tagsta.sh) bookmark manager.

## What it does

- Signs in to your Tagstash account using email and password
- Reads the active browser tab's URL and title
- Optionally fetches page title and description from the Tagstash metadata endpoint
- Saves the page as a bookmark with comma-separated tags
- Displays a sidebar panel with your bookmarks organized by tags
- Edit, search, and manage bookmarks directly from the sidebar

## Installation

Install from [Firefox Add-ons (AMO)](https://addons.mozilla.org) — search for **Tagstash**.

Or load it temporarily for development (see below).

## Features

### Popup
- Quick save of the active tab as a bookmark
- Add tags and description
- Auto-fetch page title and description

### Sidebar
- Browse all your bookmarks organized by tags
- Search and filter bookmarks
- Edit bookmark details and tags directly
- Mark bookmarks as favorites
- Sort by count or alphabetically
- Responsive to session changes (auto-refresh on login)

## Configuration

By default the extension points to `https://tagsta.sh/api`. The API base URL can be changed in **Settings** (gear icon) if needed, e.g. for local development.

## Folder layout

- `manifest.json` - Firefox WebExtension manifest
- `popup.html`, `popup.css`, `popup.js` - Extension popup UI and logic
- `sidebar.html`, `sidebar.css`, `sidebar.js` - Sidebar panel UI and logic
- `options.html`, `options.css`, `options.js` - Extension settings page
- `lib/storage.js` - Local extension storage helpers
- `lib/tagstash-client.js` - Minimal API client for Tagstash

## Load temporarily in Firefox (development)

1. Open Firefox and go to `about:debugging`
2. Click **This Firefox**
3. Click **Load Temporary Add-on...**
4. Select `manifest.json` from this folder

## Privacy

See the [Tagstash Privacy Policy](https://tagsta.sh/privacy) for details on how your data is handled.

## Notes

- The popup only supports `http` and `https` pages
- Firefox internal pages (`about:*`) cannot be saved from the popup
- Changing the API base URL in settings clears the current session
- Your authentication token is stored locally in Firefox and never transmitted except to your configured API endpoint
