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
    renderCountdown();
  }
  greetingEl.textContent = greetingFor(now.getHours());
}

// ---------- Focus timer ----------

const clockEl = $('clock');
const timerControls = $('timer-controls');
const presetBtns = [...document.querySelectorAll('.preset')];
const controlsUnit = document.querySelector('.controls-unit');
const startBtn = $('timer-start');
const endBtn = $('timer-end');
const yearEl = $('year');
const sessionEl = $('session');
const sessionTicksEl = $('session-ticks');
const sessionLeftEl = $('session-left');
const timeUpEl = $('time-up');
const timeUpSub = $('time-up-sub');

let timerMode = 'clock'; // 'clock' | 'setup' | 'running' | 'done'
let timerMinutes = 25;
let timerEndsAt = 0;
let sessionBuiltMinute = -1;
let lastTimerSecond = -1;
let lastNowMinute = -1;

function hhmm(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function showSetupTime() {
  timeEl.textContent = `${String(timerMinutes).padStart(2, '0')}:00`;
  msEl.textContent = '';
}

function enterSetup() {
  timerMode = 'setup';
  dateEl.textContent = `Focus session · now ${hhmm(new Date())}`;
  showSetupTime();
  presetBtns.forEach((b) => { b.hidden = false; });
  controlsUnit.hidden = false;
  startBtn.hidden = false;
  endBtn.hidden = true;
  timerControls.hidden = false;
  clockEl.setAttribute('aria-label', 'Cancel focus session setup');
}

function beginRun(endsAt) {
  timerMode = 'running';
  timerEndsAt = endsAt;
  sessionBuiltMinute = -1;
  lastTimerSecond = -1;
  lastNowMinute = -1;
  presetBtns.forEach((b) => { b.hidden = true; });
  controlsUnit.hidden = true;
  startBtn.hidden = true;
  endBtn.hidden = false;
  timerControls.hidden = false;
  yearEl.hidden = true;
  sessionEl.hidden = false;
}

function startTimer() {
  const endsAt = Date.now() + timerMinutes * 60000;
  store.set('focusTimer', { endsAt, minutes: timerMinutes });
  beginRun(endsAt);
}

function exitTimer() {
  timerMode = 'clock';
  store.set('focusTimer', null);
  document.body.classList.remove('timer-done');
  timerControls.hidden = true;
  yearEl.hidden = false;
  sessionEl.hidden = true;
  lastSecond = -1;
  lastDay = -1;
  document.title = 'New Tab';
  clockEl.setAttribute('aria-label', 'Start a focus session');
}

function finishTimer() {
  timerMode = 'done';
  store.set('focusTimer', null);
  timeUpSub.textContent = `${timerMinutes} min focus complete · click to dismiss`;
  document.body.classList.add('timer-done');
  document.title = 'Time! · New Tab';
}

function buildSessionTicks(elapsedMin) {
  sessionTicksEl.textContent = '';
  for (let i = 0; i < timerMinutes; i++) {
    const tick = document.createElement('span');
    tick.className = 'tick' + (i < elapsedMin ? ' past' : i === elapsedMin ? ' cur' : '');
    tick.style.setProperty('--i', i);
    sessionTicksEl.appendChild(tick);
  }
}

function updateTimer(now) {
  const remaining = Math.max(0, timerEndsAt - now.getTime());
  const totalSec = Math.ceil(remaining / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  msEl.textContent = '.' + Math.floor((remaining % 1000) / 100);

  if (totalSec !== lastTimerSecond) {
    lastTimerSecond = totalSec;
    const text = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    timeEl.textContent = text;
    sessionLeftEl.textContent = `${text} left`;
    document.title = `${text} · Focus`;
  }

  // Keep the wall clock visible while focusing: it lives in the eyebrow line.
  if (now.getMinutes() !== lastNowMinute) {
    lastNowMinute = now.getMinutes();
    dateEl.textContent = `Now ${hhmm(now)} · focus ends ${hhmm(new Date(timerEndsAt))}`;
  }

  const elapsedMin = Math.min(timerMinutes - 1, Math.floor((timerMinutes * 60000 - remaining) / 60000));
  if (elapsedMin !== sessionBuiltMinute) {
    sessionBuiltMinute = elapsedMin;
    buildSessionTicks(elapsedMin);
  }

  if (remaining <= 0) finishTimer();
}

clockEl.addEventListener('click', () => {
  if (timerMode === 'clock') enterSetup();
  else if (timerMode === 'setup') exitTimer();
});

clockEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (timerMode === 'setup') startTimer();
    else clockEl.click();
  }
});

presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    timerMinutes = Number(btn.dataset.min);
    presetBtns.forEach((b) => b.classList.toggle('is-selected', b === btn));
    showSetupTime();
  });
});

startBtn.addEventListener('click', startTimer);
endBtn.addEventListener('click', exitTimer);
timeUpEl.addEventListener('click', exitTimer);

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
    document.body.classList.toggle('cursor-hover', !!e.target.closest('a, button, [role="button"]'));
  });
}

// ---------- Single animation loop ----------

function frame() {
  const now = new Date();
  if (timerMode === 'running') updateTimer(now);
  else if (timerMode === 'clock') updateClock(now);
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
  if (e.key !== 'Escape') return;
  if (document.body.classList.contains('panel-open')) closePanel();
  else if (!cdForm.hidden) closeCountdownForm();
  else if (timerMode === 'done') exitTimer();
  else if (timerMode === 'setup' || timerMode === 'running') exitTimer();
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

// ---------- Target-date countdown ----------

const cdBtn = $('countdown');
const cdForm = $('countdown-form');
const cdLabel = $('countdown-label');
const cdDate = $('countdown-date');
const cdRemove = $('countdown-remove');

let target = null; // { label, date: 'YYYY-MM-DD' }

function renderCountdown() {
  cdForm.hidden = true;
  cdBtn.hidden = false;
  cdBtn.textContent = '';

  if (!target) {
    cdBtn.classList.add('ghost');
    cdBtn.textContent = '+ Set a target date';
    return;
  }

  cdBtn.classList.remove('ghost');
  const [y, m, d] = target.date.split('-').map(Number);
  const now = new Date();
  const days = Math.round(
    (new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5
  );

  const strong = document.createElement('b');
  if (days > 0) {
    strong.textContent = `${days} day${days === 1 ? '' : 's'}`;
    cdBtn.append(`${target.label} in `, strong);
  } else if (days === 0) {
    strong.textContent = 'today';
    cdBtn.append(`${target.label} is `, strong);
  } else {
    strong.textContent = `${-days} day${days === -1 ? '' : 's'}`;
    cdBtn.append(`${target.label} was `, strong, ' ago');
  }
}

function closeCountdownForm() {
  renderCountdown();
}

cdBtn.addEventListener('click', () => {
  cdBtn.hidden = true;
  cdForm.hidden = false;
  cdLabel.value = target ? target.label : '';
  cdDate.value = target ? target.date : '';
  cdRemove.hidden = !target;
  cdLabel.focus();
});

cdForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const label = cdLabel.value.trim();
  if (!label || !cdDate.value) return;
  target = { label, date: cdDate.value };
  store.set('target', target);
  renderCountdown();
});

cdRemove.addEventListener('click', () => {
  target = null;
  store.set('target', null);
  renderCountdown();
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

// ---------- Restore persisted state (runs last: `store` is defined above) ----------

(async function restoreState() {
  const [savedTimer, savedTarget] = await Promise.all([
    store.get('focusTimer'),
    store.get('target')
  ]);

  if (savedTimer && savedTimer.endsAt > Date.now()) {
    timerMinutes = savedTimer.minutes;
    beginRun(savedTimer.endsAt);
  } else if (savedTimer) {
    store.set('focusTimer', null);
  }

  if (savedTarget && savedTarget.label && savedTarget.date) {
    target = savedTarget;
  }
  renderCountdown();
})();
