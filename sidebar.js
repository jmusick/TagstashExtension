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

  const refreshBtn = document.getElementById("refresh-btn");

  let sortMode = 'count'; // 'count' | 'alpha'
  let tags = [];
  let bookmarksByTag = new Map();
  let starredBookmarks = [];

  function collapseOthers(except) {
    tagsList.querySelectorAll('.tag-folder.open').forEach(el => {
      if (el === except) return;
      el.classList.remove('open');
    });
  }

  function buildBookmarkItem(bookmark) {
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
    return bookmarkItem;
  }

  function buildTagItem(tag, starred = false) {
    const tagItem = document.createElement("li");
    tagItem.classList.add("tag-folder");
    if (starred) tagItem.classList.add("tag-folder--starred");

    const header = document.createElement("div");
    header.classList.add("tag-folder-header");

    const arrow = document.createElement("span");
    arrow.classList.add("tag-arrow");
    arrow.textContent = "▶";
    header.appendChild(arrow);

    if (starred) {
      const star = document.createElement("span");
      star.classList.add("pinned-star");
      star.textContent = "★";
      header.appendChild(star);
    }

    const tagLabel = document.createElement("span");
    tagLabel.classList.add("tag-label");
    tagLabel.textContent = tag.name;
    header.appendChild(tagLabel);

    const tagCount = document.createElement("span");
    tagCount.classList.add("tag-count");
    tagCount.textContent = tag.count;
    header.appendChild(tagCount);

    const bookmarksList = document.createElement("ul");
    bookmarksList.classList.add("bookmarks-list");

    const tagBookmarks = (bookmarksByTag.get(tag.name) || [])
      .slice()
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    for (const bookmark of tagBookmarks) {
      bookmarksList.appendChild(buildBookmarkItem(bookmark));
    }

    header.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = tagItem.classList.contains("open");
      if (!isOpen) collapseOthers(tagItem);
      tagItem.classList.toggle("open", !isOpen);
    });

    tagItem.appendChild(header);
    tagItem.appendChild(bookmarksList);
    return tagItem;
  }

  function buildStarredBookmarksSection() {
    if (starredBookmarks.length === 0) return null;

    const item = document.createElement("li");
    item.classList.add("tag-folder", "tag-folder--starred");

    const header = document.createElement("div");
    header.classList.add("tag-folder-header");

    const arrow = document.createElement("span");
    arrow.classList.add("tag-arrow");
    arrow.textContent = "▶";
    header.appendChild(arrow);

    const star = document.createElement("span");
    star.classList.add("pinned-star");
    star.textContent = "★";
    header.appendChild(star);

    const label = document.createElement("span");
    label.classList.add("tag-label");
    label.textContent = "Starred Bookmarks";
    header.appendChild(label);

    const count = document.createElement("span");
    count.classList.add("tag-count");
    count.textContent = starredBookmarks.length;
    header.appendChild(count);

    const list = document.createElement("ul");
    list.classList.add("bookmarks-list");

    for (const bookmark of starredBookmarks) {
      list.appendChild(buildBookmarkItem(bookmark));
    }

    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      if (!isOpen) collapseOthers(item);
      item.classList.toggle("open", !isOpen);
    });

    item.appendChild(header);
    item.appendChild(list);
    item.classList.add("open");
    return item;
  }

  function getSortedTags(tagList) {
    const sorted = [...tagList];
    if (sortMode === 'alpha') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => b.count - a.count);
    }
    return sorted;
  }

  function renderTags() {
    tagsList.innerHTML = '';

    const starredTags = tags.filter(t => Boolean(t.is_favorite));
    const regularTags = tags.filter(t => !Boolean(t.is_favorite));

    const hasPinned = starredBookmarks.length > 0 || starredTags.length > 0;
    const hasRegular = regularTags.length > 0;

    if (!hasPinned && !hasRegular) {
      tagsList.innerHTML = '<li class="empty-state">No tags yet. Save some bookmarks first!</li>';
      return;
    }

    // Starred bookmarks section
    const starredBookmarksEl = buildStarredBookmarksSection();
    if (starredBookmarksEl) tagsList.appendChild(starredBookmarksEl);

    // Starred tags
    for (const tag of getSortedTags(starredTags)) {
      tagsList.appendChild(buildTagItem(tag, true));
    }

    // Divider between pinned and regular
    if (hasPinned && hasRegular) {
      const divider = document.createElement("li");
      divider.classList.add("tags-section-divider");
      tagsList.appendChild(divider);
    }

    // Regular tags
    for (const tag of getSortedTags(regularTags)) {
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

  async function loadData() {
    refreshBtn.classList.add("spinning");
    try {
      const [tagsResponse, bookmarksResponse] = await Promise.all([
        client.getAllTags(),
        client.getBookmarks(),
      ]);

      tags = tagsResponse.tags || [];
      const allBookmarks = bookmarksResponse.bookmarks || [];

      starredBookmarks = allBookmarks
        .filter(b => Boolean(b.is_favorite))
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      bookmarksByTag = new Map();
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
    } finally {
      refreshBtn.classList.remove("spinning");
    }
  }

  refreshBtn.addEventListener("click", loadData);
  setInterval(loadData, 5 * 60 * 1000);

  loadData();
});