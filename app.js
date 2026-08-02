/* Notes for CloudPhone - shared utilities
 * Developer: Tasmon Islam
 */

var STORAGE_KEY = 'cp_notes_data_v1';
var SETTINGS_KEY = 'cp_notes_settings_v1';
var APP_VERSION = '1.0.0';

/* ---------- Storage ---------- */

function loadNotes() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch (e) {
    return false;
  }
}

function defaultSettings() {
  return { sort: 'updated_desc', fontSize: 'normal' };
}

function loadSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    var parsed = raw ? JSON.parse(raw) : {};
    var merged = defaultSettings();
    for (var k in parsed) { if (parsed.hasOwnProperty(k)) merged[k] = parsed[k]; }
    return merged;
  } catch (e) {
    return defaultSettings();
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function uid() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowTs() { return Date.now(); }

function formatDate(ts) {
  var d = new Date(ts);
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function getNoteById(id) {
  var notes = loadNotes();
  for (var i = 0; i < notes.length; i++) {
    if (notes[i].id === id) return notes[i];
  }
  return null;
}

function upsertNote(note) {
  var notes = loadNotes();
  var found = false;
  for (var i = 0; i < notes.length; i++) {
    if (notes[i].id === note.id) { notes[i] = note; found = true; break; }
  }
  if (!found) notes.push(note);
  saveNotes(notes);
}

function deleteNote(id) {
  var notes = loadNotes().filter(function (n) { return n.id !== id; });
  saveNotes(notes);
}

function sortNotes(notes, sortMode) {
  var arr = notes.slice();
  switch (sortMode) {
    case 'updated_asc':
      arr.sort(function (a, b) { return a.updatedAt - b.updatedAt; });
      break;
    case 'title_asc':
      arr.sort(function (a, b) {
        return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
      });
      break;
    case 'updated_desc':
    default:
      arr.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      break;
  }
  return arr;
}

/* ---------- Common page setup ---------- */

function applyFontSize() {
  var s = loadSettings();
  document.documentElement.setAttribute('data-fontsize', s.fontSize || 'normal');
}

function setupCommon() {
  applyFontSize();
  window.addEventListener('load', function () { window.focus(); });
  window.addEventListener('pageshow', function () { window.focus(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) window.focus();
  });
  document.body.addEventListener('click', function () { window.focus(); });
}

/* ---------- Softkeys ----------
 * LSK fires as 'Escape' on real CloudPhone hardware (device-tested).
 * SoftLeft / MenuKey / F1 are kept for emulator compatibility.
 * RSK fires as 'SoftRight' / 'F2' on hardware. 'Backspace' is kept as an
 * emulator/browser fallback, but only when the user isn't actively typing,
 * so it never eats a real backspace while editing a note.
 */

function bindLeftSoftKey(handler, label) {
  var el = document.getElementById('softkey-left');
  if (el) el.textContent = label || 'Menu';

  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'SoftLeft' || e.key === 'MenuKey' || e.key === 'F1') {
      e.preventDefault();
      handler();
    }
  }
  window.addEventListener('keydown', onKey);
  if (el) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('click', function (e) { e.preventDefault(); handler(); });
  }
  return function () { window.removeEventListener('keydown', onKey); };
}

function isTypingTarget() {
  var a = document.activeElement;
  return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));
}

function bindCenterSoftKey(handler, label) {
  var el = document.getElementById('softkey-center');
  if (el) el.textContent = label || 'Select';

  function onKey(e) {
    if (e.key === 'Enter' && !isTypingTarget()) {
      e.preventDefault();
      handler();
    }
  }
  window.addEventListener('keydown', onKey);
  if (el) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('click', function (e) { e.preventDefault(); handler(); });
  }
  return function () { window.removeEventListener('keydown', onKey); };
}

