const $ = (id) => document.getElementById(id);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const isExt = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);

// ---------- Clock, date, greeting ----------

const timeEl = $('time');
const msEl = $('ms');
const dateEl = $('date');
const greetingEl = $('greeting');

let lastSecond = -1;
let lastDay = -1;

function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Working late';
}

function updateClock(now) {
  msEl.textContent = '.' + String(now.getMilliseconds()).padStart(3, '0');

  const second = now.getSeconds();
  if (second === lastSecond) return;
  lastSecond = second;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  timeEl.textContent = `${hh}:${mm}:${ss}`;

  if (now.getDate() !== lastDay) {
    lastDay = now.getDate();
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  greetingEl.textContent = greetingFor(now.getHours());
}

// ---------- Year progress (52-week tick row) ----------

const WEEKS = 52;

const yearTicks = $('year-ticks');
const yearNum = $('year-num');
const yearWeek = $('year-week');
const yearPct = $('year-pct');

let yearCache = { year: -1, week: -1, start: 0, span: 1 };

function buildTicks(week) {
  yearTicks.textContent = '';
  for (let i = 0; i < WEEKS; i++) {
    const tick = document.createElement('span');
    tick.className = 'tick' + (i < week ? ' past' : i === week ? ' cur' : '');
    tick.style.setProperty('--i', i);
    yearTicks.appendChild(tick);
  }
}

function updateYearProgress(now) {
  const year = now.getFullYear();
  if (year !== yearCache.year) {
    const start = new Date(year, 0, 1).getTime();
    yearCache = { year, week: -1, start, span: new Date(year + 1, 0, 1).getTime() - start };
    yearNum.textContent = year;
  }
  const frac = (now.getTime() - yearCache.start) / yearCache.span;
  const week = Math.min(WEEKS - 1, Math.floor(frac * WEEKS));
  if (week !== yearCache.week) {
    yearCache.week = week;
    buildTicks(week);
    yearWeek.textContent = `Week ${week + 1}`;
  }
  yearPct.textContent = `${(frac * 100).toFixed(4)}%`;
}

// ---------- Custom cursor (dot follows instantly, ring trails) ----------

const dot = $('cursor-dot');
const ring = $('cursor-ring');

let mouseX = innerWidth / 2;
let mouseY = innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;

if (finePointer) {
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.body.classList.add('cursor-active');
  });

  document.addEventListener('mouseleave', () => {
    document.body.classList.remove('cursor-active');
  });

  document.addEventListener('mouseover', (e) => {
    document.body.classList.toggle('cursor-hover', !!e.target.closest('a, button'));
  });
}

// ---------- Single animation loop ----------

function frame() {
  const now = new Date();
  updateClock(now);
  updateYearProgress(now);

  if (finePointer) {
    if (reducedMotion) {
      ringX = mouseX;
      ringY = mouseY;
    } else {
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;
    }
    dot.style.translate = `${mouseX}px ${mouseY}px`;
    ring.style.translate = `${ringX}px ${ringY}px`;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// ---------- Storage (chrome.storage in the extension, localStorage elsewhere) ----------

const store = {
  async get(key) {
    if (isExt && chrome.storage && chrome.storage.local) {
      return (await chrome.storage.local.get(key))[key];
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    } catch (e) {
      return undefined;
    }
  },
  async set(key, value) {
    if (isExt && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [key]: value });
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Best effort; the dock still works for this tab.
    }
  }
};

// ---------- Browser data sources (all optional — fail soft to []) ----------

async function getTopSites() {
  try {
    if (isExt && chrome.topSites) return await chrome.topSites.get();
  } catch (e) { /* permission missing or API unavailable */ }
  return [];
}

async function searchBookmarks(query) {
  try {
    if (isExt && chrome.bookmarks) {
      return (await chrome.bookmarks.search(query)).filter((b) => b.url);
    }
  } catch (e) { /* ignore */ }
  return [];
}

async function getBookmarksBar() {
  try {
    if (isExt && chrome.bookmarks) {
      const tree = await chrome.bookmarks.getTree();
      const found = [];
      (function walk(nodes) {
        for (const node of nodes) {
          if (found.length >= 10) return;
          if (node.url) found.push(node);
          else if (node.children) walk(node.children);
        }
      })(tree);
      return found;
    }
  } catch (e) { /* ignore */ }
  return [];
}

