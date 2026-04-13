import { createTagstashClient } from './lib/tagstash-client.js';
import { getSettings, saveSession, clearSession } from './lib/storage.js';

const browserApi = globalThis.browser;

const elements = {
  authView: document.getElementById('authView'),
  saveView: document.getElementById('saveView'),
  message: document.getElementById('message'),
  loginForm: document.getElementById('loginForm'),
  loginButton: document.getElementById('loginButton'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  userLabel: document.getElementById('userLabel'),
  logoutButton: document.getElementById('logoutButton'),
  tabTitle: document.getElementById('tabTitle'),
  tabUrl: document.getElementById('tabUrl'),
  bookmarkForm: document.getElementById('bookmarkForm'),
  bookmarkTitle: document.getElementById('bookmarkTitle'),
  bookmarkUrl: document.getElementById('bookmarkUrl'),
  bookmarkDescription: document.getElementById('bookmarkDescription'),
  bookmarkTags: document.getElementById('bookmarkTags'),
  fetchTitleButton: document.getElementById('fetchTitleButton'),
  fetchDescriptionButton: document.getElementById('fetchDescriptionButton'),
  saveButton: document.getElementById('saveButton'),
  baseUrlButton: document.getElementById('baseUrlButton'),
  trimUrlButton: document.getElementById('trimUrlButton'),
};

const state = {
  apiBaseUrl: '',
  token: null,
  user: null,
  activeTab: null,
  existingBookmarkId: null,
};

function setBusy(button, isBusy, label) {
  if (!button) {
    return;
  }

  if (isBusy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
  } else if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
  }

  button.disabled = isBusy;
}

function showMessage(type, text) {
  elements.message.textContent = text;
  elements.message.className = `message ${type}`;
  elements.message.hidden = false;
}

function clearMessage() {
  elements.message.hidden = true;
  elements.message.textContent = '';
  elements.message.className = 'message';
}

function toggleView(isAuthenticated) {
  elements.authView.hidden = isAuthenticated;
  elements.saveView.hidden = !isAuthenticated;
}

function isSupportedUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

