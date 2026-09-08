// Loaded after https://unpkg.com/@supabase/supabase-js@2 CDN script + config.js
const { createClient } = supabase;
const sb = createClient(window.UG_CONFIG.SUPABASE_URL, window.UG_CONFIG.SUPABASE_ANON_KEY);
window.sb = sb;

// Current session/profile cache, refreshed on load and on auth change
window.UG = {
  user: null,
  profile: null,
  async refreshSession() {
    const { data: { session } } = await sb.auth.getSession();
    window.UG.user = session ? session.user : null;
    if (window.UG.user) {
      const { data } = await sb.from('profiles').select('*').eq('id', window.UG.user.id).single();
      window.UG.profile = data || null;
    } else {
      window.UG.profile = null;
    }
    document.dispatchEvent(new CustomEvent('ug:session-ready'));
    return window.UG.profile;
  },
  async requireLogin(redirectTo = 'login.html') {
    await this.refreshSession();
    if (!this.user) {
      window.location.href = redirectTo + '?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      return false;
    }
    return true;
  },
  async requireAdmin() {
    const ok = await this.requireLogin('admin-login.html');
    if (!ok) return false;
    if (!this.profile || !this.profile.is_admin) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
};

sb.auth.onAuthStateChange(() => { window.UG.refreshSession(); });