/* Secondary-page RSK: navigates back via full page load. */
function bindRightSoftKeyBack(targetUrl, label) {
  var el = document.getElementById('softkey-right');
  if (el) el.textContent = label || 'Back';

  function onKey(e) {
    if (e.key === 'SoftRight' || e.key === 'F2') {
      e.preventDefault();
      window.location.href = targetUrl;
    } else if (e.key === 'Backspace' && !isTypingTarget()) {
      e.preventDefault();
      window.location.href = targetUrl;
    }
  }
  window.addEventListener('keydown', onKey);
  if (el) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('click', function (e) { e.preventDefault(); window.location.href = targetUrl; });
  }
  return function () { window.removeEventListener('keydown', onKey); };
}

/* Secondary-page RSK with an intercept hook (e.g. "discard changes?" prompt).
 * onAttempt() should return true to allow navigation, or false to cancel
 * (in which case onAttempt is responsible for showing its own prompt). */
function bindRightSoftKeyGuarded(onAttempt, label) {
  var el = document.getElementById('softkey-right');
  if (el) el.textContent = label || 'Back';

  function attempt(e) {
    e.preventDefault();
    onAttempt();
  }

  function onKey(e) {
    if (e.key === 'SoftRight' || e.key === 'F2') {
      attempt(e);
    } else if (e.key === 'Backspace' && !isTypingTarget()) {
      attempt(e);
    }
  }
  window.addEventListener('keydown', onKey);
  if (el) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('click', attempt);
  }
  return function () { window.removeEventListener('keydown', onKey); };
}

/* Home screen: leave RSK completely unintercepted (native close/back applies). */
function labelHomeRightSoftKey(label) {
  var el = document.getElementById('softkey-right');
  if (el) el.textContent = label || 'Exit';
}

/* ---------- Custom modal (native confirm/alert unavailable) ---------- */

function showModal(message, buttons) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  var box = document.createElement('div');
  box.className = 'modal-box';

  var msg = document.createElement('p');
  msg.className = 'modal-message';
  msg.textContent = message;
  box.appendChild(msg);

  var btnRow = document.createElement('div');
  btnRow.className = 'modal-buttons';

  var focusIndex = 0;
  var btnEls = [];

  buttons.forEach(function (b, i) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = b.label;
    btn.className = 'modal-btn' + (b.primary ? ' primary' : '');
    btn.addEventListener('click', function () {
      cleanup();
      if (b.action) b.action();
    });
    btnRow.appendChild(btn);
    btnEls.push(btn);
  });

  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  if (btnEls[focusIndex]) btnEls[focusIndex].focus();

  function onKey(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusIndex = (focusIndex - 1 + btnEls.length) % btnEls.length;
      btnEls[focusIndex].focus();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex = (focusIndex + 1) % btnEls.length;
      btnEls[focusIndex].focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      btnEls[focusIndex].click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  }
  window.addEventListener('keydown', onKey, true);

  function cleanup() {
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
  }
  return cleanup;
}

/* ---------- Full-screen options menu (LSK menu) ---------- */

function showOptionsMenu(items) {
  var menu = document.createElement('menu');
  menu.className = 'options-menu';
  var idx = 0;
  var btns = [];

  items.forEach(function (item, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.label;
    b.className = 'menu-item' + (i === 0 ? ' focused' : '');
    if (item.danger) b.classList.add('danger');
    b.addEventListener('click', function () {
      close();
      if (item.action) item.action();
    });
    menu.appendChild(b);
    btns.push(b);
  });

  document.body.appendChild(menu);
  if (btns[0]) btns[0].focus();

  function setIdx(newIdx) {
    btns[idx].classList.remove('focused');
    idx = (newIdx + btns.length) % btns.length;
    btns[idx].classList.add('focused');
    btns[idx].focus();
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx(idx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx(idx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      btns[idx].click();
    }
  }
  window.addEventListener('keydown', onKey, true);

  function close() {
    window.removeEventListener('keydown', onKey, true);
    menu.remove();
  }
  return close;
}
