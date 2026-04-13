const browserApi = globalThis.browser;

export const DEFAULT_API_BASE_URL = 'https://tagstash.pages.dev/api';

const STORAGE_KEYS = {
  apiBaseUrl: 'tagstash.apiBaseUrl',
  token: 'tagstash.token',
  user: 'tagstash.user',
};

export async function getSettings() {
  const stored = await browserApi.storage.local.get(Object.values(STORAGE_KEYS));

  return {
    apiBaseUrl: stored[STORAGE_KEYS.apiBaseUrl] || DEFAULT_API_BASE_URL,
    token: stored[STORAGE_KEYS.token] || null,
    user: stored[STORAGE_KEYS.user] || null,
  };
}

export async function saveApiBaseUrl(apiBaseUrl) {
  await browserApi.storage.local.set({
    [STORAGE_KEYS.apiBaseUrl]: apiBaseUrl,
  });
}

export async function saveSession(token, user) {
  await browserApi.storage.local.set({
    [STORAGE_KEYS.token]: token,
    [STORAGE_KEYS.user]: user,
  });
}

export async function clearSession() {
  await browserApi.storage.local.remove([
    STORAGE_KEYS.token,
    STORAGE_KEYS.user,
  ]);
}