async function searchHistory(query) {
  try {
    if (isExt && chrome.history) {
      return await chrome.history.search({ text: query, maxResults: 8, startTime: 0 });
    }
  } catch (e) { /* ignore */ }
  return [];
}

// ---------- Shortcuts dock ----------

const MAX_SHORTCUTS = 8;

const DEFAULT_SHORTCUTS = [
  { title: 'Google', url: 'https://www.google.com' },
  { title: 'LinkedIn', url: 'https://www.linkedin.com' },
  { title: 'GitHub', url: 'https://www.github.com' },
  { title: 'Medium', url: 'https://www.medium.com' }
];

const dockList = $('dock-list');
const addBtn = $('dock-add');

let shortcuts = [];

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}

function normalizeUrl(url) {
  return String(url).replace(/\/+$/, '').toLowerCase();
}

function faviconUrl(url) {
  if (isExt && chrome.runtime.getURL) {
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', url);
    u.searchParams.set('size', '64');
    return u.toString();
  }
  return null;
}

function monogramFor(item) {
  const span = document.createElement('span');
  span.className = 'monogram';
  const source = item.title || hostOf(item.url);
  span.textContent = (source[0] || '?').toUpperCase();
  return span;
}

function iconFor(item) {
  // Icon sources, best first: Chrome's favicon service (extension only),
  // then Google's public favicon service, then a letter monogram.
  // Each failure falls through to the next.
  const candidates = [];
  const fav = faviconUrl(item.url);
  if (fav) candidates.push(fav);
  const host = hostOf(item.url);
  if (host.includes('.')) {
    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`);
  }
  if (!candidates.length) return monogramFor(item);

  const img = document.createElement('img');
  img.className = 'app-icon';
  img.alt = '';
  let attempt = 0;
  img.addEventListener('error', () => {
    attempt += 1;
    if (attempt < candidates.length) img.src = candidates[attempt];
    else img.replaceWith(monogramFor(item));
  });
  img.src = candidates[0];
  return img;
}

function renderDock(animate) {
  dockList.textContent = '';
  shortcuts.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'dock-item' + (animate ? '' : ' no-anim');
    item.style.setProperty('--i', i);

    const link = document.createElement('a');
    link.className = 'app-link';
    link.href = s.url;
    link.setAttribute('aria-label', s.title || hostOf(s.url));

    const label = document.createElement('span');
    label.className = 'app-label';
    label.textContent = s.title || hostOf(s.url);

    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.appendChild(iconFor(s));

    link.append(label, chip);

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${s.title || hostOf(s.url)}`);
    remove.addEventListener('click', () => removeShortcut(s.url));

    item.append(link, remove);
    dockList.appendChild(item);
  });

  addBtn.style.setProperty('--i', shortcuts.length);
}

function isInDock(url) {
  const n = normalizeUrl(url);
  return shortcuts.some((s) => normalizeUrl(s.url) === n);
}

async function saveShortcuts() {
  await store.set('shortcuts', shortcuts);
}

async function addShortcut(item) {
  if (shortcuts.length >= MAX_SHORTCUTS || isInDock(item.url)) return false;
  shortcuts.push({ title: item.title || hostOf(item.url), url: item.url });
  await saveShortcuts();
  renderDock(false);
  return true;
}

async function removeShortcut(url) {
  const n = normalizeUrl(url);
  shortcuts = shortcuts.filter((s) => normalizeUrl(s.url) !== n);
  await saveShortcuts();
  renderDock(false);
}

async function initDock() {
  const stored = await store.get('shortcuts');
  if (Array.isArray(stored)) {
    shortcuts = stored;
  } else {
    // First run: mirror the shortcuts Chrome shows on its own new-tab page.
    const top = await getTopSites();
    shortcuts = top.length
      ? top.slice(0, MAX_SHORTCUTS).map((s) => ({ title: s.title || hostOf(s.url), url: s.url }))
      : DEFAULT_SHORTCUTS.map((s) => ({ ...s }));
  }
  renderDock(true);
}

initDock();

// ---------- Launch transition on dock links (delegated: links are dynamic) ----------

dockList.addEventListener('click', (e) => {
  const link = e.target.closest('a.app-link');
  if (!link) return;
  // Leave modified clicks (new tab / new window) to the browser.
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();

  const url = link.href;
  $('launch-host').textContent = hostOf(url);
  document.body.classList.add('leaving');
  setTimeout(() => {
    window.location.href = url;
  }, reducedMotion ? 0 : 280);
});

