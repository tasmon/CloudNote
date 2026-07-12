// CloudNote v1.0.0 — final fixed version
const STORAGE_KEY = 'cloudnote_v1';
const DRAFT_KEY = 'cloudnote_draft_v1';
const PREFS_KEY = 'cloudnote_prefs_v1';

let notes = [];
let prefs = { compact: false };
let editingId = null;
let autosaveTimer = null;

const $ = id => document.getElementById(id);

// Utilities
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Storage
function loadAll(){
  try { notes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e){ notes = []; }
  try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || prefs; } catch(e){}
}
function saveNotes(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }
function savePrefs(){ localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }

// Render
function render(){
  const list = $('notes');
  list.innerHTML = '';

  if(notes.length === 0){
    $('empty-state').classList.remove('hidden');
    $('empty-state').setAttribute('aria-hidden', 'false');
  } else {
    $('empty-state').classList.add('hidden');
    $('empty-state').setAttribute('aria-hidden', 'true');
  }

  const out = notes.slice().sort((a,b)=>b.updated - a.updated);
  out.forEach(n => {
    const li = document.createElement('li');
    li.className = 'note' + (prefs.compact ? ' compact' : '');
    const title = document.createElement('div');
    title.className = 'note-title';
    title.innerHTML = `<span>${escapeHtml(n.title || 'Untitled')}</span><span>${new Date(n.updated).toLocaleTimeString()}</span>`;
    const body = document.createElement('div');
    body.className = 'note-body';
    body.textContent = n.body || '';
    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn small';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', ()=> openEditorFor(n.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn small';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', ()=> {
      if(confirm('Delete note?')) deleteNote(n.id);
    });

    actions.appendChild(openBtn);
    actions.appendChild(delBtn);

    li.appendChild(title);
    li.appendChild(body);
    li.appendChild(actions);
    list.appendChild(li);
  });
}

// Editor
function openEditorFor(id){
  const n = notes.find(x=>x.id===id);
  if(!n) return;
  editingId = id;
  $('note-title').value = n.title;
  $('note-body').value = n.body;
  $('save-btn').textContent = 'Update';
  showEditor(true);
}

function newNote(){
  editingId = null;
  $('note-title').value = '';
  $('note-body').value = '';
  $('save-btn').textContent = 'Save';
  showEditor(true);
}

function saveNote(){
  const title = $('note-title').value.trim();
  const body = $('note-body').value.trim();
  const now = Date.now();
  if(editingId){
    const n = notes.find(x=>x.id===editingId);
    if(!n) return;
    n.title = title;
    n.body = body;
    n.updated = now;
  } else {
    notes.push({ id: uid(), title, body, created: now, updated: now });
  }
  saveNotes();
  render();
  showEditor(false);
}

function deleteNote(id){
  notes = notes.filter(n=>n.id!==id);
  saveNotes();
  render();
}

function showEditor(show){
  const s = $('editor');
  if(show){
    s.classList.remove('hidden');
    s.setAttribute('aria-hidden','false');
    // focus title for quick entry
    setTimeout(()=> $('note-title').focus(), 120);
  } else {
    s.classList.add('hidden');
    s.setAttribute('aria-hidden','true');
  }
}

// Draft autosave
function autosaveDraft(){
  const draft = { title: $('note-title').value, body: $('note-body').value, editingId };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
function loadDraft(){
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    if(!d) return;
    $('note-title').value = d.title || '';
    $('note-body').value = d.body || '';
    editingId = d.editingId || null;
    if(d.title || d.body) showEditor(true);
  } catch(e){}
}

// Backup / Restore
function exportBackup(){
  const payload = { exportedAt: Date.now(), notes };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudnote-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackupFile(file){
  if(!file) return alert('No file selected.');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if(!data || !Array.isArray(data.notes)) throw new Error('Invalid backup file.');
      const merge = confirm('OK = Merge (keep existing, add new). Cancel = Replace (overwrite).');
      if(merge){
        const incoming = data.notes.map(normalizeNote);
        const map = new Map();
        notes.forEach(n => map.set(n.id, n));
        incoming.forEach(n => {
          if(!map.has(n.id)) map.set(n.id, n);
          else {
            const existing = map.get(n.id);
            if(n.updated > existing.updated) map.set(n.id, n);
          }
        });
        notes = Array.from(map.values());
      } else {
        notes = data.notes.map(normalizeNote);
      }
      saveNotes();
      render();
      alert('Restore completed.');
    } catch(err){
      alert('Restore failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function normalizeNote(n){
  return {
    id: n.id || uid(),
    title: n.title || '',
    body: n.body || '',
    created: n.created || Date.now(),
    updated: n.updated || Date.now()
  };
}

// Navigation
function showView(name){
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById('view-' + name);
  if(target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

// Wiring
document.addEventListener('DOMContentLoaded', ()=>{
  loadAll();
  loadDraft();
  render();

  // Navigation buttons
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.addEventListener('click', ()=> showView(b.dataset.view));
  });

  // New note
  $('new-note-btn').addEventListener('click', newNote);
  $('create-first').addEventListener('click', newNote);

  // Editor actions
  $('save-btn').addEventListener('click', saveNote);
  $('cancel-btn').addEventListener('click', ()=> showEditor(false));
  ['note-title','note-body'].forEach(id=>{
    $(id).addEventListener('input', ()=>{
      if(autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(autosaveDraft, 700);
    });
  });

  // Settings controls
  $('compact-toggle').addEventListener('change', e => {
    prefs.compact = !!e.target.checked;
    savePrefs();
    render();
  });

  // Backup / restore in settings
  $('export-btn').addEventListener('click', exportBackup);
  $('import-btn').addEventListener('click', ()=> {
    const f = $('import-file').files[0];
    if(!f) return alert('Choose a backup file first.');
    importBackupFile(f);
    $('import-file').value = '';
  });

  // Reset notes
  $('reset-btn').addEventListener('click', ()=> {
    if(confirm('Delete all notes?')){ notes = []; saveNotes(); render(); }
  });

  // Help -> nothing else needed (nav handles it)

  // Default view
  showView('home');
});

