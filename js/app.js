const DEFAULT_SLOTS = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Dubai'];
const STORAGE_KEY = 'worldclock_v2';

let state = {
  slots: [...DEFAULT_SLOTS],
  mode: 'analog',
  defaultIndex: 0,
  sliderOffset: 0
};

let clockRefs = [];
let rafId = null;
let editingIndex = -1;

function init() {
  loadState();
  applyMode();
  renderGrid();
  renderSlider();
  bindEvents();
  startClockLoop();
}

/* ─── Persistence ─── */
function loadState() {
  try {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const tzs = hash.split(',').filter(Boolean).slice(0, 4);
      if (tzs.length > 0) {
        state.slots = tzs;
        while (state.slots.length < 4) state.slots.push(null);
        ensureDefault();
        return;
      }
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.slots && Array.isArray(parsed.slots) && parsed.slots.length <= 4) {
        state.slots = parsed.slots;
        while (state.slots.length < 4) state.slots.push(null);
        if (typeof parsed.mode === 'string') state.mode = parsed.mode;
        if (typeof parsed.defaultIndex === 'number') state.defaultIndex = parsed.defaultIndex;
        if (typeof parsed.sliderOffset === 'number') state.sliderOffset = parsed.sliderOffset;
        ensureDefault();
        return;
      }
    }
  } catch (e) {}
  state.slots = [...DEFAULT_SLOTS];
  state.defaultIndex = 0;
  state.sliderOffset = 0;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    slots: state.slots,
    mode: state.mode,
    defaultIndex: state.defaultIndex,
    sliderOffset: state.sliderOffset
  }));
  const hash = state.slots.filter(Boolean).join(',');
  if (hash) {
    history.replaceState(null, '', '#' + hash);
  } else {
    history.replaceState(null, '', window.location.pathname);
  }
}

function ensureDefault() {
  const filled = state.slots.filter(Boolean);
  if (filled.length === 0) {
    state.defaultIndex = -1;
    return;
  }
  if (!state.slots[state.defaultIndex] || state.defaultIndex < 0) {
    const first = state.slots.findIndex(tz => tz !== null);
    if (first >= 0) state.defaultIndex = first;
  }
}

/* ─── Mode ─── */
function applyMode() {
  const app = document.getElementById('app');
  app.classList.remove('mode-analog', 'mode-digital');
  app.classList.add('mode-' + state.mode);
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const isActive = btn.dataset.mode === state.mode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive);
  });
}

/* ─── Helpers ─── */
function getFlagEmoji(code) {
  if (!code) return '🌐';
  const cps = code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...cps);
}

function getCityForTimezone(tz) {
  if (!tz) return null;
  return CITIES.find(c => c.tz === tz) || null;
}

function formatSliderOffset(val) {
  if (val === 0) return 'Now';
  const abs = Math.abs(val);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  const sign = val > 0 ? '+' : '-';
  if (h > 0 && m > 0) return sign + h + 'h ' + m + 'm';
  if (h > 0) return sign + h + 'h';
  return sign + m + 'm';
}

