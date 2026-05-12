export function createTagstashClient({ apiBaseUrl, token }) {
  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
      throw new Error(payload?.error || 'Request failed');
    }

    return payload;
  }

  return {
    login(email, password) {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    getCurrentUser() {
      return request('/auth/me');
    },
    createBookmark(bookmark) {
      return request('/bookmarks', {
        method: 'POST',
        body: JSON.stringify(bookmark),
      });
    },
    fetchMetadata(url) {
      return request('/bookmarks/meta', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    },
    findByUrl(url) {
      return request(`/bookmarks/by-url?url=${encodeURIComponent(url)}`);
    },
    updateBookmark(id, bookmark) {
      return request(`/bookmarks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(bookmark),
      });
    },
    getAllTags() {
      return request('/bookmarks/tags/all');
    },
    getBookmarks() {
      return request('/bookmarks');
    },
  };
}
