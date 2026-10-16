/* Hisaab — app logic. Vanilla JS, no build step. All data lives in localStorage. */
(function () {
  'use strict';
  const P = window.HisaabParser;
  const KEY = 'hisaab.v1';
  const UI_KEY = 'hisaab.ui';

  // ================= helpers =================
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const toP = r => Math.round((parseFloat(r) || 0) * 100);
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /** paise → "₹1,23,456" (decimals only when there are paise) */
  function fmt(p, opts = {}) {
    const a = Math.abs(Math.round(p));
    const s = '₹' + (a % 100 === 0 || opts.round ? nf0.format(Math.round(a / 100)) : nf2.format(a / 100));
    if (opts.sign && p !== 0) return (p > 0 ? '+' : '−') + s;
    return (p < 0 && !opts.abs ? '−' : '') + s;
  }
  function fmtCompact(p) {
    const r = Math.abs(p) / 100;
    if (r >= 1e7) return '₹' + (r / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (r >= 1e5) return '₹' + (r / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
    if (r >= 1e3) return '₹' + (r / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return '₹' + Math.round(r);
  }
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(s, withYear) {
    if (!s) return '';
    const [y, m, d] = s.split('-').map(Number);
    return `${d} ${MON[m - 1]}${withYear ? ' ' + y : ''}`;
  }
  function fmtDay(s) {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((t - dt) / 864e5);
    const wd = dt.toLocaleDateString('en-IN', { weekday: 'long' });
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${wd}, ${d} ${MON[m - 1]} ${y}`;
  }
  const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MON[m - 1]} ${y}`; };
  function timeAgo(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  // ================= icons =================
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    hand: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16" cy="14" r="1.5"/>',
    split: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>',
    in: '<line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/>',
    out: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    sparkle: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    car: '<rect x="2" y="9" width="20" height="8" rx="2"/><path d="M5 9l2-5h10l2 5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    fuel: '<line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    film: '<rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
    trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M6.5 17H20v5H6.5a2.5 2.5 0 0 1 0-5z"/>',
    swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    party: '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="M11 13 6.5 8.5"/><path d="M14.5 16.5 9.5 11.5a2 2 0 0 0-2.8 2.8l5 5a2 2 0 0 0 2.8-2.8z"/>',
  };
  const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const icon = (n, cls = '') => `<span class="ico ${cls}">${svg(n)}</span>`;

  // Category → icon + fixed chart colour (colour follows the category, never its rank).
  const OTHER_COLOR = '#9AA3A0';
  const CAT = {
    'Food & Dining': { icon: 'food', color: '#eb6834' },
    'Groceries': { icon: 'cart', color: '#008300' },
    'Travel': { icon: 'car', color: '#2a78d6' },
    'Shopping': { icon: 'bag', color: '#e87ba4' },
    'Bills & Utilities': { icon: 'zap', color: '#eda100' },
    'Entertainment': { icon: 'film', color: '#4a3aa7' },
    'Rent & Home': { icon: 'home', color: '#1baf7a' },
    'Transfers': { icon: 'swap', color: '#e34948' },
    'Fuel': { icon: 'fuel', color: OTHER_COLOR },
    'Health': { icon: 'heart', color: OTHER_COLOR },
    'Investments': { icon: 'trend', color: OTHER_COLOR },
    'Cash': { icon: 'cash', color: OTHER_COLOR },
    'Education': { icon: 'book', color: OTHER_COLOR },
    'Income': { icon: 'in', color: OTHER_COLOR },
    'Other': { icon: 'tag', color: OTHER_COLOR },
  };
  const catMeta = c => CAT[c] || CAT.Other;
  const chartCat = c => (catMeta(c).color === OTHER_COLOR ? 'Everything else' : c);
  const SERIES = { mine: '#00948A', lent: '#E9A23B' };

  const AVATAR_COLORS = ['#00948A', '#E8573F', '#7B4B94', '#176670', '#D9487D', '#5B8C2A', '#3D6FD8', '#B7791F', '#C2410C', '#0E7490'];
  const initials = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  function avatar(p, cls = '') {
    if (p === 'me' || p?.id === 'me') return `<span class="avatar me ${cls}" title="${esc(S.me)}">${esc(initials(S.me === 'You' ? 'Me' : S.me))}</span>`;
    if (!p) return '';
    return `<span class="avatar ${cls}" style="background:${p.color}" title="${esc(p.name)}">${esc(initials(p.name))}</span>`;
  }

  // ================= state =================
  const blank = () => ({ v: 1, me: 'You', transactions: [], people: [], groups: [], splits: {}, payments: [], imports: [], lastPick: [], sample: false });
  const C = window.HisaabCloud || { enabled: false, configured: false };
  const MODE_KEY = 'hisaab.mode';       // 'local' when the user chose to skip signing in
  const LAST_USER_KEY = 'hisaab.lastUser';
  // Signed-in users get their own cache key so two Google accounts on one browser never mix.
  let storageKey = KEY;
  let S = blank();
  let ui = Object.assign({ view: 'dashboard', period: 'all', q: '', type: 'all', status: 'all', cat: 'all', month: 'all', sort: 'new', limit: 150 }, loadUI());
  ui.selected = new Set();
  let modal = null;
  let lastImportText = '';

  function readKey(k) {
    try { const raw = localStorage.getItem(k); if (raw) return Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* storage blocked */ }
    return blank();
  }
  function load() { return readKey(storageKey); }
  function saveLocal() {
    try { localStorage.setItem(storageKey, JSON.stringify(S)); } catch (e) { toast('Could not save — browser storage is full or blocked', { err: true }); }
  }
  function save() {
    S.savedAt = Date.now();
    saveLocal();
    if (C.user) C.schedulePush(S);
  }
  const hasData = s => !!(s && (s.transactions.length || s.people.length));
  const localMode = () => { try { return localStorage.getItem(MODE_KEY) === 'local'; } catch (e) { return false; } };
  function loadUI() { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch (e) { return {}; } }
  function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify({ view: ui.view, period: ui.period })); } catch (e) { /* ignore */ } }

  /** Mutate state with an undo snapshot. */
  function commit(label, fn, opts = {}) {
    const before = JSON.stringify(S);
    fn(S);
    save();
    render();
    if (label) toast(label, opts.undo === false ? {} : { undo: () => { S = JSON.parse(before); save(); render(); toast('Undone'); } });
  }

  const personById = id => S.people.find(p => p.id === id);
  const txById = id => S.transactions.find(t => t.id === id);
  const activeTx = () => S.transactions.filter(t => !t.ignored);

  function addPerson(name) {
    name = name.trim().replace(/\s+/g, ' ');
    if (!name) return null;
    const existing = S.people.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const p = { id: uid('p'), name, color: AVATAR_COLORS[S.people.length % AVATAR_COLORS.length], at: Date.now() };
    S.people.push(p);
    return p;
  }

  // ================= ledger maths =================
  function balances() {
    const b = {};
    S.people.forEach(p => { b[p.id] = { lent: 0, got: 0, paidOut: 0, count: 0, last: 0 }; });
    for (const [txId, sp] of Object.entries(S.splits)) {
      const tx = txById(txId);
      if (!tx || tx.ignored) continue;
      for (const [pid, paise] of Object.entries(sp.shares)) {
        if (pid === 'me' || !b[pid]) continue;
        b[pid].lent += paise; b[pid].count++; b[pid].last = Math.max(b[pid].last, sp.at || 0);
      }
    }
    S.payments.forEach(pm => {
      if (!b[pm.personId]) return;
      if (pm.dir === 'out') b[pm.personId].paidOut += pm.paise; else b[pm.personId].got += pm.paise;
      b[pm.personId].last = Math.max(b[pm.personId].last, pm.at || 0);
    });
    Object.values(b).forEach(x => { x.balance = x.lent + x.paidOut - x.got; });
    return b;
  }
  const totalOwed = bal => Object.values(bal).reduce((s, x) => s + Math.max(0, x.balance), 0);
  function lentOnTx(tx) {
    const sp = S.splits[tx.id];
    if (!sp) return 0;
    return Object.entries(sp.shares).reduce((s, [pid, p]) => s + (pid === 'me' ? 0 : p), 0);
  }

  function distribute(totalP, weights, ids) {
    const W = ids.reduce((s, id) => s + weights[id], 0);
    if (W <= 0) return null;
    const out = {}; let used = 0; const fr = [];
    ids.forEach(id => { const raw = totalP * weights[id] / W; const f = Math.floor(raw + 1e-9); out[id] = f; used += f; fr.push([id, raw - f]); });
    let rem = totalP - used;
    // Leftover paise go to you first, so friends get clean round numbers.
    fr.sort((a, b) => (b[0] === 'me') - (a[0] === 'me') || b[1] - a[1]);
    for (let i = 0; rem > 0 && fr.length; i = (i + 1) % fr.length) { out[fr[i][0]]++; rem--; }
    return out;
  }

  function computeSplit(totalP, mode, ids, values) {
    if (!ids.length) return { ok: false, level: 'bad', msg: 'Pick who shares this expense', shares: {} };
    const w = {};
    if (mode === 'equal') { ids.forEach(id => { w[id] = 1; }); return { ok: true, level: 'ok', shares: distribute(totalP, w, ids) }; }
    if (mode === 'shares') {
      ids.forEach(id => { w[id] = Math.max(0, num(values[id] ?? 1)); });
      const sh = distribute(totalP, w, ids);
      return sh ? { ok: true, level: 'ok', shares: sh } : { ok: false, level: 'bad', msg: 'Give at least one person a share', shares: {} };
    }
    if (mode === 'percent') {
      let sum = 0; ids.forEach(id => { w[id] = Math.max(0, num(values[id])); sum += w[id]; });
      const shares = {}; ids.forEach(id => { shares[id] = Math.round(totalP * w[id] / 100); });
      const d = Math.round((100 - sum) * 100) / 100;
      if (Math.abs(d) > 0.01) return { ok: false, level: d > 0 ? 'warn' : 'bad', msg: d > 0 ? `${d}% still to assign` : `${-d}% over — reduce someone`, shares };
      return { ok: true, level: 'ok', shares: distribute(totalP, w, ids) };
    }
    // exact
    const shares = {}; let sum = 0;
    ids.forEach(id => { shares[id] = Math.max(0, toP(values[id])); sum += shares[id]; });
    const diff = totalP - sum;
    if (diff !== 0) return { ok: false, level: diff > 0 ? 'warn' : 'bad', msg: diff > 0 ? `${fmt(diff)} still to assign` : `${fmt(-diff)} over the total`, shares };
    return { ok: true, level: 'ok', shares };
  }

  function defaultValues(mode, ids, totalP) {
    const v = {};
    if (mode === 'shares') ids.forEach(id => { v[id] = 1; });
    if (mode === 'percent') {
      const base = Math.floor(10000 / ids.length) / 100;
      ids.forEach((id, i) => { v[id] = i === 0 ? Math.round((100 - base * (ids.length - 1)) * 100) / 100 : base; });
    }
    if (mode === 'exact') {
      const w = {}; ids.forEach(id => { w[id] = 1; });
      const sh = distribute(totalP, w, ids) || {};
      ids.forEach(id => { v[id] = ((sh[id] || 0) / 100).toFixed(2).replace(/\.00$/, ''); });
    }
    return v;
  }

  // ================= rendering =================
  const VIEWS = {
    dashboard: { title: 'Dashboard', render: renderDashboard },
    transactions: { title: 'Transactions', render: renderTransactions },
    people: { title: 'People', render: renderPeople },
  };

  function render() {
    const v = VIEWS[ui.view] || VIEWS.dashboard;
    $('#page-title').textContent = v.title;
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === ui.view));
    const bal = balances();
    const owing = Object.values(bal).filter(x => x.balance > 0).length;
    const bp = $('#badge-people'); bp.hidden = !owing; bp.textContent = owing;
    $('#view').innerHTML = v.render(bal);
    renderBulkbar();
    if (modal) renderModal();
  }

  function setView(view, opts = {}) {
    ui.view = view; ui.selected.clear();
    Object.assign(ui, opts);
    saveUI();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- dashboard ----------
  function periodTx() { return activeTx().filter(t => ui.period === 'all' || t.date.startsWith(ui.period)); }
  function months() { return [...new Set(S.transactions.map(t => t.date.slice(0, 7)))].sort().reverse(); }
  function dataRange() {
    if (!S.transactions.length) return '';
    const ds = S.transactions.map(t => t.date).sort();
    return `${fmtDate(ds[0], true)} – ${fmtDate(ds[ds.length - 1], true)}`;
  }

  function renderDashboard(bal) {
    $('#page-sub').textContent = S.transactions.length ? `Statement data · ${dataRange()}` : 'Welcome! Let\'s get your hisaab in order.';
    if (!S.transactions.length && !S.people.length) return renderWelcome();
    const owed = totalOwed(bal);
    const debtors = S.people.filter(p => bal[p.id].balance > 0).sort((a, b) => bal[b.id].balance - bal[a.id].balance);
    const settledSoFar = Object.values(bal).reduce((s, x) => s + x.got, 0);
    const tx = periodTx();
    const out = tx.filter(t => t.type === 'debit').reduce((s, t) => s + toP(t.amount), 0);
    const inn = tx.filter(t => t.type === 'credit').reduce((s, t) => s + toP(t.amount), 0);
    const lent = tx.filter(t => t.type === 'debit').reduce((s, t) => s + lentOnTx(t), 0);
    const splitCount = tx.filter(t => S.splits[t.id]).length;
    const ms = months();
    const iOwe = Object.values(bal).filter(x => x.balance < 0).reduce((s, x) => s - x.balance, 0);

    return `
      ${S.sample ? `<div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:18px;background:var(--amber-soft);border-color:#F1D39C">
        ${icon('sparkle')}<div style="flex:1"><b>You're exploring sample data.</b> <span style="color:var(--ink-2)">Play around freely — when you're ready, clear it and import your own ICICI statement.</span></div>
        <button class="btn btn-sm btn-ghost" data-action="clear-sample">Clear sample</button><button class="btn btn-sm btn-primary" data-action="open-import">Import mine</button></div>` : ''}
      <div class="hero">
        <div style="position:relative;z-index:1">
          <div class="hero-label">People owe you</div>
          <div class="hero-amount num" data-countup="${owed}"><span class="cur">₹</span>${nf0.format(Math.round(owed / 100))}</div>
          <div class="hero-meta">
            <span><b>${debtors.length}</b> ${debtors.length === 1 ? 'person' : 'people'} pending</span>
            <span><b>${fmt(settledSoFar)}</b> paid back so far</span>
            ${iOwe ? `<span>You owe <b>${fmt(iOwe)}</b></span>` : ''}
          </div>
          <div class="hero-actions">
            <button class="btn btn-amber" data-action="open-payment">${icon('hand')}Record a payment</button>
            <button class="btn btn-on-dark" data-action="nav" data-view="people">See everyone ${icon('chevron', 'ico-sm')}</button>
          </div>
        </div>
        <div class="hero-side">
          <div class="avatar-stack">${debtors.slice(0, 5).map(p => avatar(p, 'lg')).join('')}${debtors.length > 5 ? `<span class="avatar lg" style="background:rgba(255,255,255,.2)">+${debtors.length - 5}</span>` : ''}</div>
          ${debtors[0] ? `<div style="color:#CFE5E1;font-size:13px;text-align:right">Biggest: <b style="color:#fff">${esc(debtors[0].name)}</b> · ${fmt(bal[debtors[0].id].balance)}</div>` : '<div style="color:#CFE5E1;font-size:13px">Split an expense to start tracking</div>'}
        </div>
      </div>

      <div class="filterbar" style="margin:22px 0 14px">
        <div class="chips">
          <button class="chip ${ui.period === 'all' ? 'on' : ''}" data-action="period" data-period="all">All time</button>
          ${ms.slice(0, 6).map(m => `<button class="chip ${ui.period === m ? 'on' : ''}" data-action="period" data-period="${m}">${monthLabel(m)}</button>`).join('')}
        </div>
      </div>

      <div class="kpis">
        ${kpi('out', 'tint-coral', 'Money spent', fmt(out, { round: true }), `${tx.filter(t => t.type === 'debit').length} payments`, 'go-tx-type', 'debit')}
        ${kpi('in', 'tint-teal', 'Money received', fmt(inn, { round: true }), `${tx.filter(t => t.type === 'credit').length} credits`, 'go-tx-type', 'credit')}
        ${kpi('split', 'tint-amber', 'Lent to friends', fmt(lent, { round: true }), `${splitCount} split expense${splitCount === 1 ? '' : 's'}`, 'go-tx-status', 'split')}
        ${kpi('sparkle', 'tint-plum', 'Your real spend', fmt(out - lent, { round: true }), 'after friends\' shares', 'go-tx-status', 'unsplit')}
      </div>

      <div class="grid grid-3" style="margin-top:18px">
        <div class="card">
          <div class="card-head"><div><h3 class="card-title">Who owes you</h3><div class="card-sub">Outstanding balance per person</div></div><button class="link" data-action="nav" data-view="people">Manage</button></div>
          ${renderRankList(bal)}
        </div>
        <div class="card">
          <div class="card-head"><div><h3 class="card-title">Where your money went</h3><div class="card-sub">${ui.period === 'all' ? 'All time' : monthLabel(ui.period)} · spending by category</div></div></div>
          ${renderDonut(tx.filter(t => t.type === 'debit'))}
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:18px">
        <div class="card">
          <div class="card-head">
            <div><h3 class="card-title">Monthly spending</h3><div class="card-sub">Click a month to focus on it</div></div>
            <div class="legend-inline"><span><i style="background:${SERIES.mine}"></i>Your share</span><span><i style="background:${SERIES.lent}"></i>Lent to friends</span></div>
          </div>
          ${renderMonthly()}
        </div>
        <div class="card">
          <div class="card-head"><div><h3 class="card-title">Recent activity</h3><div class="card-sub">Splits, payments & imports</div></div></div>
          ${renderFeed(6)}
        </div>
      </div>`;
  }

  function kpi(ic, tint, label, val, foot, action, arg) {
    return `<div class="card kpi clickable" data-action="${action}" data-arg="${arg}" title="See these transactions">
      <div class="kpi-top"><span class="kpi-ico ${tint}">${icon(ic)}</span>${label}</div>
      <div class="kpi-val num">${val}</div><div class="kpi-foot">${foot}</div></div>`;
  }

  function renderRankList(bal) {
    const ppl = S.people.filter(p => bal[p.id].balance !== 0).sort((a, b) => bal[b.id].balance - bal[a.id].balance);
    if (!ppl.length) {
      return `<div class="empty" style="padding:26px 10px">${icon('users', 'ico-xl')}<h3>${S.people.length ? 'Everyone is settled up' : 'No one here yet'}</h3>
        <p>${S.people.length ? 'Nice — no pending balances.' : 'Split an expense and add the friends you shared it with.'}</p>
        <button class="btn btn-primary btn-sm" data-action="nav" data-view="transactions">${icon('split')}Split an expense</button></div>`;
    }
    const max = Math.max(...ppl.map(p => Math.abs(bal[p.id].balance)));
    return `<div class="rank-list">${ppl.slice(0, 7).map(p => {
      const b = bal[p.id].balance;
      return `<div class="rank-row" data-action="open-person" data-id="${p.id}" data-tip="${esc(`<div class='tt-title'>${esc(p.name)}</div><div class='tt-row'>Lent <b>${fmt(bal[p.id].lent)}</b></div><div class='tt-row'>Paid back <b>${fmt(bal[p.id].got)}</b></div>`)}">
        ${avatar(p)}
        <div><div class="rank-name"><span>${esc(p.name)}</span><span class="num ${b > 0 ? 'amt-pos' : 'amt-neg'}">${b > 0 ? '' : 'you owe '}${fmt(b, { abs: true })}</span></div>
        <div class="rank-bar ${b < 0 ? 'neg' : ''}"><i style="width:${Math.max(3, Math.abs(b) / max * 100)}%"></i></div></div>
        ${icon('chevron', 'ico-sm')}
      </div>`;
    }).join('')}</div>`;
  }

  function renderDonut(debits) {
    const by = {};
    debits.forEach(t => { const k = chartCat(t.category); by[k] = (by[k] || 0) + toP(t.amount); });
    const rows = Object.entries(by).sort((a, b) => (a[0] === 'Everything else') - (b[0] === 'Everything else') || b[1] - a[1]);
    const total = rows.reduce((s, r) => s + r[1], 0);
    if (!total) return `<div class="empty" style="padding:30px">${icon('tag', 'ico-xl')}<h3>No spending in this period</h3></div>`;
    const R = 84, r0 = 56, cx = 90, cy = 90;
    let a0 = -Math.PI / 2;
    const arcs = rows.map(([k, v]) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const pt = (rad, a) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
      const color = k === 'Everything else' ? OTHER_COLOR : catMeta(k).color;
      const d = rows.length === 1
        ? `M${cx - R},${cy} a${R},${R} 0 1,0 ${2 * R},0 a${R},${R} 0 1,0 ${-2 * R},0 M${cx - r0},${cy} a${r0},${r0} 0 1,1 ${2 * r0},0 a${r0},${r0} 0 1,1 ${-2 * r0},0`
        : `M${pt(R, a0)} A${R},${R} 0 ${large} 1 ${pt(R, a1)} L${pt(r0, a1)} A${r0},${r0} 0 ${large} 0 ${pt(r0, a0)} Z`;
      a0 = a1;
      const tip = `<div class='tt-title'>${esc(k)}</div><div class='tt-row'><span><i style='background:${color}'></i>${(v / total * 100).toFixed(1)}%</span><b>${fmt(v)}</b></div>`;
      return `<path d="${d}" fill="${color}" fill-rule="evenodd" stroke="var(--sand-0)" stroke-width="2" data-tip="${esc(tip)}" data-action="go-cat" data-arg="${esc(k)}"/>`;
    }).join('');
    return `<div class="donut-wrap">
      <svg class="donut" viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Spending by category">
        ${arcs}
        <text x="90" y="88" text-anchor="middle" class="donut-center">${fmtCompact(total)}</text>
        <text x="90" y="106" text-anchor="middle" class="donut-center-sub">total spent</text>
      </svg>
      <div class="legend">${rows.map(([k, v]) => `<div class="legend-row" data-action="go-cat" data-arg="${esc(k)}" title="Show ${esc(k)} transactions">
        <span class="sw" style="background:${k === 'Everything else' ? OTHER_COLOR : catMeta(k).color}"></span><span>${esc(k)}</span>
        <b class="num">${fmt(v, { round: true })}</b><span class="pct num">${Math.round(v / total * 100)}%</span></div>`).join('')}</div>
    </div>`;
  }

  function renderMonthly() {
    const ms = months().slice(0, 6).reverse();
    if (!ms.length) return '<div class="empty">No data yet</div>';
    const data = ms.map(m => {
      const d = activeTx().filter(t => t.type === 'debit' && t.date.startsWith(m));
      const total = d.reduce((s, t) => s + toP(t.amount), 0);
      const lent = d.reduce((s, t) => s + lentOnTx(t), 0);
      return { m, mine: total - lent, lent, total };
    });
    const W = 560, H = 220, padL = 46, padB = 26, padT = 18;
    const max = Math.max(1, ...data.map(d => d.total));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const y = v => padT + (H - padT - padB) * (1 - v / top);
    const bw = Math.min(46, (W - padL) / data.length * 0.5);
    const slot = (W - padL) / data.length;
    let grid = '';
    for (let v = 0; v <= top; v += step) grid += `<line class="grid-line" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${fmtCompact(v)}</text>`;
    const bars = data.map((d, i) => {
      const x = padL + slot * i + (slot - bw) / 2;
      const yMine = y(d.mine), yTop = y(d.total);
      const gap = d.lent && d.mine ? 2 : 0;
      const sel = ui.period === d.m;
      const tip = `<div class='tt-title'>${monthLabel(d.m)}</div><div class='tt-row'><span><i style='background:${SERIES.mine}'></i>Your share</span><b>${fmt(d.mine, { round: true })}</b></div><div class='tt-row'><span><i style='background:${SERIES.lent}'></i>Lent</span><b>${fmt(d.lent, { round: true })}</b></div><div class='tt-row' style='margin-top:4px;opacity:.8'><span>Total</span><b>${fmt(d.total, { round: true })}</b></div>`;
      const roundTop = (yy, h, fill) => h <= 0 ? '' : `<path d="M${x},${yy + h} V${yy + Math.min(4, h)} Q${x},${yy} ${x + 4},${yy} H${x + bw - 4} Q${x + bw},${yy} ${x + bw},${yy + Math.min(4, h)} V${yy + h} Z" fill="${fill}"/>`;
      const mineH = y(0) - yMine;
      const lentH = Math.max(0, yMine - yTop - gap);
      return `<g opacity="${ui.period !== 'all' && !sel ? .45 : 1}">
        ${d.lent ? roundTop(yTop, lentH, SERIES.lent) + (mineH > 0 ? `<rect x="${x}" y="${yMine}" width="${bw}" height="${mineH}" fill="${SERIES.mine}"/>` : '') : roundTop(yMine, mineH, SERIES.mine)}
        <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" style="${sel ? 'fill:var(--ink);font-weight:700' : ''}">${MON[+d.m.slice(5) - 1]}</text>
        <rect class="bar-hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${H - padT - padB}" data-tip="${esc(tip)}" data-action="period" data-period="${sel ? 'all' : d.m}"/>
      </g>`;
    }).join('');
    return `<svg class="bars-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Monthly spending">${grid}${bars}</svg>`;
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  function events() {
    const ev = [];
    for (const [txId, sp] of Object.entries(S.splits)) {
      const tx = txById(txId); if (!tx) continue;
      const others = Object.keys(sp.shares).filter(id => id !== 'me').map(personById).filter(Boolean);
      ev.push({ at: sp.at || 0, ico: 'split', tint: 'tint-amber', title: `Split ${esc(tx.merchant)}`, sub: `with ${others.map(p => esc(p.name)).join(', ')} · ${fmtDate(tx.date)}`, amt: `<span class="num amt-pos">+${fmt(lentOnTx(tx))}</span>`, action: `data-action="open-tx" data-id="${tx.id}"` });
    }
    S.payments.forEach(pm => {
      const p = personById(pm.personId); if (!p) return;
      ev.push({ at: pm.at, ico: pm.dir === 'out' ? 'out' : 'in', tint: pm.dir === 'out' ? 'tint-coral' : 'tint-teal', title: pm.dir === 'out' ? `You paid ${esc(p.name)}` : `${esc(p.name)} paid you`, sub: `${fmtDate(pm.date)}${pm.note ? ' · ' + esc(pm.note) : ''}`, amt: `<span class="num">${fmt(pm.paise)}</span>`, action: `data-action="open-person" data-id="${p.id}"` });
    });
    S.imports.forEach(im => ev.push({ at: im.at, ico: 'file', tint: 'tint-plum', title: `Imported ${im.count} transactions`, sub: esc(im.name), amt: '', action: '' }));
    return ev.sort((a, b) => b.at - a.at);
  }
  function renderFeed(n) {
    const ev = events().slice(0, n);
    if (!ev.length) return `<div class="empty" style="padding:24px">Nothing yet — your splits and payments will show up here.</div>`;
    return `<div class="feed">${ev.map(e => `<div class="feed-item" ${e.action} style="${e.action ? 'cursor:pointer' : ''}">
      <span class="feed-ico ${e.tint}">${icon(e.ico)}</span>
      <div style="min-width:0"><div class="feed-title">${e.title}</div><div class="feed-sub">${e.sub} · ${timeAgo(e.at)}</div></div>${e.amt}</div>`).join('')}</div>`;
  }

  function renderWelcome() {
    return `
      <div class="welcome">
        <div style="position:relative;z-index:1">
          <span class="eyebrow">${icon('sparkle', 'ico-sm')} Your personal split ledger</span>
          <h2>Know exactly <em>who owes you</em>,<br/>straight from your bank statement.</h2>
          <p>Drop in your ICICI statement, tap any expense to split it with friends, and Hisaab keeps a running tab of every rupee — until they pay you back.</p>
          <div class="welcome-actions">
            <button class="btn btn-amber" data-action="open-import">${icon('upload')}Import ICICI statement</button>
            <button class="btn btn-on-dark" data-action="load-sample">${icon('sparkle')}Try with sample data</button>
          </div>
        </div>
        <div class="floaty" aria-hidden="true">
          <div class="float-card"><span class="avatar" style="background:#E8573F">RK</span><div><small>Rohan owes you</small><b>₹2,450</b></div></div>
          <div class="float-card"><span class="avatar" style="background:#7B4B94">AS</span><div><small>Weekend trip · split 3 ways</small><b>₹3,266 each</b></div></div>
          <div class="float-card"><span class="avatar" style="background:#00948A">MJ</span><div><small>Meera paid you back</small><b>₹800 ✓</b></div></div>
        </div>
      </div>
      <div class="steps">
        <div class="card step"><div class="step-num tint-teal">1</div><h4>Import your statement</h4><p>Net Banking → Accounts → Statement → download as CSV. Drag it anywhere on this page.</p></div>
        <div class="card step"><div class="step-num tint-amber">2</div><h4>Split what you shared</h4><p>Tap an expense, pick friends, choose equal, exact, % or shares. Add new names on the spot.</p></div>
        <div class="card step"><div class="step-num tint-coral">3</div><h4>Track & settle</h4><p>See who owes what at a glance, record repayments, and copy a neat reminder to send.</p></div>
      </div>`;
  }

  // ---------- transactions ----------
  function filteredTx() {
    const q = ui.q.trim().toLowerCase();
    let list = S.transactions.filter(t => {
      if (ui.type !== 'all' && t.type !== ui.type) return false;
      if (ui.status === 'split' && !S.splits[t.id]) return false;
      if (ui.status === 'unsplit' && (S.splits[t.id] || t.type !== 'debit')) return false;
      if (ui.status === 'hidden' ? !t.ignored : (t.ignored && ui.status !== 'all')) return false;
      if (ui.cat !== 'all' && (ui.cat === 'Everything else' ? chartCat(t.category) !== 'Everything else' : t.category !== ui.cat)) return false;
      if (ui.month !== 'all' && !t.date.startsWith(ui.month)) return false;
      if (q) {
        const sp = S.splits[t.id];
        const names = sp ? Object.keys(sp.shares).map(id => personById(id)?.name || '').join(' ') : '';
        const hay = `${t.merchant} ${t.desc} ${t.note || ''} ${t.category} ${names} ${t.amount}`.toLowerCase();
        if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
      }
      return true;
    });
    const cmp = { new: (a, b) => b.date.localeCompare(a.date) || (b.seq || 0) - (a.seq || 0), old: (a, b) => a.date.localeCompare(b.date) || (a.seq || 0) - (b.seq || 0), big: (a, b) => b.amount - a.amount };
    return list.sort(cmp[ui.sort] || cmp.new);
  }

  function renderTransactions() {
    if (!S.transactions.length) {
      $('#page-sub').textContent = 'Nothing imported yet';
      return `<div class="card empty">${icon('file', 'ico-xl')}<h3>No transactions yet</h3><p>Import an ICICI statement CSV, or add a cash expense by hand.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:14px"><button class="btn btn-primary" data-action="open-import">${icon('upload')}Import statement</button><button class="btn btn-ghost" data-action="open-add-expense">${icon('plus')}Add expense</button></div></div>`;
    }
    const list = filteredTx();
    const out = list.filter(t => t.type === 'debit' && !t.ignored).reduce((s, t) => s + toP(t.amount), 0);
    const inn = list.filter(t => t.type === 'credit' && !t.ignored).reduce((s, t) => s + toP(t.amount), 0);
    $('#page-sub').textContent = `${S.transactions.length} transactions · ${dataRange()}`;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${ui[key] === v ? 'on' : ''}" data-action="filter" data-key="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
    const cats = [...new Set(S.transactions.map(t => t.category))].sort();
    const active = ui.type !== 'all' || ui.status !== 'all' || ui.cat !== 'all' || ui.month !== 'all' || ui.q;
    const shown = list.slice(0, ui.limit);
    let html = '', day = '';
    shown.forEach(t => {
      if (ui.sort !== 'big' && t.date !== day) {
        day = t.date;
        const dayTotal = list.filter(x => x.date === day && x.type === 'debit' && !x.ignored).reduce((s, x) => s + toP(x.amount), 0);
        html += `<div class="tx-day"><span>${fmtDay(day)}</span><span class="num">${dayTotal ? fmt(dayTotal) + ' spent' : ''}</span></div>`;
      }
      html += txRow(t);
    });
    return `
      <div class="filterbar">
        ${seg('type', [['all', 'All'], ['debit', 'Spent'], ['credit', 'Received']])}
        ${seg('status', [['all', 'Any'], ['unsplit', 'Not split'], ['split', 'Split'], ['hidden', 'Hidden']])}
        <select class="select" data-action-change="filter" data-key="cat"><option value="all">All categories</option>${cats.map(c => `<option ${ui.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}${ui.cat === 'Everything else' ? '<option selected>Everything else</option>' : ''}</select>
        <select class="select" data-action-change="filter" data-key="month"><option value="all">All months</option>${months().map(m => `<option value="${m}" ${ui.month === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
        <select class="select" data-action-change="filter" data-key="sort"><option value="new" ${ui.sort === 'new' ? 'selected' : ''}>Newest first</option><option value="old" ${ui.sort === 'old' ? 'selected' : ''}>Oldest first</option><option value="big" ${ui.sort === 'big' ? 'selected' : ''}>Largest first</option></select>
        ${active ? `<button class="btn btn-sm btn-quiet" data-action="clear-filters">${icon('x', 'ico-sm')}Clear</button>` : ''}
        <div class="filter-summary"><b>${list.length}</b> shown · <b class="amt-neg">${fmt(out, { round: true })}</b> out · <b class="amt-pos">${fmt(inn, { round: true })}</b> in</div>
      </div>
      <div class="card tx-list" style="padding:0">
        ${shown.length ? html : `<div class="empty">${icon('search', 'ico-xl')}<h3>No matches</h3><p>Try a different search or clear the filters.</p></div>`}
        ${list.length > ui.limit ? `<div style="text-align:center;padding:16px"><button class="btn btn-ghost" data-action="more">Show ${Math.min(150, list.length - ui.limit)} more</button></div>` : ''}
      </div>
      <p style="color:var(--muted);font-size:12.5px;text-align:center;margin-top:14px">Tip: tick several expenses to split them together · press <kbd>/</kbd> to search</p>`;
  }

  function txRow(t) {
    const m = catMeta(t.category);
    const sp = S.splits[t.id];
    const pay = t.type === 'credit' && S.payments.find(p => p.txId === t.id);
    const sel = ui.selected.has(t.id);
    let splitCell = '';
    if (sp) {
      const ppl = Object.keys(sp.shares).filter(id => id !== 'me').map(personById).filter(Boolean);
      splitCell = `<div class="avatar-stack">${ppl.slice(0, 4).map(p => avatar(p, 'sm')).join('')}</div>${ppl.length > 4 ? `<span class="card-sub">+${ppl.length - 4}</span>` : ''}`;
    } else if (pay) {
      const p = personById(pay.personId);
      splitCell = p ? `${avatar(p, 'sm')}<span class="card-sub">from ${esc(p.name.split(' ')[0])}</span>` : '';
    } else if (!t.ignored) {
      splitCell = t.type === 'debit'
        ? `<button class="btn btn-xs btn-ghost split-cta" data-action="open-split" data-id="${t.id}">${icon('split', 'ico-sm')}Split</button>`
        : `<button class="btn btn-xs btn-ghost split-cta" data-action="open-payment-tx" data-id="${t.id}">${icon('hand', 'ico-sm')}Repayment?</button>`;
    }
    const lent = sp ? lentOnTx(t) : 0;
    const tags = [
      t.source === 'manual' ? `<span class="tag tint-plum">CASH</span>` : '',
      t.ignored ? `<span class="tag" style="background:var(--sand-200)">HIDDEN</span>` : '',
    ].join('');
    return `<div class="tx ${sel ? 'selected' : ''} ${t.ignored ? 'ignored' : ''}" data-action="open-tx" data-id="${t.id}">
      ${t.type === 'debit' && !t.ignored ? `<input type="checkbox" class="tx-check" data-action="toggle-select" data-id="${t.id}" ${sel ? 'checked' : ''} aria-label="Select" />` : '<span></span>'}
      <div class="tx-ico" style="background:${m.color}1F;color:${m.color === OTHER_COLOR ? 'var(--ink-2)' : m.color}">${icon(m.icon)}</div>
      <div class="tx-main"><div class="tx-title">${esc(t.merchant)}${tags}</div><div class="tx-desc" title="${esc(t.desc)}">${sp?.note ? `<b style="color:var(--amber-600)">${esc(sp.note)}</b> · ` : ''}${t.note ? `<b style="color:var(--ink-2)">${esc(t.note)}</b> · ` : ''}${esc(t.desc)}</div></div>
      <div class="cat-cell"><button class="cat-pill" data-action="cat-pop" data-id="${t.id}"><i style="background:${m.color}"></i>${esc(t.category)}</button></div>
      <div class="tx-split">${splitCell}</div>
      <div class="tx-amt num ${t.type}">${t.type === 'credit' ? '+' : ''}${fmt(toP(t.amount))}${sp ? `<small class="lent">${fmt(lent)} lent</small>` : ''}</div>
    </div>`;
  }

  function renderBulkbar() {
    const bar = $('#bulkbar');
    if (ui.view !== 'transactions' || !ui.selected.size) { bar.hidden = true; return; }
    const total = [...ui.selected].reduce((s, id) => s + toP(txById(id)?.amount || 0), 0);
    bar.hidden = false;
    bar.innerHTML = `<span><b>${ui.selected.size}</b> selected · <b>${fmt(total)}</b></span>
      <button class="btn btn-sm btn-amber" data-action="open-split-bulk">${icon('split', 'ico-sm')}Split together</button>
      <button class="btn btn-sm btn-on-dark" data-action="bulk-hide">${icon('eyeOff', 'ico-sm')}Hide</button>
      <button class="btn btn-sm btn-on-dark" data-action="clear-select">${icon('x', 'ico-sm')}</button>`;
  }

  // ---------- people ----------
  function renderPeople(bal) {
    const owed = totalOwed(bal);
    $('#page-sub').textContent = S.people.length ? `${fmt(owed)} outstanding across ${Object.values(bal).filter(x => x.balance > 0).length} people` : 'Add the friends you share expenses with';
    const ppl = [...S.people].sort((a, b) => bal[b.id].balance - bal[a.id].balance || a.name.localeCompare(b.name));
    const cards = ppl.map(p => {
      const b = bal[p.id];
      const pct = b.lent + b.paidOut ? Math.min(100, Math.round(b.got / (b.lent + b.paidOut) * 100)) : 0;
      const state = b.balance > 0 ? ['owes you', 'amt-pos'] : b.balance < 0 ? ['you owe', 'amt-neg'] : ['settled up', ''];
      return `<div class="card person-card" data-action="open-person" data-id="${p.id}">
        <div class="person-top">${avatar(p, 'lg')}<div style="flex:1;min-width:0"><div class="person-name">${esc(p.name)}</div><div class="person-meta">${b.count} shared expense${b.count === 1 ? '' : 's'}${b.last ? ' · ' + timeAgo(b.last) : ''}</div></div></div>
        <div>
          ${b.balance === 0 ? `<span class="settled-badge">${icon('check', 'ico-sm')}All settled</span>` : `<div class="person-bal-label ${state[1]}">${state[0]}</div><div class="person-bal num ${state[1]}">${fmt(b.balance, { abs: true })}</div>`}
        </div>
        <div><div class="progress"><i style="width:${pct}%"></i></div><div class="person-meta" style="margin-top:6px">${fmt(b.got)} of ${fmt(b.lent + b.paidOut)} paid back</div></div>
        <div class="person-actions">
          <button class="btn btn-sm btn-primary" data-action="open-payment" data-id="${p.id}" ${b.balance <= 0 ? 'disabled' : ''}>${icon('hand', 'ico-sm')}Got paid</button>
          <button class="btn btn-sm btn-ghost" data-action="copy-reminder" data-id="${p.id}" ${b.balance <= 0 ? 'disabled' : ''}>${icon('bell', 'ico-sm')}Remind</button>
        </div>
      </div>`;
    }).join('');
    const groups = S.groups.map(g => `<div class="group-row">
        <div class="avatar-stack">${g.members.map(personById).filter(Boolean).slice(0, 5).map(p => avatar(p, 'sm')).join('')}</div>
        <div style="flex:1"><b>${esc(g.name)}</b><div class="person-meta">${g.members.map(id => esc(personById(id)?.name || '')).filter(Boolean).join(', ')}</div></div>
        <button class="icon-btn" data-action="edit-group" data-id="${g.id}" title="Edit">${icon('edit')}</button>
        <button class="icon-btn" data-action="delete-group" data-id="${g.id}" title="Delete">${icon('trash')}</button></div>`).join('');
    return `
      <div class="people-grid">
        ${cards}
        <button class="add-card" data-action="add-person-modal"><div style="text-align:center">${icon('plus', 'ico-xl')}<div style="margin-top:8px">Add a person</div><div class="person-meta">or many — separate names with commas</div></div></button>
      </div>
      <div class="section-title">Groups</div>
      <div class="card">
        <div class="card-head"><div><h3 class="card-title">Quick-pick groups</h3><div class="card-sub">Flatmates, trip gang, office lunch — select them all in one tap when splitting</div></div>
        <button class="btn btn-sm btn-ghost" data-action="edit-group" ${S.people.length < 2 ? 'disabled title="Add at least 2 people first"' : ''}>${icon('plus', 'ico-sm')}New group</button></div>
        ${groups || '<div class="person-meta">No groups yet.</div>'}
      </div>`;
  }

  // ================= modals =================
  function openModal(m) { modal = m; renderModal(); setTimeout(() => { const f = $('#modal-root [autofocus]'); if (f) { f.focus(); if (f.select) f.select(); } }, 30); }
  function closeModal() { modal = null; $('#modal-root').innerHTML = ''; }

  function shell({ title, sub, body, foot, wide, drawer }) {
    return `<div class="modal-backdrop ${drawer ? 'drawer-mode' : ''}" data-action="backdrop">
      <div class="modal ${wide ? 'wide' : ''} ${drawer ? 'drawer' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><div><h2 class="modal-title">${title}</h2>${sub ? `<div class="modal-sub">${sub}</div>` : ''}</div><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div></div>`;
  }

  function renderModal() {
    if (!modal) return;
    const R = { split: modalSplit, payment: modalPayment, import: modalImport, expense: modalExpense, person: modalPerson, addPeople: modalAddPeople, group: modalGroup, settings: modalSettings, help: modalHelp, confirm: modalConfirm }[modal.type];
    const root = $('#modal-root');
    const scroll = $('.modal', root)?.scrollTop || 0;
    root.innerHTML = R();
    const m = $('.modal', root); if (m) m.scrollTop = scroll;
  }

  // ---------- split ----------
  function openSplit(ids) {
    ids = ids.filter(id => txById(id)?.type === 'debit');
    if (!ids.length) return;
    const existing = ids.length === 1 && S.splits[ids[0]];
    const m = { type: 'split', ids, mode: 'equal', picked: ['me'], values: {}, note: '', newName: '' };
    if (existing) {
      m.mode = existing.mode; m.picked = existing.parts.map(p => p.id).filter(id => id === 'me' || personById(id));
      existing.parts.forEach(p => { m.values[p.id] = p.v; });
      m.note = existing.note || '';
    }
    openModal(m);
  }
  function splitTotalP() { return modal.ids.reduce((s, id) => s + toP(txById(id).amount), 0); }

  function modalSplit() {
    const m = modal, bulk = m.ids.length > 1;
    const t = txById(m.ids[0]);
    const totalP = splitTotalP();
    const existing = !bulk && S.splits[t.id];
    const ids = m.picked;
    const res = bulk ? bulkPreview() : computeSplit(totalP, m.mode, ids, m.values);
    const othersP = Object.entries(res.shares).reduce((s, [id, p]) => s + (id === 'me' ? 0 : p), 0);
    const meta = catMeta(t.category);
    const last = S.lastPick.filter(id => personById(id));
    const sameAsLast = last.length && last.every(id => ids.includes(id)) && ids.length === last.length + 1;

    const pickChips = [{ id: 'me', name: S.me === 'You' ? 'Me' : S.me }].concat(S.people).map(p => {
      const on = ids.includes(p.id);
      return `<button class="pick ${on ? 'on' : ''}" data-action="pick" data-id="${p.id}">${avatar(p.id === 'me' ? 'me' : p)}${esc(p.id === 'me' ? p.name + ' (you)' : p.name)}</button>`;
    }).join('');
    const quick = [
      last.length && !sameAsLast ? `<button class="chip" data-action="pick-last">${icon('sparkle', 'ico-sm')}Same as last time</button>` : '',
      ...S.groups.map(g => `<button class="chip" data-action="pick-group" data-id="${g.id}">${icon('users', 'ico-sm')}${esc(g.name)}</button>`),
    ].join('');

    const modes = [['equal', 'Equally'], ['exact', 'Exact ₹'], ['percent', 'Percent'], ['shares', 'Shares']];
    const rows = ids.map(id => {
      const p = id === 'me' ? { id: 'me', name: (S.me === 'You' ? 'You' : S.me) } : personById(id);
      if (!p) return '';
      let ctl = '';
      if (m.mode === 'exact') ctl = `<div class="input-wrap"><span class="prefix">₹</span><input class="input" inputmode="decimal" data-split-val="${id}" value="${esc(m.values[id] ?? '')}" /></div>`;
      else if (m.mode === 'percent') ctl = `<div class="input-wrap"><input class="input" inputmode="decimal" data-split-val="${id}" value="${esc(m.values[id] ?? '')}" style="padding-right:28px;padding-left:10px" /><span class="prefix" style="left:auto;right:12px">%</span></div>`;
      else if (m.mode === 'shares') ctl = `<div class="step-btns"><button class="icon-btn" data-action="share-step" data-id="${id}" data-d="-1">−</button><input class="input" style="width:56px;text-align:center" inputmode="decimal" data-split-val="${id}" value="${esc(m.values[id] ?? 1)}" /><button class="icon-btn" data-action="share-step" data-id="${id}" data-d="1">+</button></div>`;
      else ctl = '<span></span>';
      return `<div class="share-row">${avatar(id === 'me' ? 'me' : p, 'sm')}<span class="nm">${esc(p.name)}</span>${ctl}<span class="share-amt" data-share-out="${id}">${fmt(res.shares[id] || 0)}</span></div>`;
    }).join('');

    const fillMe = !res.ok && m.mode === 'exact' && ids.includes('me') && ids.length > 1 ? `<button class="btn btn-xs btn-ghost" data-action="exact-fill-me" style="margin-left:10px">Put the rest on me</button>` : '';
    const status = res.ok
      ? `<div class="split-status ${othersP ? 'ok' : 'warn'}" id="split-status"><span>${othersP ? `${ids.filter(i => i !== 'me').length === 1 ? esc(personById(ids.find(i => i !== 'me'))?.name || '') + ' owes' : 'Friends owe'} you` : 'Add at least one friend'}</span><span class="big">${fmt(othersP)}</span></div>`
      : `<div class="split-status ${res.level}" id="split-status"><span>${esc(res.msg)}${fillMe}</span><span class="big">${fmt(othersP)}</span></div>`;

    const body = `
      <div class="tx-summary">
        <div class="tx-ico">${icon(bulk ? 'split' : meta.icon)}</div>
        <div style="min-width:0"><div style="font-weight:800">${bulk ? `${m.ids.length} expenses` : esc(t.merchant)}</div>
        <div class="sub">${bulk ? m.ids.map(id => esc(txById(id).merchant)).slice(0, 3).join(', ') + (m.ids.length > 3 ? '…' : '') : `${fmtDate(t.date, true)}${t.note ? ' · ' + esc(t.note) : ''}`}</div></div>
        <div class="amt">${fmt(totalP)}</div>
      </div>
      <div class="field">
        <span class="label">Who shared this?</span>
        ${quick ? `<div class="chips">${quick}</div>` : ''}
        <div class="people-pick">${pickChips}
          ${m.adding ? '' : `<button class="pick pick-add" data-action="split-add-toggle">${icon('plus', 'ico-sm')}New person</button>`}
        </div>
        ${m.adding ? `<div class="inline-add"><input class="input" id="split-new-name" placeholder="Name — or several: Rohan, Aditi" value="${esc(m.newName)}" autofocus /><button class="btn btn-primary" data-action="split-add">Add</button><button class="btn btn-quiet" data-action="split-add-toggle">Cancel</button></div>` : ''}
        ${!S.people.length && !m.adding ? '<div class="person-meta">Tip: add the friends you shared this with — they\'re saved for next time.</div>' : ''}
      </div>
      <div class="field">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="label">How to split</span>
        <div class="seg">${modes.map(([k, l]) => `<button class="${m.mode === k ? 'on' : ''}" data-action="split-mode" data-mode="${k}" ${bulk && k === 'exact' ? 'disabled title="Exact amounts need a single expense"' : ''}>${l}</button>`).join('')}</div></div>
        ${bulk ? `<div class="person-meta">Each of the ${m.ids.length} expenses is split the same way. Totals below are combined.</div>` : ''}
        <div class="share-rows">${rows}</div>
      </div>
      ${status}
      <div class="field"><label for="split-note">Note (optional)</label><input class="input" id="split-note" placeholder="e.g. Goa trip, Friday dinner" value="${esc(m.note)}" /></div>`;
    const foot = `
      ${existing ? `<button class="btn btn-danger-text" data-action="split-remove">${icon('trash', 'ico-sm')}Remove split</button>` : ''}
      ${!bulk && t.source === 'manual' ? `<button class="btn btn-danger-text" data-action="delete-manual" data-id="${t.id}">${icon('trash', 'ico-sm')}Delete expense</button>` : ''}
      ${!bulk && !existing ? `<button class="btn btn-quiet" data-action="toggle-hide" data-id="${t.id}" title="Exclude from totals (e.g. transfer to own account)">${icon('eyeOff', 'ico-sm')}Hide</button>` : ''}
      <span class="spacer"></span>
      <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
      <button class="btn btn-primary" data-action="split-save" ${res.ok && othersP > 0 ? '' : 'disabled'}>${icon('check', 'ico-sm')}${existing ? 'Update split' : 'Save split'}</button>`;
    return shell({ title: existing ? 'Edit split' : 'Split expense', sub: 'Pick people, choose how — Hisaab does the maths', body, foot });
  }

  function bulkPreview() {
    const m = modal; const agg = {}; let ok = true, msg = '', level = 'ok';
    m.ids.forEach(id => {
      const r = computeSplit(toP(txById(id).amount), m.mode, m.picked, m.values);
      if (!r.ok) { ok = false; msg = r.msg; level = r.level; }
      Object.entries(r.shares).forEach(([k, v]) => { agg[k] = (agg[k] || 0) + v; });
    });
    return { ok, msg, level, shares: agg };
  }

  /** Update share amounts + status without re-rendering inputs (keeps focus while typing). */
  function refreshSplitPreview() {
    const m = modal;
    const res = m.ids.length > 1 ? bulkPreview() : computeSplit(splitTotalP(), m.mode, m.picked, m.values);
    m.picked.forEach(id => { const el = $(`[data-share-out="${id}"]`); if (el) el.textContent = fmt(res.shares[id] || 0); });
    const othersP = Object.entries(res.shares).reduce((s, [id, p]) => s + (id === 'me' ? 0 : p), 0);
    const st = $('#split-status');
    if (st) {
      st.className = 'split-status ' + (res.ok ? (othersP ? 'ok' : 'warn') : res.level);
      const fillMe = !res.ok && m.mode === 'exact' && m.picked.includes('me') && m.picked.length > 1 ? `<button class="btn btn-xs btn-ghost" data-action="exact-fill-me" style="margin-left:10px">Put the rest on me</button>` : '';
      st.innerHTML = `<span>${res.ok ? (othersP ? 'Friends owe you' : 'Add at least one friend') : esc(res.msg) + fillMe}</span><span class="big">${fmt(othersP)}</span>`;
    }
    const btn = $('[data-action="split-save"]'); if (btn) btn.disabled = !(res.ok && othersP > 0);
  }

  function saveSplit() {
    const m = modal;
    const note = $('#split-note')?.value.trim() || '';
    const n = m.ids.length;
    const names = m.picked.filter(id => id !== 'me').map(id => personById(id)?.name.split(' ')[0]).filter(Boolean);
    commit(`${n > 1 ? n + ' expenses' : 'Expense'} split with ${names.join(', ')}`, s => {
      m.ids.forEach(id => {
        const r = computeSplit(toP(txById(id).amount), m.mode, m.picked, m.values);
        s.splits[id] = { mode: m.mode, parts: m.picked.map(pid => ({ id: pid, v: m.values[pid] ?? null })), shares: r.shares, note, at: Date.now() };
      });
      s.lastPick = m.picked.filter(id => id !== 'me');
      ui.selected.clear();
      closeModal();
    });
  }

  // ---------- payment ----------
  function openPayment(opts = {}) {
    if (!S.people.length) { toast('Add a person first — split an expense or go to People', { err: true }); return; }
    const bal = balances();
    let personId = opts.personId;
    if (!personId && opts.txId) {
      const t = txById(opts.txId);
      const d = (t.desc + ' ' + t.merchant).toLowerCase();
      personId = S.people.find(p => d.includes(p.name.toLowerCase().split(' ')[0]))?.id;
    }
    if (!personId) personId = S.people.filter(p => bal[p.id].balance > 0).sort((a, b) => bal[b.id].balance - bal[a.id].balance)[0]?.id || S.people[0].id;
    const t = opts.txId && txById(opts.txId);
    openModal({ type: 'payment', personId, dir: 'in', amount: t ? String(t.amount) : (bal[personId].balance > 0 ? (bal[personId].balance / 100).toString() : ''), date: t ? t.date : todayStr(), note: '', txId: opts.txId || null, editAmount: !t });
  }

  function modalPayment() {
    const m = modal, bal = balances();
    const p = personById(m.personId);
    const cur = bal[m.personId]?.balance || 0;
    const amtP = toP(m.amount);
    const after = m.dir === 'in' ? cur - amtP : cur + amtP;
    const t = m.txId && txById(m.txId);
    const body = `
      ${t ? `<div class="tx-summary"><div class="tx-ico">${icon('in')}</div><div style="min-width:0"><div style="font-weight:800">${esc(t.merchant)}</div><div class="sub">${fmtDate(t.date, true)} · credit in your account</div></div><div class="amt">${fmt(toP(t.amount))}</div></div>` : ''}
      <div class="field"><span class="label">Direction</span>
        <div class="seg"><button class="${m.dir === 'in' ? 'on' : ''}" data-action="pay-dir" data-dir="in">${icon('in', 'ico-sm')} They paid me</button><button class="${m.dir === 'out' ? 'on' : ''}" data-action="pay-dir" data-dir="out">${icon('out', 'ico-sm')} I paid them</button></div></div>
      <div class="field"><span class="label">${m.dir === 'in' ? 'Who paid you?' : 'Who did you pay?'}</span>
        <div class="people-pick">${S.people.map(x => `<button class="pick ${x.id === m.personId ? 'on' : ''}" data-action="pay-person" data-id="${x.id}">${avatar(x)}${esc(x.name)}${bal[x.id].balance ? `<span class="num" style="color:var(--muted);font-weight:600;font-size:12px">${fmt(bal[x.id].balance, { round: true })}</span>` : ''}</button>`).join('')}</div></div>
      <div class="field"><label for="pay-amount">Amount</label>
        <div class="input-wrap"><span class="prefix big">₹</span><input id="pay-amount" class="input big" inputmode="decimal" value="${esc(m.amount)}" ${t ? '' : 'autofocus'} /></div>
        ${cur > 0 && m.dir === 'in' ? `<div class="chips"><button class="chip" data-action="pay-fill" data-v="${cur}">Full balance · ${fmt(cur)}</button>${cur >= 200 ? `<button class="chip" data-action="pay-fill" data-v="${Math.round(cur / 2)}">Half · ${fmt(Math.round(cur / 2))}</button>` : ''}</div>` : ''}
      </div>
      <div class="row">
        <div class="field"><label for="pay-date">Date</label><input id="pay-date" class="input" type="date" value="${esc(m.date)}" /></div>
        <div class="field"><label for="pay-note">Note</label><input id="pay-note" class="input" placeholder="GPay, cash…" value="${esc(m.note)}" /></div>
      </div>
      <div class="split-status ${after === 0 ? 'ok' : after > 0 ? 'warn' : 'bad'}" id="pay-status">${payStatus(p, cur, after)}</div>`;
    const foot = `${t ? `<button class="btn btn-quiet" data-action="toggle-hide" data-id="${t.id}">${icon(t.ignored ? 'eye' : 'eyeOff', 'ico-sm')}${t.ignored ? 'Unhide' : 'Hide'} transaction</button>` : ''}<span class="spacer"></span>
      <button class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="pay-save" ${amtP > 0 ? '' : 'disabled'}>${icon('check', 'ico-sm')}Record payment</button>`;
    return shell({ title: t ? 'Is this a repayment?' : 'Record a payment', sub: t ? 'Link this credit to a friend to reduce what they owe' : 'Settle up fully or partially', body, foot });
  }
  function payStatus(p, cur, after) {
    const n = esc(p?.name.split(' ')[0] || '');
    return `<span>Now: ${cur >= 0 ? `${n} owes ${fmt(cur)}` : `you owe ${fmt(-cur)}`}</span><span class="big">→ ${after === 0 ? 'Settled ✓' : after > 0 ? `owes ${fmt(after)}` : `you owe ${fmt(-after)}`}</span>`;
  }

  function savePayment() {
    const m = modal;
    m.amount = $('#pay-amount').value; m.date = $('#pay-date').value || todayStr(); m.note = $('#pay-note').value.trim();
    const paise = toP(m.amount);
    if (paise <= 0) return;
    const p = personById(m.personId);
    commit(`${m.dir === 'in' ? `${fmt(paise)} received from ${p.name}` : `${fmt(paise)} paid to ${p.name}`}`, s => {
      if (m.txId) s.payments = s.payments.filter(x => x.txId !== m.txId);
      s.payments.push({ id: uid('pm'), personId: m.personId, dir: m.dir, paise, date: m.date, note: m.note, txId: m.txId, at: Date.now() });
      closeModal();
    });
    const after = balances()[m.personId].balance;
    if (after === 0) { confetti(); setTimeout(() => toast(`${p.name} is all settled up 🎉`), 400); }
  }

  // ---------- import ----------
  function openImport() { openModal({ type: 'import', stage: 'pick' }); }
  function handleFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      toast(/\.xlsx?$/i.test(file.name) ? 'That\'s an Excel file — in ICICI Net Banking choose "CSV" as the download format' : 'Please choose a .csv file', { err: true });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { lastImportText = reader.result; previewImport(file.name); };
    reader.onerror = () => toast('Could not read that file', { err: true });
    reader.readAsText(file);
  }
  function previewImport(name, mapping) {
    const res = P.parseStatement(lastImportText, mapping);
    openModal({ type: 'import', stage: 'preview', name, res, open: !res.ok });
  }
  function modalImport() {
    const m = modal;
    if (m.stage === 'pick') {
      const body = `
        <label class="dropzone" id="dropzone" for="file-input">${icon('upload', 'ico-xl')}<h4>Drop your ICICI statement here</h4><p>or click to browse · .csv files</p></label>
        <div class="howto"><b>Getting the CSV from ICICI</b><ol>
          <li>Log in to ICICI Net Banking → <b>My Accounts → Bank Accounts → Account Statement</b>.</li>
          <li>Pick the date range, then <b>Download → CSV</b> (not XLS/PDF).</li>
          <li>Drop it here. Re-importing an overlapping period is fine — duplicates are skipped.</li></ol></div>
        <div class="person-meta" style="display:flex;gap:8px;align-items:center">${icon('lock', 'ico-sm')}The file is read inside your browser — nothing is uploaded anywhere.</div>`;
      return shell({ title: 'Import statement', sub: 'ICICI savings & current account CSVs supported', body, foot: S.transactions.length ? '' : `<span class="spacer"></span><button class="btn btn-quiet" data-action="load-sample">${icon('sparkle', 'ico-sm')}Use sample data instead</button>` });
    }
    const r = m.res;
    const have = new Set(S.transactions.map(t => t.id));
    const fresh = r.transactions.filter(t => !have.has(t.id));
    const dups = r.transactions.length - fresh.length;
    const ds = r.transactions.map(t => t.date).sort();
    const out = fresh.filter(t => t.type === 'debit').reduce((s, t) => s + toP(t.amount), 0);
    const cols = r.header.map((h, i) => `<option value="${i}">${esc(h || `Column ${i + 1}`)}</option>`).join('');
    const sel = (key, label, optional) => `<div class="field"><label>${label}</label><select class="select" data-map="${key}">${optional ? '<option value="-1">— none —</option>' : '<option value="-1">— pick —</option>'}${cols}</select></div>`;
    const body = `
      ${r.error ? `<div class="split-status bad">${icon('info')}<span style="flex:1;margin-left:8px">${esc(r.error)}</span></div>` : `<div class="split-status ok">${icon('check')}<span style="flex:1;margin-left:8px">Looks like an ICICI statement · ${fmtDate(ds[0], true)} – ${fmtDate(ds[ds.length - 1], true)}</span></div>`}
      ${S.sample ? `<div class="split-status warn">${icon('info')}<span style="flex:1;margin-left:8px">The sample data will be cleared and replaced by your statement.</span></div>` : ''}
      <div class="stat-tiles">
        <div class="stat-tile"><div class="v num">${fresh.length}</div><div class="l">new transactions</div></div>
        <div class="stat-tile"><div class="v num">${dups}</div><div class="l">already imported</div></div>
        <div class="stat-tile"><div class="v num">${fmtCompact(out)}</div><div class="l">spent in new</div></div>
      </div>
      ${fresh.length ? `<div style="overflow:auto"><table class="preview-table"><thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th class="r">Amount</th></tr></thead><tbody>
        ${fresh.slice(0, 6).map(t => `<tr><td>${fmtDate(t.date)}</td><td title="${esc(t.desc)}">${esc(t.merchant)}</td><td>${esc(t.category)}</td><td class="r ${t.type === 'credit' ? 'amt-pos' : ''}">${t.type === 'credit' ? '+' : ''}${fmt(toP(t.amount))}</td></tr>`).join('')}
        </tbody></table>${fresh.length > 6 ? `<div class="person-meta" style="margin-top:6px">…and ${fresh.length - 6} more</div>` : ''}</div>` : ''}
      <details class="disclose" ${m.open ? 'open' : ''}><summary>${icon('settings', 'ico-sm')} Columns look wrong? Adjust mapping</summary>
        <div class="mapping">${sel('date', 'Date')}${sel('desc', 'Description')}${sel('withdrawal', 'Withdrawal / Debit', true)}${sel('deposit', 'Deposit / Credit', true)}${sel('amount', 'Single amount col', true)}${sel('balance', 'Balance', true)}</div>
      </details>`;
    const foot = `<span class="person-meta" style="margin-right:auto">${esc(m.name)}</span><button class="btn btn-ghost" data-action="open-import">Choose another</button>
      <button class="btn btn-primary" data-action="do-import" ${fresh.length ? '' : 'disabled'}>${icon('download', 'ico-sm')}Import ${fresh.length || ''}</button>`;
    setTimeout(() => $$('[data-map]').forEach(s => { s.value = String(r.mapping[s.dataset.map] ?? -1); }), 0);
    return shell({ title: 'Review import', sub: 'Check everything looks right before adding it', body, foot, wide: true });
  }
  function doImport() {
    const m = modal;
    const have = new Set(S.transactions.map(t => t.id));
    const fresh = m.res.transactions.filter(t => !have.has(t.id));
    const wasEmpty = !S.transactions.length || S.sample;
    commit(`Imported ${fresh.length} transactions`, s => {
      if (s.sample) Object.assign(s, blank(), { me: s.me });
      let seq = s.transactions.length;
      fresh.forEach(t => { t.seq = seq++; s.transactions.push(t); });
      s.imports.push({ id: uid('im'), name: m.name, at: Date.now(), count: fresh.length, ids: fresh.map(t => t.id) });
      closeModal();
    });
    setView('transactions', { type: 'debit', status: 'unsplit', cat: 'all', month: 'all', q: '' });
    if (wasEmpty) setTimeout(() => toast('Showing expenses not yet split — tap any one to split it'), 600);
  }

  // ---------- manual expense ----------
  function modalExpense() {
    const m = modal;
    const body = `
      <div class="field"><label for="ex-amount">Amount</label><div class="input-wrap"><span class="prefix big">₹</span><input id="ex-amount" class="input big" inputmode="decimal" placeholder="0" value="${esc(m.amount || '')}" autofocus /></div></div>
      <div class="field"><label for="ex-desc">What was it for?</label><input id="ex-desc" class="input" placeholder="e.g. Chai & samosa, cab to airport" value="${esc(m.desc || '')}" /></div>
      <div class="row">
        <div class="field"><label for="ex-date">Date</label><input id="ex-date" class="input" type="date" value="${esc(m.date || todayStr())}" /></div>
        <div class="field"><label for="ex-cat">Category</label><select id="ex-cat" class="select" style="height:44px">${P.CATEGORIES.filter(c => c !== 'Income').map(c => `<option ${c === (m.cat || 'Food & Dining') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="person-meta">For cash or other-card expenses that aren't in your ICICI statement.</div>`;
    const foot = `<span class="spacer"></span><button class="btn btn-ghost" data-action="ex-save" data-split="0">Save only</button><button class="btn btn-primary" data-action="ex-save" data-split="1">${icon('split', 'ico-sm')}Save & split</button>`;
    return shell({ title: 'Add an expense', sub: 'Cash, another card, or something a friend still owes you for', body, foot });
  }
  function saveExpense(thenSplit) {
    const amount = Math.round(num($('#ex-amount').value) * 100) / 100;
    const desc = $('#ex-desc').value.trim();
    if (amount <= 0) { $('#ex-amount').focus(); toast('Enter an amount', { err: true }); return; }
    if (!desc) { $('#ex-desc').focus(); toast('Add a short description', { err: true }); return; }
    const t = { id: uid('m'), date: $('#ex-date').value || todayStr(), desc, merchant: desc.slice(0, 40), note: '', type: 'debit', amount, balance: null, ref: '', category: $('#ex-cat').value, source: 'manual', seq: S.transactions.length };
    commit('Expense added', s => { s.transactions.push(t); closeModal(); }, { undo: !thenSplit });
    if (thenSplit) openSplit([t.id]);
  }

  // ---------- person drawer ----------
  function modalPerson() {
    const p = personById(modal.id);
    if (!p) { closeModal(); return ''; }
    const b = balances()[p.id];
    const items = [];
    for (const [txId, sp] of Object.entries(S.splits)) {
      const t = txById(txId);
      if (!t || t.ignored || !sp.shares[p.id]) continue;
      items.push({ date: t.date, at: sp.at, html: `<div class="tl-item" data-action="open-tx" data-id="${t.id}" style="cursor:pointer"><span class="feed-ico tint-amber">${icon(catMeta(t.category).icon)}</span>
        <div style="min-width:0"><div class="feed-title">${esc(t.merchant)}${sp.note ? ` · <span style="color:var(--muted)">${esc(sp.note)}</span>` : ''}</div><div class="feed-sub">${fmtDate(t.date, true)} · their share of ${fmt(toP(t.amount))}</div></div>
        <b class="num amt-pos">+${fmt(sp.shares[p.id])}</b></div>` });
    }
    S.payments.filter(x => x.personId === p.id).forEach(pm => items.push({ date: pm.date, at: pm.at, html: `<div class="tl-item"><span class="feed-ico ${pm.dir === 'out' ? 'tint-coral' : 'tint-teal'}">${icon(pm.dir === 'out' ? 'out' : 'in')}</span>
      <div><div class="feed-title">${pm.dir === 'out' ? 'You paid them' : 'Paid you back'}</div><div class="feed-sub">${fmtDate(pm.date, true)}${pm.note ? ' · ' + esc(pm.note) : ''}</div></div>
      <div style="display:flex;align-items:center;gap:4px"><b class="num ${pm.dir === 'out' ? '' : 'amt-neg'}">${pm.dir === 'out' ? '+' : '−'}${fmt(pm.paise)}</b><button class="icon-btn" data-action="delete-payment" data-id="${pm.id}" title="Delete payment">${icon('trash', 'ico-sm')}</button></div></div>` }));
    items.sort((a, c) => c.date.localeCompare(a.date) || c.at - a.at);
    const state = b.balance > 0 ? ['owes you', 'amt-pos'] : b.balance < 0 ? ['you owe', 'amt-neg'] : ['all settled', ''];
    const body = `
      <div class="drawer-hero">
        ${avatar(p, 'xl')}
        ${modal.rename ? `<div class="inline-add" style="margin-top:12px"><input class="input" id="rename-input" value="${esc(p.name)}" autofocus /><button class="btn btn-primary" data-action="rename-save">Save</button></div>` : `<h3 style="margin:10px 0 0;font-size:22px">${esc(p.name)} <button class="icon-btn" data-action="rename" title="Rename">${icon('edit', 'ico-sm')}</button></h3>`}
        <div class="person-bal num ${state[1]}">${b.balance ? fmt(b.balance, { abs: true }) : '₹0'}</div>
        <div class="person-bal-label ${state[1]}">${state[0]}</div>
      </div>
      <div class="mini-stats">
        <div class="stat-tile"><div class="v num" style="font-size:17px">${fmt(b.lent, { round: true })}</div><div class="l">lent in total</div></div>
        <div class="stat-tile"><div class="v num" style="font-size:17px">${fmt(b.got, { round: true })}</div><div class="l">paid back</div></div>
        <div class="stat-tile"><div class="v num" style="font-size:17px">${b.count}</div><div class="l">shared expenses</div></div>
      </div>
      <div class="row">
        <button class="btn btn-primary" data-action="open-payment" data-id="${p.id}">${icon('hand', 'ico-sm')}Record payment</button>
        <button class="btn btn-ghost" data-action="copy-reminder" data-id="${p.id}" ${b.balance > 0 ? '' : 'disabled'}>${icon('copy', 'ico-sm')}Copy reminder</button>
      </div>
      <div><div class="section-title" style="margin-top:6px">History</div>
      <div class="timeline">${items.map(i => i.html).join('') || '<div class="person-meta">No shared expenses yet.</div>'}</div></div>`;
    const foot = `<button class="btn btn-danger-text" data-action="delete-person" data-id="${p.id}">${icon('trash', 'ico-sm')}Remove person</button><span class="spacer"></span><button class="btn btn-ghost" data-action="close-modal">Close</button>`;
    return shell({ title: 'Ledger', body, foot, drawer: true });
  }

  function reminderText(p) {
    const b = balances()[p.id];
    const lines = [];
    for (const [txId, sp] of Object.entries(S.splits)) {
      const t = txById(txId);
      if (t && !t.ignored && sp.shares[p.id]) lines.push([t.date, `• ${fmtDate(t.date)} — ${t.merchant}${sp.note ? ` (${sp.note})` : ''}: ${fmt(sp.shares[p.id])}`]);
    }
    lines.sort((a, c) => a[0].localeCompare(c[0]));
    return `Hi ${p.name.split(' ')[0]}! 👋 Quick hisaab update:\n\n${lines.map(l => l[1]).join('\n')}\n\nTotal: ${fmt(b.lent)}${b.got ? `\nAlready paid: ${fmt(b.got)}` : ''}${b.paidOut ? `\nI paid you: ${fmt(b.paidOut)}` : ''}\nBalance due: ${fmt(b.balance)}\n\nThanks! 🙏`;
  }
  async function copyReminder(id) {
    const p = personById(id);
    const text = reminderText(p);
    try { await navigator.clipboard.writeText(text); toast(`Reminder for ${p.name} copied — paste it in WhatsApp`); }
    catch (e) {
      openModal({ type: 'confirm', title: 'Reminder text', body: `<textarea class="input" style="height:260px;padding:12px" readonly>${esc(text)}</textarea>`, ok: 'Done', onOk: () => {} });
    }
  }

  // ---------- add people / groups ----------
  function modalAddPeople() {
    const body = `<div class="field"><label for="people-names">Names</label><input id="people-names" class="input" placeholder="Rohan, Aditi Sharma, Kabir" autofocus /></div>
      <div class="person-meta">Separate multiple names with commas.</div>`;
    return shell({ title: 'Add people', sub: 'Friends, flatmates, colleagues', body, foot: `<span class="spacer"></span><button class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="people-save">${icon('plus', 'ico-sm')}Add</button>` });
  }
  function savePeople() {
    const names = $('#people-names').value.split(',').map(s => s.trim()).filter(Boolean);
    if (!names.length) return;
    commit(`Added ${names.join(', ')}`, s => { names.forEach(addPerson); closeModal(); });
  }
  function modalGroup() {
    const m = modal;
    const body = `<div class="field"><label for="group-name">Group name</label><input id="group-name" class="input" placeholder="Flatmates" value="${esc(m.name || '')}" autofocus /></div>
      <div class="field"><span class="label">Members</span><div class="people-pick">${S.people.map(p => `<button class="pick ${m.members.includes(p.id) ? 'on' : ''}" data-action="group-pick" data-id="${p.id}">${avatar(p)}${esc(p.name)}</button>`).join('')}</div></div>`;
    return shell({ title: m.id ? 'Edit group' : 'New group', body, foot: `<span class="spacer"></span><button class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="group-save" ${m.members.length ? '' : 'disabled'}>Save group</button>` });
  }

  // ---------- settings ----------
  function modalSettings() {
    const u = C.user;
    const account = !C.configured ? '' : u
      ? `<div class="field"><span class="label">Account</span><div class="group-row"><span class="avatar" style="background:var(--amber);color:var(--ocean-900)">${esc(initials(u.user_metadata?.full_name || u.email))}</span><div style="flex:1;min-width:0"><b>${esc(u.user_metadata?.full_name || u.email)}</b><div class="person-meta">${esc(u.email)} · synced across your devices</div></div><button class="btn btn-sm btn-ghost" data-action="sign-out">${icon('out', 'ico-sm')}Sign out</button></div></div>`
      : `<div class="field"><span class="label">Account</span><div class="group-row"><span class="feed-ico tint-amber">${icon('lock')}</span><div style="flex:1"><b>Not signed in</b><div class="person-meta">Data is saved in this browser only</div></div><button class="btn btn-sm btn-google" data-action="google-login">${GOOGLE_G}Sign in with Google</button></div></div>`;
    const body = `${account}
      <div class="field"><label for="me-name">Your name</label><div class="inline-add"><input id="me-name" class="input" value="${esc(S.me)}" /><button class="btn btn-ghost" data-action="me-save">Save</button></div><div class="person-meta">Used in reminder messages and split lists.</div></div>
      <div class="field"><span class="label">Backup</span>
        <div class="row"><button class="btn btn-ghost" data-action="backup">${icon('download', 'ico-sm')}Download backup</button><button class="btn btn-ghost" data-action="restore">${icon('upload', 'ico-sm')}Restore backup</button></div>
        <button class="btn btn-ghost" data-action="export-csv">${icon('file', 'ico-sm')}Export transactions with splits (CSV)</button>
        <div class="person-meta">${u ? 'Your data is synced to your account. A backup file is an extra copy you control.' : 'Data is stored only in this browser. Download a backup before clearing browser data or switching computers.'}</div></div>
      ${S.imports.length ? `<div class="field"><span class="label">Imports</span>${S.imports.map(im => `<div class="group-row"><span class="feed-ico tint-plum">${icon('file')}</span><div style="flex:1;min-width:0"><b style="word-break:break-all">${esc(im.name)}</b><div class="person-meta">${im.count} transactions · ${new Date(im.at).toLocaleDateString('en-IN')}</div></div><button class="icon-btn" data-action="remove-import" data-id="${im.id}" title="Remove these transactions">${icon('trash')}</button></div>`).join('')}</div>` : ''}
      <div class="person-meta"><a class="link" href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a></div>
      <div class="field"><span class="label">Danger zone</span><button class="btn btn-danger-text" style="justify-content:flex-start" data-action="reset-all">${icon('trash', 'ico-sm')}Erase all data</button></div>`;
    return shell({ title: 'Backup & settings', body });
  }
  function modalHelp() {
    const sc = [['/', 'Search transactions'], ['N', 'Add an expense'], ['I', 'Import a statement'], ['P', 'Record a payment'], ['1 · 2 · 3', 'Dashboard · Transactions · People'], ['S', 'Split selected transactions'], ['Ctrl + Enter', 'Save the open dialog'], ['Esc', 'Close dialog / clear selection'], ['?', 'This help']];
    return shell({ title: 'Keyboard shortcuts', body: `<div class="shortcut-list">${sc.map(([k, d]) => `<kbd>${k}</kbd><span>${d}</span>`).join('')}</div>` });
  }

  // ---------- confirm ----------
  let confirmCb = null;
  function confirmDialog({ title, body, ok = 'Confirm', danger }, cb) {
    confirmCb = cb;
    openModal({ type: 'confirm', title, body, ok, danger });
  }
  function modalConfirm() {
    const m = modal;
    return shell({ title: m.title, body: `<div style="color:var(--ink-2)">${m.body}</div>`, foot: `<span class="spacer"></span><button class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn ${m.danger ? 'btn-coral' : 'btn-primary'}" data-action="confirm-ok" autofocus>${esc(m.ok)}</button>` });
  }

  // ================= toasts, tooltip, popover, confetti =================
  function toast(msg, opts = {}) {
    const el = document.createElement('div');
    el.className = 'toast' + (opts.err ? ' err' : '');
    el.innerHTML = `${icon(opts.err ? 'info' : 'check')}<span>${esc(msg)}</span>${opts.undo ? '<button>Undo</button>' : ''}${opts.action ? `<button>${esc(opts.action.label)}</button>` : ''}`;
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
    const btn = el.querySelector('button');
    if (btn) btn.onclick = () => { kill(); (opts.undo || opts.action.fn)(); };
    $('#toasts').appendChild(el);
    setTimeout(kill, opts.undo || opts.action ? 6500 : 3500);
  }

  const tip = $('#tooltip');
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; $$('.donut.hovering').forEach(d => d.classList.remove('hovering')); return; }
    tip.innerHTML = t.dataset.tip; tip.hidden = false;
    const d = t.closest('.donut'); if (d) d.classList.add('hovering');
  });
  document.addEventListener('mousemove', e => {
    if (tip.hidden) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  function closePopover() { $('.popover')?.remove(); }
  function catPopover(btn, txId) {
    closePopover();
    const t = txById(txId);
    const pop = document.createElement('div');
    pop.className = 'popover';
    pop.innerHTML = P.CATEGORIES.map(c => `<button class="${c === t.category ? 'on' : ''}" data-action="set-cat" data-id="${txId}" data-cat="${esc(c)}">${icon(catMeta(c).icon)}${esc(c)}${c === t.category ? `<span style="margin-left:auto">${icon('check', 'ico-sm')}</span>` : ''}</button>`).join('');
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const top = Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 10);
    pop.style.top = top + 'px';
    pop.style.left = Math.max(10, Math.min(r.left, innerWidth - 230)) + 'px';
  }
  function setCategory(txId, cat) {
    const t = txById(txId);
    const same = S.transactions.filter(x => x.id !== txId && x.merchant === t.merchant && x.category !== cat);
    commit(null, s => { txById(txId).category = cat; });
    closePopover();
    if (same.length) toast(`Category set to ${cat}`, { action: { label: `Apply to ${same.length} more ${t.merchant}`, fn: () => commit(`Updated ${same.length} transactions`, () => same.forEach(x => { x.category = cat; })) } });
    else toast(`Category set to ${cat}`);
  }

  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['#00948A', '#E9A23B', '#E8573F', '#7B4B94', '#F6C46A', '#3DBBAE'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = cols[i % cols.length];
      c.style.animationDelay = Math.random() * .5 + 's';
      c.style.animationDuration = 1.2 + Math.random() * 1.2 + 's';
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3000);
  }

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCSV() {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Date', 'Merchant', 'Description', 'Category', 'Type', 'Amount', 'Split with', 'Lent', 'Your share', 'Hidden'];
    const rows = [...S.transactions].sort((a, b) => a.date.localeCompare(b.date)).map(t => {
      const sp = S.splits[t.id];
      const names = sp ? Object.entries(sp.shares).filter(([id]) => id !== 'me').map(([id, p]) => `${personById(id)?.name || '?'} ${(p / 100).toFixed(2)}`).join('; ') : '';
      const lent = lentOnTx(t);
      return [t.date, t.merchant, t.desc, t.category, t.type, t.amount.toFixed(2), names, (lent / 100).toFixed(2), t.type === 'debit' ? ((toP(t.amount) - lent) / 100).toFixed(2) : '', t.ignored ? 'yes' : ''].map(q).join(',');
    });
    download(`hisaab-transactions-${todayStr()}.csv`, [head.map(q).join(','), ...rows].join('\r\n'), 'text/csv');
  }

  // ================= sample data =================
  function sampleCSV() {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ref = () => String(Math.floor(4e11 + rnd() * 5e11));
    const items = [
      ['UPI/{r}/Dinner/swiggy@icici/ICICI Bank/ICIdb1', 380, 1400], ['UPI/{r}/Order/zomato@hdfcbank/HDFC BANK/HDF4f2', 300, 1800],
      ['UPI/{r}/Groceries/blinkit.payu@hdfcbank/HDFC BANK/HDF77a', 400, 2200], ['UPI/{r}/Ride/uber.rides@axisbank/Axis Bank/AXI3ab', 150, 650],
      ['UPI/{r}/Movie/bookmyshow@icici/ICICI Bank/ICI9c1', 500, 1600], ['UPI/{r}/Fuel/hpclpetrol@okaxis/Axis Bank/AXIcc2', 800, 2000],
      ['UPI/{r}/Snacks/zepto@ybl/Yes Bank/YES121', 200, 900], ['BIL/ONL/{r}/AIRTEL/BROADBAND', 1178, 1178],
      ['UPI/{r}/Weekend trip/makemytrip@icici/ICICI Bank/ICI71e', 4200, 9800], ['UPI/{r}/Cafe/starbucksindia@hdfcbank/HDFC BANK/HDFa10', 350, 900],
      ['UPI/{r}/Pizza night/dominos@icici/ICICI Bank/ICIa22', 600, 1500], ['ATM/CASH WDL/{r}/MUMBAI ANDHERI', 2000, 5000],
      ['UPI/{r}/Shopping/amazonupi@apl/Axis Bank/AXI020', 500, 3500],
    ];
    const end = new Date(); end.setHours(12, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - 100);
    let bal = 84250.75; const lines = [',DETAILED STATEMENT,,,,,,,', ',S No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,Withdrawal Amount (INR ),Deposit Amount (INR ),Balance (INR )'];
    let n = 0;
    const push = (ds, desc, w, d) => { bal += d - w; lines.push([',' + (++n), ds, ds, '', `"${desc}"`, w.toFixed(2), d.toFixed(2), bal.toFixed(2)].join(',')); };
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const ds = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
      if (dt.getDate() === 1) push(ds, `NEFT-CITIN${ref()}-ACME TECHNOLOGIES PVT LTD-SALARY`, 0, 95000);
      if (dt.getDate() === 5) push(ds, `UPI/${ref()}/Rent/landlord.rent@okhdfcbank/HDFC BANK/HDF001`, 22000, 0);
      if (dt.getDate() === 20) push(ds, `UPI/${ref()}/Payment from Rohan/rohan.k@oksbi/State Bank Of I/SBI441`, 0, 1500);
      const k = rnd() < 0.55 ? 1 : rnd() < 0.5 ? 2 : 0;
      for (let i = 0; i < k; i++) { const [tpl, lo, hi] = items[Math.floor(rnd() * items.length)]; push(ds, tpl.replace('{r}', ref()), Math.round((lo + rnd() * (hi - lo)) * 100) / 100, 0); }
    }
    return lines.join('\n');
  }
  function loadSample() {
    const res = P.parseStatement(sampleCSV());
    commit(null, s => {
      Object.assign(s, blank(), { me: s.me, sample: true });
      res.transactions.forEach((t, i) => { t.seq = i; s.transactions.push(t); });
      const [rohan, aditi, kabir, meera] = ['Rohan Kulkarni', 'Aditi Sharma', 'Kabir Mehta', 'Meera Joshi'].map(addPerson);
      s.groups.push({ id: uid('g'), name: 'Flatmates', members: [rohan.id, aditi.id] }, { id: uid('g'), name: 'Trip gang', members: [rohan.id, aditi.id, kabir.id] });
      const now = Date.now(); let k = 0;
      const split = (t, ppl) => {
        const ids = ['me', ...ppl.map(p => p.id)];
        s.splits[t.id] = { mode: 'equal', parts: ids.map(id => ({ id, v: null })), shares: computeSplit(toP(t.amount), 'equal', ids, {}).shares, note: '', at: now - (k++) * 3.6e6 };
      };
      res.transactions.forEach(t => {
        if (t.type !== 'debit') return;
        if (t.merchant === 'Makemytrip') split(t, [rohan, aditi, kabir]);
        else if (t.merchant === 'Dominos' || (t.merchant === 'Swiggy' && k % 2 === 0)) split(t, [rohan, aditi]);
        else if (t.merchant === 'Bookmyshow') split(t, [meera]);
        else if (t.merchant === 'Blinkit') split(t, [aditi]);
      });
      res.transactions.filter(t => t.type === 'credit' && /rohan/i.test(t.desc)).forEach(t => s.payments.push({ id: uid('pm'), personId: rohan.id, dir: 'in', paise: toP(t.amount), date: t.date, note: 'UPI', txId: t.id, at: now - 7200e3 }));
      const mb = computeMeeraBalance(s, meera.id);
      if (mb > 0) s.payments.push({ id: uid('pm'), personId: meera.id, dir: 'in', paise: mb, date: todayStr(), note: 'Cash', txId: null, at: now - 600e3 });
      s.lastPick = [rohan.id, aditi.id];
    });
    closeModal();
    setView('dashboard', { period: 'all' });
    countUp();
    toast('Sample data loaded — explore away!');
  }
  function computeMeeraBalance(s, id) { return Object.values(s.splits).reduce((a, sp) => a + (sp.shares[id] || 0), 0); }

  // ================= events =================
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!e.target.closest('.popover') && !e.target.closest('[data-action="cat-pop"]')) closePopover();
    if (!el) return;
    const a = el.dataset.action, id = el.dataset.id;
    switch (a) {
      case 'nav': closeModal(); setView(el.dataset.view); break;
      case 'period': ui.period = el.dataset.period; saveUI(); render(); break;
      case 'go-tx-type': setView('transactions', { type: el.dataset.arg, status: 'all', cat: 'all', month: ui.period, q: '' }); break;
      case 'go-tx-status': setView('transactions', { type: 'debit', status: el.dataset.arg, cat: 'all', month: ui.period, q: '' }); break;
      case 'go-cat': setView('transactions', { type: 'debit', status: 'all', cat: el.dataset.arg, month: ui.period, q: '' }); break;
      case 'filter': ui[el.dataset.key] = el.dataset.val; ui.limit = 150; render(); break;
      case 'clear-filters': Object.assign(ui, { type: 'all', status: 'all', cat: 'all', month: 'all', q: '' }); $('#global-search').value = ''; render(); break;
      case 'more': ui.limit += 150; render(); break;
      case 'toggle-select': e.stopPropagation(); ui.selected.has(id) ? ui.selected.delete(id) : ui.selected.add(id); render(); break;
      case 'clear-select': ui.selected.clear(); render(); break;
      case 'bulk-hide': { const ids = [...ui.selected]; commit(`${ids.length} hidden from totals`, s => { ids.forEach(i => { txById(i).ignored = true; delete s.splits[i]; }); ui.selected.clear(); }); break; }
      case 'open-tx': { const t = txById(id); if (!t) break; if (t.type === 'debit') openSplit([id]); else openPayment({ txId: id }); break; }
      case 'open-split': openSplit([id]); break;
      case 'open-split-bulk': openSplit([...ui.selected]); break;
      case 'cat-pop': e.stopPropagation(); catPopover(el, id); break;
      case 'set-cat': setCategory(id, el.dataset.cat); break;
      case 'open-import': openImport(); break;
      case 'load-sample': loadSample(); break;
      case 'clear-sample': confirmDialog({ title: 'Clear sample data?', body: 'This removes the sample transactions, people and splits so you can start fresh.', ok: 'Clear it', danger: true }, () => { commit(null, s => Object.assign(s, blank(), { me: s.me })); setView('dashboard'); toast('Sample cleared — import your statement to begin'); }); break;
      case 'do-import': doImport(); break;
      case 'open-add-expense': openModal({ type: 'expense' }); break;
      case 'ex-save': saveExpense(el.dataset.split === '1'); break;
      case 'open-payment': openPayment({ personId: id }); break;
      case 'open-payment-tx': openPayment({ txId: id }); break;
      case 'open-person': openModal({ type: 'person', id }); break;
      case 'add-person-modal': openModal({ type: 'addPeople' }); break;
      case 'people-save': savePeople(); break;
      case 'copy-reminder': copyReminder(id); break;
      case 'open-settings': openModal({ type: 'settings' }); break;
      case 'open-help': openModal({ type: 'help' }); break;
      case 'close-modal': closeModal(); break;
      case 'backdrop': if (e.target === el) closeModal(); break;
      case 'confirm-ok': { const cb = confirmCb; confirmCb = null; closeModal(); if (cb) cb(); break; }

      // split modal
      case 'pick': {
        const m = modal; const i = m.picked.indexOf(id);
        if (i >= 0) m.picked.splice(i, 1); else m.picked.push(id);
        resetValuesIfNeeded(); renderModal(); break;
      }
      case 'pick-last': modal.picked = ['me', ...S.lastPick.filter(i => personById(i))]; resetValuesIfNeeded(); renderModal(); break;
      case 'pick-group': { const g = S.groups.find(x => x.id === id); const all = g.members.every(i => modal.picked.includes(i)); modal.picked = all ? modal.picked.filter(i => !g.members.includes(i)) : [...new Set([...modal.picked, ...g.members])]; resetValuesIfNeeded(); renderModal(); break; }
      case 'split-mode': modal.mode = el.dataset.mode; modal.values = defaultValues(modal.mode, modal.picked, splitTotalP()); renderModal(); break;
      case 'share-step': { const v = Math.max(0, num(modal.values[id] ?? 1) + Number(el.dataset.d)); modal.values[id] = v; const inp = $(`[data-split-val="${id}"]`); if (inp) inp.value = v; refreshSplitPreview(); break; }
      case 'split-add-toggle': modal.adding = !modal.adding; modal.newName = ''; modal.note = $('#split-note')?.value || modal.note; renderModal(); setTimeout(() => $('#split-new-name')?.focus(), 20); break;
      case 'split-add': splitAddPeople(); break;
      case 'split-save': saveSplit(); break;
      case 'exact-fill-me': {
        const others = modal.picked.filter(i => i !== 'me').reduce((a, i) => a + Math.max(0, toP(modal.values[i])), 0);
        modal.values.me = (Math.max(0, splitTotalP() - others) / 100).toFixed(2).replace(/\.00$/, '');
        const inp = $('[data-split-val="me"]'); if (inp) inp.value = modal.values.me;
        refreshSplitPreview(); break;
      }
      case 'split-remove': { const tid = modal.ids[0]; commit('Split removed', s => { delete s.splits[tid]; closeModal(); }); break; }
      case 'delete-manual': commit('Expense deleted', s => { s.transactions = s.transactions.filter(t => t.id !== id); delete s.splits[id]; closeModal(); }); break;
      case 'toggle-hide': { const t = txById(id); commit(t.ignored ? 'Transaction visible again' : 'Hidden from totals', s => { const x = s.transactions.find(y => y.id === id); x.ignored = !x.ignored; if (x.ignored) { delete s.splits[id]; s.payments = s.payments.filter(p => p.txId !== id); } closeModal(); }); break; }

      // payment modal
      case 'pay-dir': modal.dir = el.dataset.dir; syncPayInputs(); renderModal(); break;
      case 'pay-person': { syncPayInputs(); modal.personId = id; const b = balances()[id].balance; if (!modal.txId && modal.dir === 'in') modal.amount = b > 0 ? String(b / 100) : ''; renderModal(); break; }
      case 'pay-fill': syncPayInputs(); modal.amount = String(Number(el.dataset.v) / 100); renderModal(); break;
      case 'pay-save': savePayment(); break;
      case 'delete-payment': commit('Payment deleted', s => { s.payments = s.payments.filter(p => p.id !== id); }); break;

      // people
      case 'rename': modal.rename = true; renderModal(); setTimeout(() => $('#rename-input')?.select(), 20); break;
      case 'rename-save': { const v = $('#rename-input').value.trim(); if (v) commit('Renamed', () => { personById(modal.id).name = v; modal.rename = false; }); break; }
      case 'delete-person': {
        const p = personById(id);
        confirmDialog({ title: `Remove ${esc(p.name)}?`, body: `Their shares will be removed from every split and their payments deleted. You can undo right after.`, ok: 'Remove', danger: true }, () => commit(`${p.name} removed`, s => {
          s.people = s.people.filter(x => x.id !== id);
          s.payments = s.payments.filter(x => x.personId !== id);
          s.groups.forEach(g => { g.members = g.members.filter(m => m !== id); });
          s.groups = s.groups.filter(g => g.members.length);
          s.lastPick = s.lastPick.filter(x => x !== id);
          for (const [tid, sp] of Object.entries(s.splits)) {
            if (!sp.shares[id]) continue;
            delete sp.shares[id]; sp.parts = sp.parts.filter(x => x.id !== id);
            if (!Object.keys(sp.shares).some(k => k !== 'me')) delete s.splits[tid];
          }
        }));
        break;
      }
      case 'edit-group': { const g = S.groups.find(x => x.id === id); openModal({ type: 'group', id: g?.id, name: g?.name || '', members: g ? [...g.members] : [] }); break; }
      case 'group-pick': { modal.name = $('#group-name').value; const i = modal.members.indexOf(id); i >= 0 ? modal.members.splice(i, 1) : modal.members.push(id); renderModal(); break; }
      case 'group-save': {
        const name = $('#group-name').value.trim() || 'Group'; const m = modal;
        commit(m.id ? 'Group updated' : `Group "${name}" created`, s => { if (m.id) Object.assign(s.groups.find(g => g.id === m.id), { name, members: m.members }); else s.groups.push({ id: uid('g'), name, members: m.members }); closeModal(); });
        break;
      }
      case 'delete-group': commit('Group deleted', s => { s.groups = s.groups.filter(g => g.id !== id); }); break;

      // settings
      case 'google-login': googleLogin(el); break;
      case 'use-local': useLocal(); break;
      case 'sign-out': closeModal(); signOutFlow(); break;
      case 'me-save': { const v = $('#me-name').value.trim() || 'You'; commit('Name saved', s => { s.me = v; }, { undo: false }); break; }
      case 'backup': download(`hisaab-backup-${todayStr()}.json`, JSON.stringify(S, null, 2), 'application/json'); toast('Backup downloaded'); break;
      case 'restore': $('#backup-input').click(); break;
      case 'export-csv': exportCSV(); break;
      case 'remove-import': {
        const im = S.imports.find(x => x.id === id);
        confirmDialog({ title: 'Remove this import?', body: `Deletes ${im.count} transactions from <b>${esc(im.name)}</b> and any splits on them.`, ok: 'Remove', danger: true }, () => commit('Import removed', s => {
          const ids = new Set(im.ids);
          s.transactions = s.transactions.filter(t => !ids.has(t.id));
          ids.forEach(i => delete s.splits[i]);
          s.payments = s.payments.filter(p => !ids.has(p.txId));
          s.imports = s.imports.filter(x => x.id !== id);
        }));
        break;
      }
      case 'reset-all': confirmDialog({ title: 'Erase everything?', body: C.user ? 'All transactions, people, splits and payments will be deleted from your account on every device. Download a backup first if you might need it.' : 'All transactions, people, splits and payments in this browser will be deleted. Download a backup first if you might need it.', ok: 'Erase all', danger: true }, () => { commit('All data erased', s => Object.assign(s, blank())); setView('dashboard'); }); break;
    }
  });

  function resetValuesIfNeeded() {
    if (modal.mode === 'percent' || modal.mode === 'exact') modal.values = defaultValues(modal.mode, modal.picked, splitTotalP());
    modal.note = $('#split-note')?.value ?? modal.note;
  }
  function splitAddPeople() {
    const input = $('#split-new-name');
    const names = (input?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!names.length) { input?.focus(); return; }
    modal.note = $('#split-note')?.value ?? modal.note;
    names.forEach(n => { const p = addPerson(n); if (!modal.picked.includes(p.id)) modal.picked.push(p.id); });
    save();
    modal.adding = false;
    resetValuesIfNeeded();
    render();
    toast(`Added ${names.join(', ')}`);
  }
  function syncPayInputs() {
    if (!$('#pay-amount')) return;
    modal.amount = $('#pay-amount').value; modal.date = $('#pay-date').value; modal.note = $('#pay-note').value;
  }

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.splitVal) { modal.values[t.dataset.splitVal] = t.value; refreshSplitPreview(); }
    if (t.id === 'pay-amount' && modal) {
      modal.amount = t.value;
      const cur = balances()[modal.personId]?.balance || 0, amt = toP(t.value);
      const after = modal.dir === 'in' ? cur - amt : cur + amt;
      const st = $('#pay-status'); st.className = 'split-status ' + (after === 0 ? 'ok' : after > 0 ? 'warn' : 'bad'); st.innerHTML = payStatus(personById(modal.personId), cur, after);
      $('[data-action="pay-save"]').disabled = amt <= 0;
    }
    if (t.id === 'split-new-name') modal.newName = t.value;
    if (t.id === 'global-search') {
      clearTimeout(t._d);
      t._d = setTimeout(() => {
        ui.q = t.value; ui.limit = 150;
        if (ui.view !== 'transactions') { ui.view = 'transactions'; Object.assign(ui, { type: 'all', status: 'all', cat: 'all', month: 'all' }); saveUI(); }
        render();
      }, 120);
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.actionChange === 'filter') { ui[t.dataset.key] = t.value; ui.limit = 150; render(); }
    if (t.dataset.map && modal?.type === 'import') {
      const mp = Object.assign({}, modal.res.mapping, { [t.dataset.map]: Number(t.value) });
      const res = P.parseStatement(lastImportText, mp);
      Object.assign(modal, { res, open: true });
      renderModal();
    }
    if (t.id === 'file-input') { handleFile(t.files[0]); t.value = ''; }
    if (t.id === 'backup-input') {
      const f = t.files[0]; t.value = '';
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (!Array.isArray(data.transactions) || !Array.isArray(data.people)) throw new Error('bad');
          commit('Backup restored', s => { Object.assign(s, blank(), data); closeModal(); });
        } catch (err) { toast('That file isn\'t a Hisaab backup', { err: true }); }
      };
      r.readAsText(f);
    }
  });

  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (e.key === 'Escape') {
      if ($('.popover')) return closePopover();
      if (modal) return closeModal();
      if (ui.selected.size) { ui.selected.clear(); render(); }
      if (typing) document.activeElement.blur();
      return;
    }
    if (modal && e.key === 'Enter') {
      if (e.target.id === 'split-new-name') { e.preventDefault(); splitAddPeople(); return; }
      if (e.target.id === 'rename-input') { e.preventDefault(); $('[data-action="rename-save"]').click(); return; }
      if (e.target.id === 'people-names') { e.preventDefault(); savePeople(); return; }
      if (e.ctrlKey || e.metaKey || ['pay-amount', 'pay-note', 'ex-desc', 'split-note'].includes(e.target.id)) {
        const primary = $('.modal-foot .btn-primary:not(:disabled)');
        if (primary) { e.preventDefault(); primary.click(); }
      }
      return;
    }
    if (typing || modal || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === '/') { e.preventDefault(); $('#global-search').focus(); }
    else if (k === 'n') openModal({ type: 'expense' });
    else if (k === 'i') openImport();
    else if (k === 'p') openPayment();
    else if (k === 's' && ui.selected.size) openSplit([...ui.selected]);
    else if (k === '1') setView('dashboard');
    else if (k === '2') setView('transactions');
    else if (k === '3') setView('people');
    else if (e.key === '?') openModal({ type: 'help' });
  });

  // drag & drop anywhere
  let dragDepth = 0;
  const overlay = $('#drop-overlay');
  window.addEventListener('dragenter', e => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; e.preventDefault(); dragDepth++; overlay.hidden = false; });
  window.addEventListener('dragover', e => { e.preventDefault(); });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.hidden = true; });
  window.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; overlay.hidden = true; const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); });

  // ================= accounts & sync =================
  const GOOGLE_G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function showAuthScreen(msg) {
    hideAuthScreen();
    const el = document.createElement('div');
    el.id = 'auth-screen';
    el.className = 'auth-screen';
    el.innerHTML = `
      <div class="auth-card">
        <div class="brand" style="padding:0"><div class="brand-mark">₹</div><div><div class="brand-name" style="color:var(--ink)">Hisaab</div><div class="brand-tag" style="color:var(--muted)">split · track · settle</div></div></div>
        <h1>Your hisaab, <em>on every device.</em></h1>
        <p>Sign in to keep your expenses, splits and who-owes-you safely in your private account — open it on your laptop or phone and pick up where you left off.</p>
        ${msg ? `<div class="split-status bad" style="margin-bottom:14px">${icon('info')}<span style="flex:1;margin-left:8px">${esc(msg)}</span></div>` : ''}
        <button class="btn btn-google btn-block" data-action="google-login">${GOOGLE_G}Continue with Google</button>
        <div class="auth-or"><span>or</span></div>
        <button class="btn btn-ghost btn-block" data-action="use-local">${icon('lock', 'ico-sm')}Use on this device only</button>
        <ul class="auth-points">
          <li>${icon('check', 'ico-sm')}Only you can see your data — it's locked to your Google account</li>
          <li>${icon('check', 'ico-sm')}Works offline and syncs when you're back online</li>
          <li>${icon('check', 'ico-sm')}We never see your Google password</li>
        </ul>
        <div class="auth-legal">By continuing you agree to our <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</div>
      </div>
      <div class="auth-art" aria-hidden="true">
        <div class="float-card"><span class="avatar" style="background:#E8573F">RK</span><div><small>Rohan owes you</small><b>₹2,450</b></div></div>
        <div class="float-card"><span class="avatar" style="background:#7B4B94">AS</span><div><small>Weekend trip · split 3 ways</small><b>₹3,266 each</b></div></div>
        <div class="float-card"><span class="avatar" style="background:#00948A">MJ</span><div><small>Synced from your phone</small><b>just now ✓</b></div></div>
      </div>`;
    document.body.appendChild(el);
  }
  function hideAuthScreen() { $('#auth-screen')?.remove(); }

  async function googleLogin(btn) {
    if (!C.enabled) { toast(C.configured ? 'Sign-in needs an internet connection' : 'Cloud sync isn\'t set up yet — see SETUP.md', { err: true }); return; }
    if (btn) { btn.disabled = true; btn.innerHTML = `${GOOGLE_G}Opening Google…`; }
    try { localStorage.removeItem(MODE_KEY); } catch (e) { /* ignore */ }
    const { error } = await C.signInWithGoogle();
    if (error) { showAuthScreen(error.message); }
  }

  function useLocal() {
    try { localStorage.setItem(MODE_KEY, 'local'); } catch (e) { /* ignore */ }
    hideAuthScreen();
    storageKey = KEY; S = load(); render();
  }

  let activeUserId = null;
  async function startSession(user) {
    if (activeUserId === user.id) return;   // getSession and the SIGNED_IN event can both arrive
    activeUserId = user.id;
    hideAuthScreen();
    if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, '', location.pathname);
    storageKey = KEY + ':' + user.id;
    try { localStorage.setItem(LAST_USER_KEY, user.id); } catch (e) { /* ignore */ }
    S = load();
    render();
    renderAccount();
    try {
      const row = await C.fetchState();
      const remote = row && row.data && Object.keys(row.data).length ? Object.assign(blank(), row.data) : null;
      if (remote) {
        if ((S.savedAt || 0) > (remote.savedAt || 0)) C.schedulePush(S);   // offline edits made on this device
        else { S = remote; saveLocal(); render(); }
        renderAccount('synced');
      } else {
        const legacy = readKey(KEY);
        if (!hasData(S) && hasData(legacy)) {
          confirmDialog({ title: 'Move your data into your account?', body: `This browser already has <b>${legacy.transactions.length} transactions</b> and <b>${legacy.people.length} people</b> saved from before you signed in. Move them into your account so they sync everywhere?`, ok: 'Yes, move them' }, () => {
            S = legacy; save(); render(); toast('Moved into your account — now syncing');
          });
        } else if (hasData(S)) save();
        renderAccount('synced');
      }
    } catch (e) {
      renderAccount('offline');
      toast('Couldn\'t reach your account — showing the copy saved on this device', { err: true });
    }
    if (S.transactions.length && ui.view === 'dashboard') countUp();
  }

  function signOutFlow() {
    confirmDialog({ title: 'Sign out?', body: 'Your data stays safe in your account. This browser\'s copy is removed, so the next person using it can\'t see your expenses.', ok: 'Sign out' }, async () => {
      const userKey = storageKey;   // the SIGNED_OUT handler resets storageKey, so capture it first
      activeUserId = null;
      try { await C.signOut(); } catch (e) { /* ignore */ }
      try { if (userKey !== KEY) localStorage.removeItem(userKey); localStorage.removeItem(LAST_USER_KEY); } catch (e) { /* ignore */ }
      storageKey = KEY; S = blank(); ui.view = 'dashboard'; render(); renderAccount();
      showAuthScreen();
    });
  }

  const SYNC_LABEL = { synced: ['Synced', 'ok'], saving: ['Saving…', 'busy'], offline: ['Offline — will sync later', 'warn'], error: ['Sync failed — retrying', 'bad'], idle: ['Connecting…', 'busy'] };
  function renderAccount(st) {
    const box = $('#account');
    if (!box) return;
    const u = C.user;
    if (u) {
      const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email;
      const [label, cls] = SYNC_LABEL[st || C.status] || SYNC_LABEL.idle;
      box.innerHTML = `<div class="account-row"><span class="avatar sm" style="background:var(--amber);color:var(--ocean-900)">${esc(initials(name))}</span>
        <div style="min-width:0;flex:1"><div class="account-name">${esc(name)}</div><div class="sync-state ${cls}"><i></i>${label}</div></div>
        <button class="icon-btn account-out" data-action="sign-out" title="Sign out">${icon('out', 'ico-sm')}</button></div>`;
      $('.privacy').innerHTML = `${icon('lock')}Private to your Google account.`;
    } else if (C.configured) {
      box.innerHTML = `<button class="side-link" data-action="google-login"><span class="ico" style="background:#fff;border-radius:50%;padding:2px">${GOOGLE_G}</span>Sign in to sync devices</button>`;
      $('.privacy').innerHTML = `${icon('lock')}Saved in this browser only.`;
    } else {
      box.innerHTML = '';
    }
  }
  if (C.onStatus) C.onStatus(st => renderAccount(st));

  // Pull changes made on another device when you come back to this tab.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !C.user || modal) return;
    try {
      const row = await C.checkRemote();
      if (row && row.data) { S = Object.assign(blank(), row.data); saveLocal(); render(); toast('Updated with changes from your other device'); }
    } catch (e) { /* stay on local copy */ }
  });

  // ================= boot =================
  $$('[data-icon]').forEach(el => { el.innerHTML = svg(el.dataset.icon); });
  (async function boot() {
    if (!C.configured) { S = load(); render(); if (S.transactions.length && ui.view === 'dashboard') countUp(); return; }
    if (!C.enabled) {
      // Sync library didn't load (offline) — fall back to this device's copy of the last account.
      let last = null; try { last = localStorage.getItem(LAST_USER_KEY); } catch (e) { /* ignore */ }
      storageKey = last ? KEY + ':' + last : KEY;
      S = load(); render(); renderAccount();
      toast('You\'re offline — showing the copy saved on this device', { err: true });
      return;
    }
    C.onAuthChange((event, session) => {
      if (event === 'SIGNED_IN' && session) startSession(session.user);
      if (event === 'SIGNED_OUT' && activeUserId) { activeUserId = null; storageKey = KEY; S = blank(); render(); renderAccount(); showAuthScreen(); }
    });
    let user = null, err = null;
    try { user = await C.getUser(); } catch (e) { err = e; }
    if (user) return startSession(user);
    if (localMode()) { S = load(); render(); renderAccount(); if (S.transactions.length && ui.view === 'dashboard') countUp(); return; }
    render(); renderAccount();
    const q = new URLSearchParams(location.search);
    showAuthScreen(q.get('error_description') || (err ? 'Sign-in failed — please try again.' : ''));
  })();
  function countUp() {
    const el = $('[data-countup]'); if (!el) return;
    const target = Number(el.dataset.countup) / 100; const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / 900); const e = 1 - Math.pow(1 - k, 3);
      el.innerHTML = `<span class="cur">₹</span>${nf0.format(Math.round(target * e))}`;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  window.__hisaab = { get state() { return S; }, computeSplit };
})();
