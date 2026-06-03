import { createTagstashClient } from './lib/tagstash-client.js';
import { getSettings } from './lib/storage.js';

const browserApi = globalThis.browser ?? globalThis.chrome;

document.addEventListener("DOMContentLoaded", async () => {
  const tagsList = document.getElementById("tags-list");
  const notLoggedIn = document.getElementById("not-logged-in");
  const sortToggle = document.getElementById("sort-toggle");

  const settings = await getSettings();

  if (!settings.token) {
    tagsList.hidden = true;
    sortToggle.hidden = true;
    notLoggedIn.hidden = false;

    // Reload when a token is saved (user logs in from the popup)
    browserApi.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['tagstash.token']?.newValue) {
        location.reload();
      }
    });

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

  // ── Edit modal ──
  const editOverlay = document.getElementById('edit-overlay');
  const editForm = document.getElementById('edit-form');
  const editTitleInput = document.getElementById('edit-title');
  const editUrlInput = document.getElementById('edit-url');
  const editDescInput = document.getElementById('edit-desc');
  const editTagsField = document.getElementById('edit-tags-field');
  const editTagPillsEl = document.getElementById('edit-tag-pills');
  const editTagInput = document.getElementById('edit-tags');
  const editError = document.getElementById('edit-error');
  const editSaveBtn = document.getElementById('edit-save');

  let editingBookmarkId = null;
  let editTagList = [];

  function normalizeEditTags(arr) {
    return Array.from(new Set(arr.map(t => t.trim().toLowerCase()).filter(Boolean)));
  }

  function renderEditTagPills() {
    editTagPillsEl.innerHTML = '';
    editTagList.forEach((tag, index) => {
      const pill = document.createElement('span');
      pill.className = 'edit-tag-pill';

      const text = document.createElement('span');
      text.textContent = tag;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'edit-tag-pill-remove';
      removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
      removeBtn.textContent = '\xd7';
      removeBtn.addEventListener('click', () => {
        editTagList.splice(index, 1);
        renderEditTagPills();
      });

      pill.appendChild(text);
      pill.appendChild(removeBtn);
      editTagPillsEl.appendChild(pill);
    });
  }

  function setEditTagList(arr) {
    editTagList = normalizeEditTags(arr);
    renderEditTagPills();
  }

  function commitEditTagDraft() {
    const raw = editTagInput.value || '';
    const pending = raw.split(/[\s,]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
    if (pending.length === 0) return;
    setEditTagList([...editTagList, ...pending]);
    editTagInput.value = '';
  }

  editTagsField.addEventListener('click', () => editTagInput.focus());

  editTagInput.addEventListener('keydown', (e) => {
    const isDelimiter = e.key === ',' || e.key === ' ' || e.key === 'Spacebar';
    if (isDelimiter && editTagInput.value.trim()) {
      e.preventDefault();
      commitEditTagDraft();
      return;
    }
    if (e.key === 'Backspace' && !editTagInput.value && editTagList.length > 0) {
      e.preventDefault();
      editTagList.pop();
      renderEditTagPills();
    }
    if (e.key === 'Enter' && editTagInput.value.trim()) {
      e.preventDefault();
      commitEditTagDraft();
    }
  });

  function openEditModal(bookmark) {
    editingBookmarkId = bookmark.id;
    editTitleInput.value = bookmark.title || '';
    editUrlInput.value = bookmark.url || '';
    editDescInput.value = bookmark.description || '';
    setEditTagList((bookmark.tags || []).map(t => t.name || t));
    editTagInput.value = '';
    editError.hidden = true;
    editOverlay.hidden = false;
    editTitleInput.focus();
  }

  function closeEditModal() {
    editOverlay.hidden = true;
    editingBookmarkId = null;
  }

  document.getElementById('edit-close').addEventListener('click', closeEditModal);
  document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
  editOverlay.addEventListener('click', (e) => {
    if (e.target === editOverlay) closeEditModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editOverlay.hidden) closeEditModal();
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingBookmarkId) return;

    commitEditTagDraft();

    const data = {
      title: editTitleInput.value.trim(),
      url: editUrlInput.value.trim(),
      description: editDescInput.value.trim(),
      tags: editTagList,
    };

    editSaveBtn.disabled = true;
    editSaveBtn.textContent = 'Saving…';
    editError.hidden = true;

    try {
      await client.updateBookmark(editingBookmarkId, data);
      closeEditModal();
      await loadData();
    } catch (err) {
      editError.textContent = err.message || 'Failed to save.';
      editError.hidden = false;
    } finally {
      editSaveBtn.disabled = false;
      editSaveBtn.textContent = 'Save';
    }
  });

  // Persist the currently open tag/folder in localStorage
  function setOpenTag(tagName) {
    if (tagName) {
      localStorage.setItem('sidebarOpenTag', tagName);
    } else {
      localStorage.removeItem('sidebarOpenTag');
    }
  }

  function getOpenTag() {
    return localStorage.getItem('sidebarOpenTag');
  }

  function collapseOthers(except) {
    tagsList.querySelectorAll('.tag-folder.open').forEach(el => {
      if (el === except) return;
      el.classList.remove('open');
    });
  }

  function buildBookmarkItem(bookmark) {
    const bookmarkItem = document.createElement("li");
    bookmarkItem.classList.add("bookmark-item");

    try {
      const domain = new URL(bookmark.url).hostname;
      const favicon = document.createElement("img");
      favicon.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
      favicon.classList.add("bookmark-favicon");
      favicon.width = 16;
      favicon.height = 16;
      favicon.addEventListener("error", () => { favicon.style.display = "none"; });
      bookmarkItem.appendChild(favicon);
    } catch {
      // invalid URL — skip favicon
    }

    const link = document.createElement("a");
    link.href = bookmark.url;
    link.textContent = bookmark.title;
    link.rel = "noopener noreferrer";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      browser.tabs.update({ url: bookmark.url });
    });
    bookmarkItem.appendChild(link);

    const editBtn = document.createElement("button");
    editBtn.classList.add("bookmark-edit-btn");
    editBtn.textContent = "Edit";
    editBtn.title = "Edit bookmark";
    editBtn.type = "button";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(bookmark);
    });
    bookmarkItem.appendChild(editBtn);

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

    // Restore open state if this tag is the one saved in localStorage
    if (getOpenTag() === tag.name) {
      tagItem.classList.add("open");
    }

    header.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = tagItem.classList.contains("open");
      if (!isOpen) {
        collapseOthers(tagItem);
        tagItem.classList.add("open");
        setOpenTag(tag.name);
      } else {
        tagItem.classList.remove("open");
        setOpenTag(null);
      }
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

    // Restore open state: open by default on first load, or if explicitly saved
    const savedTag = getOpenTag();
    if (savedTag === '__starred__' || savedTag === null) {
      item.classList.add("open");
    }

    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      if (!isOpen) {
        collapseOthers(item);
        item.classList.add("open");
        setOpenTag('__starred__');
      } else {
        item.classList.remove("open");
        setOpenTag(null);
      }
    });

    item.appendChild(header);
    item.appendChild(list);
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