/* ─── Grid ─── */
function renderGrid() {
  const grid = document.getElementById('clockGrid');
  grid.innerHTML = '';
  clockRefs = [];
  _lastUnits = {};
  ensureDefault();

  state.slots.forEach((tz, i) => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.dataset.index = i;
    if (i === state.defaultIndex) card.classList.add('default-card');

    if (!tz) {
      card.classList.add('empty');
      card.innerHTML = `
        <button class="add-city-btn" data-index="${i}">
          <span class="add-icon">+</span>
          <span class="add-label">Add City</span>
        </button>
      `;
      grid.appendChild(card);
      clockRefs.push(null);
      return;
    }

    const city = getCityForTimezone(tz);
    const name = city ? city.name : tz.split('/').pop().replace(/_/g, ' ');
    const country = city ? city.country : '';
    const code = city ? city.code : '';
    const isDefault = i === state.defaultIndex;
    const starSvg = isDefault
      ? '<span class="mynaui--star-solid" style="color:#8C8D8D;font-size:18px"></span>'
      : '<span class="mynaui--star" style="color:#8C8D8D;font-size:18px"></span>';

    card.innerHTML = `
      <div class="card-stack">
        <div class="card-left">
          <button class="default-star${isDefault ? ' is-default' : ''}" data-index="${i}" title="${isDefault ? 'Default city' : 'Set as default'}">${starSvg}</button>
          <div class="country-block">
            <span class="country-code">${code}</span>
            <div class="city-country">
              <div class="city-name">${name}${isDefault ? '<span class="default-badge">Default</span>' : ''}</div>
              <div class="country-name">${country}</div>
            </div>
          </div>
        </div>
        <button class="card-menu-btn" data-index="${i}" aria-label="Options">
          <span class="iconamoon--menu-kebab-vertical" style="color:#8C8D8D;font-size:24px"></span>
        </button>
      </div>
      <div class="clock-container"></div>
      <div class="time-stack">
        <div class="time-row">
          <span class="dt-unit"><span class="dt-digit-in"></span></span>
          <span class="dt-sep">:</span>
          <span class="dt-unit"><span class="dt-digit-in"></span></span>
          <span class="dt-sep">:</span>
          <span class="dt-unit"><span class="dt-digit-in"></span></span>
          <span class="dt-ampm"></span>
        </div>
        <div class="meta-row">
          <span class="phase-indicator">
            <span class="phase-icon at-icons--sun" style="color:#8C8D8D;font-size:12px"></span>
            <span class="phase-text">Day</span>
          </span>
          <span class="utc-offset">UTC</span>
        </div>
        <div class="date-row"></div>
    `;

    const clockContainer = card.querySelector('.clock-container');
    const handElements = createClockSVG(clockContainer);
    clockRefs.push(handElements);

    populateCardSecondaryInfo(card, tz);

    grid.appendChild(card);
  });

}

function populateCardSecondaryInfo(card, tz) {
  const baseD = getBaseDate();
  const { hour } = getTimeInTimezone(tz, baseD);
  const phase = getDayPhase(hour);
  const phaseEl = card.querySelector('.phase-text');
  if (phaseEl) phaseEl.textContent = phase === 'day' ? 'Day' : 'Night';
  const iconEl = card.querySelector('.phase-icon');
  if (iconEl) iconEl.className = 'phase-icon ' + (phase === 'day' ? 'at-icons--sun' : 'mynaui--moon-solid');
  const offset = getUTCOffset(tz);
  const offEl = card.querySelector('.utc-offset');
  if (offEl) offEl.textContent = formatOffset(offset);
  card.dataset.phase = phase;
  card.dataset.offset = offset;
  const dateFmt = getFmt(tz, { weekday: 'short', day: 'numeric', month: 'short' });
  const dateParts = dateFmt.formatToParts(baseD);
  const wd = dateParts.find(p => p.type === 'weekday')?.value || '';
  const mo = dateParts.find(p => p.type === 'month')?.value || '';
  const dy = dateParts.find(p => p.type === 'day')?.value || '';
  const dateEl = card.querySelector('.date-row');
  if (dateEl) dateEl.textContent = `${wd}, ${mo} ${dy}`;
}

/* ─── Base Date (slider-aware) ─── */
function getBaseDate() {
  return new Date(Date.now() + state.sliderOffset * 3600000);
}

function triggerAnim(el) {
  el.classList.remove('dt-digit-in');
  void el.offsetWidth;
  el.classList.add('dt-digit-in');
}

/* ─── Clock Loop ─── */
let _infoTimer = 0;
let _lastUnits = {};

