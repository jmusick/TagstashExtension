import { DEFAULT_API_BASE_URL, getSettings, saveApiBaseUrl, clearSession } from './lib/storage.js';

const elements = {
  form: document.getElementById('settingsForm'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  saveButton: document.getElementById('saveSettingsButton'),
  statusMessage: document.getElementById('statusMessage'),
};

function normalizeApiBaseUrl(value) {
  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue.replace(/\/+$/, '');
  return normalizedValue || DEFAULT_API_BASE_URL;
}

function showStatus(message) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.hidden = false;
}

async function loadSettings() {
  const settings = await getSettings();
  elements.apiBaseUrl.value = settings.apiBaseUrl;
}

async function handleSubmit(event) {
  event.preventDefault();
  elements.saveButton.disabled = true;

  try {
    const apiBaseUrl = normalizeApiBaseUrl(elements.apiBaseUrl.value);
    new URL(apiBaseUrl);
    await saveApiBaseUrl(apiBaseUrl);
    await clearSession();
    showStatus('Settings saved. Sign in again in the popup if you changed the server.');
  } catch {
    showStatus('Enter a valid API base URL, for example http://localhost:5000/api');
  } finally {
    elements.saveButton.disabled = false;
  }
}

loadSettings();
elements.form.addEventListener('submit', handleSubmit);
