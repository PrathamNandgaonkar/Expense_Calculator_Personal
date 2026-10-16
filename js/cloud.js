/* Hisaab — cloud sync + Google sign-in via Supabase.
 * The whole ledger is stored as one JSON document per user (table public.hisaab_state).
 * Writes are debounced; the last write wins. The browser keeps a cache so the app opens instantly
 * and keeps working offline — pending changes are pushed when the connection returns.
 */
(function () {
  'use strict';
  const cfg = window.HISAAB_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const libLoaded = !!(window.supabase && window.supabase.createClient);
  const enabled = configured && libLoaded;
  const TABLE = 'hisaab_state';

  let client = null, user = null;
  let latest = null, version = 0, timer = null, inFlight = null;
  let lastRemoteAt = null;
  let status = 'idle';
  const listeners = [];

  if (enabled) {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    // Registered before the app's listener, so `user` is always current when the app reacts to an auth event.
    client.auth.onAuthStateChange((event, session) => { user = session ? session.user : null; });
  }

  function setStatus(s) { status = s; listeners.forEach(f => { try { f(s); } catch (e) { /* ignore */ } }); }

  async function getUser() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    user = data.session ? data.session.user : null;
    return user;
  }

  function signInWithGoogle() {
    return client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
    });
  }

  async function signOut() {
    await flush().catch(() => {});
    await client.auth.signOut();
    user = null; latest = null; lastRemoteAt = null;
    setStatus('idle');
  }

  async function fetchState() {
    const { data, error } = await client.from(TABLE).select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (data) lastRemoteAt = data.updated_at;
    return data;
  }

  function schedulePush(state) {
    if (!user) return;
    latest = state; version++;
    setStatus(navigator.onLine === false ? 'offline' : 'saving');
    clearTimeout(timer);
    timer = setTimeout(push, 700);
  }

  async function push() {
    if (!user || !latest) return;
    if (inFlight) { await inFlight.catch(() => {}); }
    const v = version;
    const at = new Date().toISOString();
    inFlight = (async () => {
      const { error } = await client.from(TABLE).upsert({ user_id: user.id, data: latest, updated_at: at });
      if (error) throw error;
    })();
    try {
      await inFlight;
      lastRemoteAt = at;
      if (v === version) setStatus('synced');
    } catch (e) {
      setStatus(navigator.onLine === false ? 'offline' : 'error');
      clearTimeout(timer);
      timer = setTimeout(push, 8000);
    } finally { inFlight = null; }
  }

  const isPending = () => status === 'saving' || status === 'offline' || status === 'error';
  async function flush() { if (isPending()) { clearTimeout(timer); await push(); } }

  /** Returns the remote row if another device saved something newer, else null. */
  async function checkRemote() {
    if (!user || isPending() || inFlight) return null;
    const { data, error } = await client.from(TABLE).select('updated_at').eq('user_id', user.id).maybeSingle();
    if (error || !data) return null;
    if (lastRemoteAt && new Date(data.updated_at) <= new Date(lastRemoteAt)) return null;
    return fetchState();
  }

  window.addEventListener('online', () => { if (isPending()) push(); });
  window.addEventListener('offline', () => { if (isPending()) setStatus('offline'); });
  window.addEventListener('beforeunload', e => { if (isPending()) { e.preventDefault(); e.returnValue = ''; } });

  window.HisaabCloud = {
    configured, libLoaded, enabled,
    get user() { return user; },
    get status() { return status; },
    onStatus: f => listeners.push(f),
    // Supabase holds an internal lock while auth callbacks run; calling the database from inside one can hang.
    // So the app's callback is deferred to the next tick.
    onAuthChange: cb => client && client.auth.onAuthStateChange((event, session) => { setTimeout(() => cb(event, session), 0); }),
    getUser, signInWithGoogle, signOut, fetchState, schedulePush, flush, checkRemote,
  };
})();