function normalizeTags(tagInput) {
  return Array.from(
    new Set(
      tagInput
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function getClient() {
  return createTagstashClient({
    apiBaseUrl: state.apiBaseUrl,
    token: state.token,
  });
}

async function hydrateActiveTab() {
  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  state.activeTab = tab || null;

  if (!tab || !isSupportedUrl(tab.url)) {
    elements.tabTitle.textContent = 'Open an http or https page to save it';
    elements.tabUrl.textContent = tab?.url || 'Firefox internal pages cannot be saved from the popup.';
    elements.bookmarkTitle.value = '';
    elements.bookmarkUrl.value = '';
    elements.bookmarkDescription.value = '';
    return;
  }

  elements.tabTitle.textContent = tab.title || 'Untitled tab';
  elements.tabUrl.textContent = tab.url;
  elements.bookmarkTitle.value = tab.title || '';
  elements.bookmarkUrl.value = tab.url || '';
}

async function restoreSession() {
  const settings = await getSettings();
  state.apiBaseUrl = settings.apiBaseUrl;
  state.token = settings.token;
  state.user = settings.user;

  if (!state.token) {
    toggleView(false);
    return;
  }

  try {
    const response = await getClient().getCurrentUser();
    state.user = response.user;
    elements.userLabel.textContent = response.user.username;
    toggleView(true);
  } catch {
    await clearSession();
    state.token = null;
    state.user = null;
    toggleView(false);
    showMessage('error', 'Your session expired. Sign in again.');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  clearMessage();
  setBusy(elements.loginButton, true, 'Signing in...');

  try {
    const response = await createTagstashClient({ apiBaseUrl: state.apiBaseUrl }).login(
      elements.email.value.trim(),
      elements.password.value
    );

    state.token = response.token;
    state.user = response.user;
    await saveSession(response.token, response.user);
    elements.userLabel.textContent = response.user.username;
    elements.password.value = '';
    toggleView(true);
    showMessage('success', 'Signed in. Save the current tab when ready.');
  } catch (error) {
    showMessage('error', error.message || 'Unable to sign in');
  } finally {
    setBusy(elements.loginButton, false);
  }
}

async function handleLogout() {
  await clearSession();
  state.token = null;
  state.user = null;
  toggleView(false);
  clearMessage();
}

async function readFromTab() {
  if (!state.activeTab?.id) return null;
  const results = await browserApi.scripting.executeScript({
    target: { tabId: state.activeTab.id },
    func: () => {
      const getMeta = (selector) => {
        const el = document.querySelector(selector);
        return el ? (el.getAttribute('content') || '').trim() || null : null;
      };
      return {
        title: document.title?.trim() || null,
        description:
          getMeta('meta[name="description"]') ||
          getMeta('meta[property="og:description"]') ||
          getMeta('meta[name="twitter:description"]') ||
          null,
      };
    },
  });
  return results?.[0]?.result || null;
}

async function handleFetchTitle() {
  clearMessage();
  setBusy(elements.fetchTitleButton, true, 'Fetching...');
  try {
    const dom = await readFromTab();
    if (dom?.title) {
      elements.bookmarkTitle.value = dom.title;
      return;
    }
    const url = elements.bookmarkUrl.value.trim();
    if (!isSupportedUrl(url)) {
      showMessage('error', 'Enter a valid URL first.');
      return;
    }
    const response = await getClient().fetchMetadata(url);
    if (response.title) elements.bookmarkTitle.value = response.title;
    else showMessage('error', 'No title found for this page.');
  } catch (error) {
    showMessage('error', error.message || 'Unable to fetch title');
  } finally {
    setBusy(elements.fetchTitleButton, false);
  }
}

async function handleFetchDescription() {
  clearMessage();
  setBusy(elements.fetchDescriptionButton, true, 'Fetching...');
  try {
    const dom = await readFromTab();
    if (dom?.description) {
      elements.bookmarkDescription.value = dom.description;
      return;
    }
    const url = elements.bookmarkUrl.value.trim();
    if (!isSupportedUrl(url)) {
      showMessage('error', 'Enter a valid URL first.');
      return;
    }
    const response = await getClient().fetchMetadata(url);
    if (response.description) elements.bookmarkDescription.value = response.description;
    else showMessage('error', 'No description found for this page.');
  } catch (error) {
    showMessage('error', error.message || 'Unable to fetch description');
  } finally {
    setBusy(elements.fetchDescriptionButton, false);
  }
}

function handleBaseUrl() {
  try {
    const u = new URL(elements.bookmarkUrl.value);
    elements.bookmarkUrl.value = u.origin + '/';
  } catch {}
}

function handleTrimUrl() {
  try {
    const u = new URL(elements.bookmarkUrl.value);
    elements.bookmarkUrl.value = u.origin + u.pathname;
  } catch {}
}

async function checkExistingBookmark() {
  const url = elements.bookmarkUrl.value.trim();
  if (!url || !isSupportedUrl(url)) return;

  try {
    const result = await getClient().findByUrl(url);
    const { id, title, description, tags } = result.bookmark;
    state.existingBookmarkId = id;
    elements.bookmarkTitle.value = title || '';
    elements.bookmarkDescription.value = description || '';
    elements.bookmarkTags.value = tags?.map((t) => t.name).join(', ') || '';
    elements.saveButton.textContent = 'Update Bookmark';
  } catch {
    // 404 = not yet saved, or network error — treat as new
    state.existingBookmarkId = null;
  }
}

async function handleSaveBookmark(event) {
  event.preventDefault();
  clearMessage();

  const tags = normalizeTags(elements.bookmarkTags.value);
  const invalidTag = tags.find((tag) => /\s/.test(tag));
  if (invalidTag) {
    showMessage('error', `Tags must be single words. Invalid tag: ${invalidTag}`);
    return;
  }

  const bookmark = {
    title: elements.bookmarkTitle.value.trim(),
    url: elements.bookmarkUrl.value.trim(),
    description: elements.bookmarkDescription.value.trim(),
    tags,
  };

  if (!bookmark.title || !bookmark.url) {
    showMessage('error', 'Title and URL are required.');
    return;
  }

  if (!isSupportedUrl(bookmark.url)) {
    showMessage('error', 'Only http and https URLs can be saved.');
    return;
  }

  setBusy(elements.saveButton, true, 'Saving...');

  try {
    if (state.existingBookmarkId) {
      await getClient().updateBookmark(state.existingBookmarkId, bookmark);
    } else {
      await getClient().createBookmark(bookmark);
    }
    window.close();
  } catch (error) {
    showMessage('error', error.message || 'Unable to save bookmark');
  } finally {
    setBusy(elements.saveButton, false);
  }
}

async function init() {
  await hydrateActiveTab();
  await restoreSession();

  if (state.token) {
    await checkExistingBookmark();
  }

  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.fetchTitleButton.addEventListener('click', handleFetchTitle);
  elements.fetchDescriptionButton.addEventListener('click', handleFetchDescription);
  elements.baseUrlButton.addEventListener('click', handleBaseUrl);
  elements.trimUrlButton.addEventListener('click', handleTrimUrl);
  elements.bookmarkForm.addEventListener('submit', handleSaveBookmark);
}

init().catch((error) => {
  showMessage('error', error.message || 'Extension failed to initialize');
});