// ---------- Add-shortcut panel ----------

const panel = $('panel');
const panelBackdrop = $('panel-backdrop');
const panelClose = $('panel-close');
const panelSearch = $('panel-search');
const panelNotice = $('panel-notice');
const panelList = $('panel-list');

let searchToken = 0;

function looksLikeUrl(q) {
  if (/\s/.test(q)) return false;
  if (!q.includes('.')) return false;
  try {
    new URL(withScheme(q));
    return true;
  } catch (e) {
    return false;
  }
}

function withScheme(q) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(q) ? q : `https://${q}`;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const n = normalizeUrl(item.url);
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

function renderSection(label, items) {
  if (!items.length) return;

  const heading = document.createElement('p');
  heading.className = 'panel-section-label';
  heading.textContent = label;
  panelList.appendChild(heading);

  for (const item of items) {
    const row = document.createElement('button');
    row.className = 'panel-row';
    const added = isInDock(item.url);
    row.disabled = added;

    const icon = document.createElement('span');
    icon.className = 'row-icon';
    icon.appendChild(iconFor(item));

    const text = document.createElement('span');
    text.className = 'row-text';
    const title = document.createElement('span');
    title.className = 'row-title';
    title.textContent = item.title || hostOf(item.url);
    const host = document.createElement('span');
    host.className = 'row-host';
    host.textContent = hostOf(item.url);
    text.append(title, host);

    const state = document.createElement('span');
    state.className = 'row-state' + (added ? ' is-added' : '');
    state.textContent = added ? 'Added' : '';

    row.append(icon, text, state);
    row.addEventListener('click', async () => {
      const ok = await addShortcut(item);
      if (ok) {
        row.disabled = true;
        state.textContent = 'Added';
        state.classList.add('is-added');
      }
      updateNotice();
    });
    panelList.appendChild(row);
  }
}

function updateNotice() {
  panelNotice.hidden = shortcuts.length < MAX_SHORTCUTS;
}

async function refreshPanel() {
  const token = ++searchToken;
  const q = panelSearch.value.trim();

  let sections;
  if (!q) {
    const [top, bar] = await Promise.all([getTopSites(), getBookmarksBar()]);
    sections = [
      ['Most visited', dedupe(top).slice(0, 8)],
      ['Bookmarks', dedupe(bar).slice(0, 8)]
    ];
  } else {
    const [bookmarks, history] = await Promise.all([searchBookmarks(q), searchHistory(q)]);
    sections = [];
    if (looksLikeUrl(q)) {
      const url = withScheme(q);
      sections.push(['Add link', [{ title: hostOf(url), url }]]);
    }
    sections.push(['Bookmarks', dedupe(bookmarks).slice(0, 8)]);
    sections.push(['History', dedupe(history).slice(0, 8)]);
  }

  if (token !== searchToken) return; // a newer search finished first

  panelList.textContent = '';
  let total = 0;
  for (const [label, items] of sections) {
    renderSection(label, items);
    total += items.length;
  }

  if (!total) {
    const empty = document.createElement('p');
    empty.className = 'panel-empty';
    empty.textContent = q
      ? 'No matches — paste a full URL to add it directly.'
      : 'Type to search your bookmarks and history, or paste any URL.';
    panelList.appendChild(empty);
  }
  updateNotice();
}

function openPanel() {
  panelSearch.value = '';
  document.body.classList.add('panel-open');
  refreshPanel();
  panelSearch.focus();
}

function closePanel() {
  document.body.classList.remove('panel-open');
}

addBtn.addEventListener('click', openPanel);
panelClose.addEventListener('click', closePanel);
panelBackdrop.addEventListener('click', closePanel);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('panel-open')) closePanel();
});

let searchTimer;
panelSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refreshPanel, 150);
});

panelSearch.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const q = panelSearch.value.trim();
  if (looksLikeUrl(q)) {
    const url = withScheme(q);
    await addShortcut({ title: hostOf(url), url });
    refreshPanel();
  }
});

// ---------- Theme toggle ----------

$('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const isDark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = isDark ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch (e) {
    // Theme still applies for this tab; it just won't persist.
  }
});