function startClockLoop() {
  function tick() {
    try {
      const baseDate = getBaseDate();

      state.slots.forEach((tz, i) => {
        if (tz && clockRefs[i] && state.mode === 'analog') {
          updateClock(clockRefs[i], tz, baseDate);
        }
      });

      /* Update time-row per-unit every frame */
      state.slots.forEach((tz, i) => {
        if (tz) {
          const card = document.querySelector(`.clock-card[data-index="${i}"]`);
          if (card) {
            const el = card.querySelector('.time-row');
            if (el) {
              const fmt = getFmt(tz, {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
              });
              const parts = fmt.formatToParts(baseDate);
              let h, m, s, ap;
              parts.forEach(p => {
                if (p.type === 'hour') h = p.value;
                else if (p.type === 'minute') m = p.value;
                else if (p.type === 'second') s = p.value;
                else if (p.type === 'dayPeriod') ap = p.value;
              });
              if (!_lastUnits[i]) _lastUnits[i] = {};
              const lu = _lastUnits[i];
              const changed = lu.h !== h || lu.m !== m || lu.s !== s || lu.ap !== ap;
              if (changed) {
                /* Build structure once */
                if (!el.children.length) {
                  el.innerHTML =
                    `<span class="dt-unit"><span class="dt-digit-in"></span></span>` +
                    `<span class="dt-sep">:</span>` +
                    `<span class="dt-unit"><span class="dt-digit-in"></span></span>` +
                    `<span class="dt-sep">:</span>` +
                    `<span class="dt-unit"><span class="dt-digit-in"></span></span>` +
                    `<span class="dt-ampm"></span>`;
                }
                const digits = el.querySelectorAll('.dt-digit-in');
                if (h !== lu.h && digits[0]) {
                  if (lu.h !== undefined) {
                    const out = document.createElement('span');
                    out.className = 'dt-digit-out'; out.textContent = lu.h;
                    digits[0].parentNode.appendChild(out);
                    setTimeout(() => out.remove(), 300);
                  }
                  digits[0].textContent = h; triggerAnim(digits[0]);
                }
                if (m !== lu.m && digits[1]) {
                  if (lu.m !== undefined) {
                    const out = document.createElement('span');
                    out.className = 'dt-digit-out'; out.textContent = lu.m;
                    digits[1].parentNode.appendChild(out);
                    setTimeout(() => out.remove(), 300);
                  }
                  digits[1].textContent = m; triggerAnim(digits[1]);
                }
                if (s !== lu.s && digits[2]) {
                  if (lu.s !== undefined) {
                    const out = document.createElement('span');
                    out.className = 'dt-digit-out'; out.textContent = lu.s;
                    digits[2].parentNode.appendChild(out);
                    setTimeout(() => out.remove(), 300);
                  }
                  digits[2].textContent = s; triggerAnim(digits[2]);
                }
                const ampm = el.querySelector('.dt-ampm');
                if (ampm) ampm.textContent = ap || '';
              }
              lu.h = h; lu.m = m; lu.s = s; lu.ap = ap;
            }
          }
        }
      });

      /* Throttle secondary info to once/second */
      if (Date.now() - _infoTimer > 1000) {
        _infoTimer = Date.now();
        state.slots.forEach((tz, i) => {
          if (tz) {
            const card = document.querySelector(`.clock-card[data-index="${i}"]`);
            if (card) populateCardSecondaryInfo(card, tz);
          }
        });
      }
    } catch (e) {
      console.warn('Clock tick error:', e);
    }
    rafId = requestAnimationFrame(tick);
  }
  tick();
}

/* ─── Search ─── */
function searchCities(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results = CITIES.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.country.toLowerCase().includes(q) ||
    c.tz.toLowerCase().includes(q)
  );
  const unique = [];
  const seen = new Set();
  results.forEach(c => {
    const key = c.tz;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  });
  return unique.slice(0, 30);
}

