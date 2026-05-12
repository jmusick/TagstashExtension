import { createTagstashClient } from './lib/tagstash-client.js';
import { getSettings } from './lib/storage.js';

document.addEventListener("DOMContentLoaded", async () => {
  const tagsList = document.getElementById("tags-list");
  const notLoggedIn = document.getElementById("not-logged-in");
  const sortToggle = document.getElementById("sort-toggle");

  const settings = await getSettings();

  if (!settings.token) {
    tagsList.hidden = true;
    sortToggle.hidden = true;
    notLoggedIn.hidden = false;
    return;
  }

  const client = createTagstashClient({
    apiBaseUrl: settings.apiBaseUrl,
    token: settings.token,
  });

  let sortMode = 'count'; // 'count' | 'alpha'
  let tags = [];
  let bookmarksByTag = new Map();

  function buildTagItem(tag) {
    const tagItem = document.createElement("li");
    tagItem.classList.add("tag-folder");

    const header = document.createElement("div");
    header.classList.add("tag-folder-header");

    const arrow = document.createElement("span");
    arrow.classList.add("tag-arrow");
    arrow.textContent = "▶";

    const tagLabel = document.createElement("span");
    tagLabel.classList.add("tag-label");
    tagLabel.textContent = tag.name;

    const tagCount = document.createElement("span");
    tagCount.classList.add("tag-count");
    tagCount.textContent = tag.count;

    header.appendChild(arrow);
    header.appendChild(tagLabel);
    header.appendChild(tagCount);

    const bookmarksList = document.createElement("ul");
    bookmarksList.classList.add("bookmarks-list");
    bookmarksList.hidden = true;

    const tagBookmarks = bookmarksByTag.get(tag.name) || [];
    for (const bookmark of tagBookmarks) {
      const bookmarkItem = document.createElement("li");
      bookmarkItem.classList.add("bookmark-item");

      if (bookmark.favicon_url) {
        const favicon = document.createElement("img");
        favicon.src = bookmark.favicon_url;
        favicon.classList.add("bookmark-favicon");
        favicon.width = 16;
        favicon.height = 16;
        bookmarkItem.appendChild(favicon);
      }

      const link = document.createElement("a");
      link.href = bookmark.url;
      link.textContent = bookmark.title;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      bookmarkItem.appendChild(link);
      bookmarksList.appendChild(bookmarkItem);
    }

    header.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !bookmarksList.hidden;
      bookmarksList.hidden = isOpen;
      tagItem.classList.toggle("open", !isOpen);
    });

    tagItem.appendChild(header);
    tagItem.appendChild(bookmarksList);
    return tagItem;
  }

  function getSortedTags() {
    const sorted = [...tags];
    if (sortMode === 'alpha') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    // 'count' order comes from the API already sorted
    return sorted;
  }

  function renderTags() {
    tagsList.innerHTML = '';
    const sorted = getSortedTags();
    if (sorted.length === 0) {
      tagsList.innerHTML = '<li class="empty-state">No tags yet. Save some bookmarks first!</li>';
      return;
    }
    for (const tag of sorted) {
      tagsList.appendChild(buildTagItem(tag));
    }
  }

  // Sort toggle buttons
  sortToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".sort-btn");
    if (!btn) return;
    const newSort = btn.dataset.sort;
    if (newSort === sortMode) return;
    sortMode = newSort;
    sortToggle.querySelectorAll(".sort-btn").forEach(b => b.classList.toggle("active", b.dataset.sort === sortMode));
    renderTags();
  });

  try {
    const [tagsResponse, bookmarksResponse] = await Promise.all([
      client.getAllTags(),
      client.getBookmarks(),
    ]);

    tags = tagsResponse.tags || [];
    const allBookmarks = bookmarksResponse.bookmarks || [];

    for (const bookmark of allBookmarks) {
      for (const tag of (bookmark.tags || [])) {
        const name = tag.name || tag;
        if (!bookmarksByTag.has(name)) bookmarksByTag.set(name, []);
        bookmarksByTag.get(name).push(bookmark);
      }
    }

    renderTags();
  } catch (error) {
    console.error("Error loading Tagstash data:", error);
    tagsList.innerHTML = '<li class="empty-state">Failed to load tags. Please try again.</li>';
  }
});