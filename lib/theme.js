/*
 * Theme resolution shared by popup, sidebar, and options.
 *
 * Loaded as a CLASSIC script (not a module) from each page's <head> so it runs
 * before first paint and there's no flash of the wrong palette — extension
 * pages can't use inline scripts (CSP), and a module script would be deferred.
 * It applies the cached theme synchronously, then exposes `tagstashTheme` for
 * page scripts to call once the signed-in user's saved theme arrives from the API.
 *
 * Source of truth is the user's `theme` column on the server (same value the
 * web app's theme selector writes). The cache below only avoids the flash while
 * that request is in flight.
 */
(function () {
  const CACHE_KEY = 'tagstash.theme';
  const THEMES = ['slate', 'midnight', 'light'];
  const DEFAULT_THEME = 'slate';

  const isValidTheme = (value) => THEMES.includes(value);

  function readCachedTheme() {
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (isValidTheme(cached)) {
        return cached;
      }
    } catch {
      // localStorage can be unavailable in some contexts; fall through to the default.
    }

    return null;
  }

  function resolveInitialTheme() {
    const cached = readCachedTheme();
    if (cached) {
      return cached;
    }

    // Matches the web app's signed-out default.
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_THEME;
  }

  function applyTheme(theme) {
    const next = isValidTheme(theme) ? theme : DEFAULT_THEME;
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'light' ? 'light' : 'dark';

    try {
      window.localStorage.setItem(CACHE_KEY, next);
    } catch {
      // Caching is best-effort — the theme is still applied for this page.
    }

    return next;
  }

  // The user object returned by /auth/login and /auth/me carries `theme`, which
  // is null for accounts that never picked one (and on instances whose D1 hasn't
  // had the theme migration applied yet) — leave the current theme alone then.
  function applyUserTheme(user) {
    if (user && isValidTheme(user.theme)) {
      applyTheme(user.theme);
    }
  }

  applyTheme(resolveInitialTheme());

  // Keep an already-open sidebar in step when the popup refreshes the theme.
  window.addEventListener('storage', (event) => {
    if (event.key === CACHE_KEY && isValidTheme(event.newValue)) {
      applyTheme(event.newValue);
    }
  });

  globalThis.tagstashTheme = {
    CACHE_KEY,
    THEMES,
    DEFAULT_THEME,
    isValidTheme,
    applyTheme,
    applyUserTheme,
  };
})();