function renderSearchItems(results) {
  return results.map(c => {
    const offset = getUTCOffset(c.tz);
    const time = getTimeInTimezone(c.tz);
    const h = time.hour.toString().padStart(2, '0');
    const m = time.minute.toString().padStart(2, '0');
    return `<div class="search-item" data-tz="${c.tz}">
      <span class="search-flag">${getFlagEmoji(c.code)}</span>
      <div class="search-info">
        <span class="search-name">${c.name}</span>
        <span class="search-country">${c.country}</span>
      </div>
      <div class="search-meta">
        <span class="search-time">${h}:${m}</span>
        <span class="search-offset">${formatOffset(offset)}</span>
      </div>
    </div>`;
  }).join('');
}

/* ─── Inline Search ─── */
function openInlineSearch() {
  document.getElementById('topSearchResults').classList.add('open');
}

function closeInlineSearch() {
  document.getElementById('topSearchResults').classList.remove('open');
  document.getElementById('topSearch').value = '';
}

function handleInlineSearchSelect(tz) {
  const emptyIdx = state.slots.indexOf(null);
  if (emptyIdx !== -1) {
    state.slots[emptyIdx] = tz;
    if (state.defaultIndex < 0) ensureDefault();
    saveState();
    renderGrid();
    closeInlineSearch();
    if (state.sliderOffset !== 0) renderSlider();
  } else {
    showToast('Max 4 cities — remove one first');
    closeInlineSearch();
  }
}

/* ─── Toast ─── */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._toastTimer);
  el._toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ─── Slider ─── */
function renderSlider() {
  const slider = document.getElementById('timeSlider');
  const display = document.getElementById('sliderDisplay');
  slider.value = state.sliderOffset;
  display.textContent = formatSliderOffset(state.sliderOffset);
}

function updateSliderDisplay() {
  const display = document.getElementById('sliderDisplay');
  display.textContent = formatSliderOffset(state.sliderOffset);
}

/* ─── Modal Search ─── */
function openSearch(index) {
  editingIndex = index;
  const modal = document.getElementById('searchModal');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  modal.classList.add('open');
  input.value = '';
  results.innerHTML = '';
  setTimeout(() => input.focus(), 200);
}

function closeSearch() {
  document.getElementById('searchModal').classList.remove('open');
  editingIndex = -1;
}

/* ─── Card Popup ─── */
let popupIndex = -1;

function showCardActions(index) {
  closeCardPopup();
  popupIndex = index;
  const btn = document.querySelector(`.card-menu-btn[data-index="${index}"]`);
  if (!btn) return;
  const popup = document.getElementById('cardPopup');
  const rect = btn.getBoundingClientRect();
  popup.style.top = (rect.bottom + 4) + 'px';
  popup.style.right = (window.innerWidth - rect.right) + 'px';

  const isDefault = index === state.defaultIndex;
  const filledCount = state.slots.filter(Boolean).length;
  const inner = document.getElementById('cardPopupInner');
  inner.innerHTML = '';

  if (!isDefault) {
    const el = document.createElement('button');
    el.className = 'card-popup-btn';
    el.innerHTML = '<span class="mynaui--star" style="color:#8C8D8D;font-size:14px"></span> Set as default';
    el.addEventListener('click', e => {
      e.stopPropagation();
      state.defaultIndex = index;
      saveState();
      renderGrid();
      closeCardPopup();
    });
    inner.appendChild(el);
  }

  if (filledCount > 1) {
    const el = document.createElement('button');
    el.className = 'card-popup-btn danger';
    el.innerHTML = '✕ Remove city';
    el.addEventListener('click', e => {
      e.stopPropagation();
      state.slots[index] = null;
      if (isDefault) ensureDefault();
      saveState();
      renderGrid();
      closeCardPopup();
    });
    inner.appendChild(el);
  }

  popup.classList.add('open');
}

function closeCardPopup() {
  document.getElementById('cardPopup').classList.remove('open');
  popupIndex = -1;
}

