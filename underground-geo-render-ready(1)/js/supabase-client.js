// Loaded after https://unpkg.com/@supabase/supabase-js@2 CDN script + config.js

// Guard: if Supabase isn't configured yet, show a clear setup screen instead of
// hanging forever on "Loading…" — this happens regardless of which host you use.
(function checkConfig(){
  const cfg = window.UG_CONFIG || {};
  const notConfigured = !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR_SUPABASE') ||
                         !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  if (notConfigured) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML = `
        <div style="max-width:520px;margin:80px auto;padding:0 20px;font-family:system-ui;color:#eceaf5;background:#0b0b0f;min-height:100vh">
          <h1 style="font-size:1.6rem">⚙️ Almost there</h1>
          <p style="color:#9a97ab;line-height:1.6">
            This site is deployed, but not connected to a database yet — that's why pages hang on "Loading…".
            Open <code>js/config.js</code> in your project files and paste in your Supabase Project URL and anon key,
            then redeploy. Full steps are in <code>README.md</code>.
          </p>
          <ol style="color:#9a97ab;line-height:1.9">
            <li>supabase.com → New project (free)</li>
            <li>SQL Editor → paste <code>supabase/schema.sql</code> → Run</li>
            <li>Project Settings → API → copy URL + anon key into <code>js/config.js</code></li>
            <li>Redeploy this folder to your host</li>
          </ol>
        </div>`;
    });
    throw new Error('UG: Supabase not configured — see js/config.js');
  }
})();

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