/* ─── Events ─── */
function bindEvents() {
  /* ── Mode toggle ── */
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      applyMode();
      saveState();
    });
  });

  /* ── Inline search ── */
  const topSearch = document.getElementById('topSearch');
  let debounceTimer;

  topSearch.addEventListener('focus', () => {
    if (topSearch.value.trim()) {
      openInlineSearch();
    }
  });

  topSearch.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = topSearch.value;
    if (!query.trim()) {
      closeInlineSearch();
      return;
    }
    openInlineSearch();
    debounceTimer = setTimeout(() => {
      const results = searchCities(query);
      const container = document.getElementById('topSearchResults');
      if (results.length === 0) {
        container.innerHTML = '<div class="search-empty">No cities found</div>';
      } else {
        container.innerHTML = renderSearchItems(results);
      }
    }, 150);
  });

  topSearch.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeInlineSearch();
  });

  document.getElementById('topSearchResults').addEventListener('click', e => {
    const item = e.target.closest('.search-item');
    if (item) {
      handleInlineSearchSelect(item.dataset.tz);
    }
  });

  /* ── Close inline search on outside click ── */
  document.addEventListener('click', e => {
    const section = document.querySelector('.search-section');
    if (section && !section.contains(e.target)) {
      closeInlineSearch();
    }
  });

  /* ── Clock grid clicks ── */
  document.getElementById('clockGrid').addEventListener('click', e => {
    const addBtn = e.target.closest('.add-city-btn');
    if (addBtn) {
      openSearch(parseInt(addBtn.dataset.index));
      return;
    }

    const menuBtn = e.target.closest('.card-menu-btn');
    if (menuBtn) {
      e.stopPropagation();
      showCardActions(parseInt(menuBtn.dataset.index));
      return;
    }

    const starBtn = e.target.closest('.default-star');
    if (starBtn) {
      const idx = parseInt(starBtn.dataset.index);
      if (idx !== state.defaultIndex) {
        state.defaultIndex = idx;
        saveState();
        renderGrid();
      }
      return;
    }
  });

  /* ── Slider ── */
  const slider = document.getElementById('timeSlider');
  slider.addEventListener('input', () => {
    state.sliderOffset = parseFloat(slider.value);
    updateSliderDisplay();
    invalidateTimeCache();
  });

  slider.addEventListener('change', () => {
    saveState();
  });

  document.getElementById('sliderReset').addEventListener('click', () => {
    state.sliderOffset = 0;
    renderSlider();
    invalidateTimeCache();
    saveState();
  });

  /* ── Modal search ── */
  const searchInput = document.getElementById('searchInput');
  let modalDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(modalDebounce);
    modalDebounce = setTimeout(() => {
      const results = searchCities(searchInput.value);
      renderSearchResults(results);
    }, 150);
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
  });

  document.getElementById('searchResults').addEventListener('click', e => {
    const item = e.target.closest('.search-item');
    if (item) {
      const tz = item.dataset.tz;
      if (editingIndex >= 0 && editingIndex < 4) {
        state.slots[editingIndex] = tz;
        if (state.defaultIndex < 0) ensureDefault();
        saveState();
        renderGrid();
      }
      closeSearch();
    }
  });

  document.querySelector('.modal-backdrop').addEventListener('click', closeSearch);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSearch();
      closeCardPopup();
      closeInlineSearch();
    }
  });

  /* ── Popup outside click ── */
  document.addEventListener('click', e => {
    const popup = document.getElementById('cardPopup');
    if (popup.classList.contains('open') && !popup.contains(e.target) && !e.target.closest('.card-menu-btn')) {
      closeCardPopup();
    }
  });
}

function renderSearchResults(results) {
  const container = document.getElementById('searchResults');
  if (results.length === 0) {
    container.innerHTML = '<div class="search-empty">No cities found</div>';
    return;
  }
  container.innerHTML = renderSearchItems(results);
}

document.addEventListener('DOMContentLoaded', init);
