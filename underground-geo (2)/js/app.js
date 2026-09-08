// ============================================================
// Shared UI: header/nav, theme, mobile menu, auth state.
// Every page calls UGApp.init('categoryKey') on load.
// ============================================================
const UGApp = {
  async init(activeKey = '') {
    this.initTheme();
    await window.UG.refreshSession();
    await this.renderNav(activeKey);
    this.wireMobileMenu();
    this.wireDropdown();
    this.observeSections();
  },

  initTheme() {
    const saved = localStorage.getItem('ug-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    document.addEventListener('click', (e) => {
      if (e.target.closest('#themeToggle')) {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ug-theme', next);
      }
    });
  },

  async getCategories() {
    const { data } = await sb.from('categories').select('*').order('order_index');
    return data || [];
  },

  async renderNav(activeKey) {
    const cats = await this.getCategories();
    const enabled = cats.filter(c => c.enabled);
    const homeCats = enabled.filter(c => c.show_on_home);
    const menuCats = enabled.filter(c => c.show_in_menu);

    const topLinks = homeCats.map(c =>
      `<a href="${this.hrefFor(c.key)}" class="${activeKey === c.key ? 'active' : ''}">${c.icon ? c.icon+' ' : ''}${c.label}</a>`
    ).join('');

    const dropdownLinks = menuCats.map(c =>
      `<a href="${this.hrefFor(c.key)}">${c.icon ? c.icon+' ' : ''}${c.label}</a>`
    ).join('');

    const profile = window.UG.profile;
    const authArea = profile
      ? `<button class="ug-dots" id="profileBtn" title="Account">
           <img src="${profile.avatar_url || 'assets/default-avatar.svg'}" style="width:26px;height:26px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'">
         </button>
         <div class="ug-dropdown" id="profileDropdown">
           <a href="profile.html?u=${profile.username}">Profile</a>
           <a href="settings.html">Settings</a>
           <a href="upload.html">Upload</a>
           <a href="notifications.html">Notifications</a>
           ${profile.is_admin ? '<a href="admin.html">Admin Panel</a>' : ''}
           <button id="logoutBtn">Logout</button>
         </div>`
      : `<a href="login.html" class="btn btn-ghost btn-sm">Log in</a>
         <a href="register.html" class="btn btn-primary btn-sm">Sign up</a>`;

    const nav = document.getElementById('ugNav');
    if (!nav) return;
    nav.innerHTML = `
      <div class="ug-nav-inner">
        <a href="index.html" class="ug-logo">
          <img src="assets/logo.png" alt="UG" onerror="this.style.display='none'">
          UNDERGROUND<span class="tag">GEO</span>
        </a>
        <nav class="ug-nav-links">${topLinks}</nav>
        <div class="ug-nav-actions">
          <button class="ug-dots" id="themeToggle" title="Toggle theme">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1M12 20v1M4.2 4.2l.7.7M18.4 18.4l.7.7M3 12h1M20 12h1M4.2 19.8l.7-.7M18.4 5.6l.7-.7"/><circle cx="12" cy="12" r="4"/></svg>
          </button>
          <button class="ug-dots" id="searchToggle" title="Search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          </button>
          ${authArea}
          <button class="ug-dots" id="menuDots" title="More">
            <span></span><span></span><span></span>
          </button>
          <div class="ug-dropdown" id="menuDropdown">${dropdownLinks}</div>
          <button class="mobile-menu-btn" id="mobileBtn">☰</button>
        </div>
      </div>
    `;

    const mobilePanel = document.getElementById('mobilePanel');
    if (mobilePanel) mobilePanel.innerHTML = topLinks + dropdownLinks + (profile ? '' : `<a href="login.html">Log in</a><a href="register.html">Sign up</a>`);

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = 'index.html';
    });
    document.getElementById('searchToggle')?.addEventListener('click', () => {
      const q = prompt('Search UG — artists, producers, releases, beats:');
      if (q && q.trim()) window.location.href = 'search.html?q=' + encodeURIComponent(q.trim());
    });
  },

  hrefFor(key) {
    const map = {
      featured: 'featured.html', artists: 'people.html?type=artist', producers: 'people.html?type=producer',
      releases: 'releases.html', beats: 'beats.html', community: 'community.html',
      plugins: 'resources.html?cat=plugin', presets: 'resources.html?cat=preset', daws: 'resources.html?cat=daw',
      discord: 'discord.html'
    };
    return map[key] || (key + '.html');
  },

  wireDropdown() {
    document.addEventListener('click', (e) => {
      const menuBtn = e.target.closest('#menuDots');
      const profileBtn = e.target.closest('#profileBtn');
      document.getElementById('menuDropdown')?.classList.toggle('open', !!menuBtn && !document.getElementById('menuDropdown').classList.contains('open'));
      document.getElementById('profileDropdown')?.classList.toggle('open', !!profileBtn && !document.getElementById('profileDropdown').classList.contains('open'));
      if (!menuBtn && !e.target.closest('#menuDropdown')) document.getElementById('menuDropdown')?.classList.remove('open');
      if (!profileBtn && !e.target.closest('#profileDropdown')) document.getElementById('profileDropdown')?.classList.remove('open');
    });
  },

  wireMobileMenu() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('#mobileBtn')) {
        document.getElementById('mobilePanel')?.classList.add('open');
        document.getElementById('mobileBackdrop')?.classList.add('open');
      }
      if (e.target.closest('#mobileBackdrop')) {
        document.getElementById('mobilePanel')?.classList.remove('open');
        document.getElementById('mobileBackdrop')?.classList.remove('open');
      }
    });
  },

  observeSections() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) en.target.classList.add('in-view'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('[data-anim]').forEach(el => io.observe(el));
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  },

  timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  },

  // ---------- Reactions ----------
  async getReactionState(targetType, targetId) {
    const { data } = await sb.from('reactions').select('user_id').eq('target_type', targetType).eq('target_id', targetId).eq('reaction_type', 'like');
    const count = data ? data.length : 0;
    const liked = !!(window.UG.user && data && data.some(r => r.user_id === window.UG.user.id));
    return { count, liked };
  },

  async toggleReaction(targetType, targetId) {
    if (!window.UG.user) { window.location.href = 'login.html'; return; }
    const { liked } = await this.getReactionState(targetType, targetId);
    if (liked) {
      await sb.from('reactions').delete().eq('user_id', window.UG.user.id).eq('target_type', targetType).eq('target_id', targetId).eq('reaction_type', 'like');
    } else {
      await sb.from('reactions').insert({ user_id: window.UG.user.id, target_type: targetType, target_id: targetId, reaction_type: 'like' });
    }
    return this.getReactionState(targetType, targetId);
  },

  async renderLikeButton(containerId, targetType, targetId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const paint = async () => {
      const { count, liked } = await this.getReactionState(targetType, targetId);
      el.innerHTML = `<button class="btn ${liked ? 'btn-primary' : 'btn-ghost'} btn-sm">♥ ${count}</button>`;
    };
    await paint();
    el.addEventListener('click', async () => { await this.toggleReaction(targetType, targetId); await paint(); });
  },

  // ---------- Comments ----------
  async renderComments(containerId, targetType, targetId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const load = async () => {
      const { data } = await sb.from('comments').select('*, profiles:author_id(username, display_name, avatar_url)').eq('target_type', targetType).eq('target_id', targetId).order('created_at');
      const top = (data || []).filter(c => !c.parent_comment_id);
      const replies = (data || []).filter(c => c.parent_comment_id);
      const renderOne = (c, isReply) => `
        <div class="comment ${isReply ? 'comment-reply' : ''}" data-id="${c.id}">
          <div class="comment-head">
            <img src="${c.profiles?.avatar_url || 'assets/default-avatar.svg'}">
            <span class="comment-name">${this.escapeHtml(c.profiles?.display_name || 'User')}</span>
            <span class="comment-time">${this.timeAgo(c.created_at)}</span>
          </div>
          <div class="comment-body">${this.escapeHtml(c.content)}</div>
          <div style="display:flex;gap:12px;margin-top:4px">
            ${!isReply ? `<button class="btn-link reply-btn" data-id="${c.id}" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:.78rem;padding:0">Reply</button>` : ''}
            ${window.UG.user && (window.UG.user.id === c.author_id || window.UG.profile?.is_admin) ? `<button class="del-comment-btn" data-id="${c.id}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.78rem;padding:0">Delete</button>` : ''}
          </div>
        </div>`;
      el.innerHTML = `
        ${window.UG.user ? `
          <div class="field" style="display:flex;gap:8px;margin-top:16px">
            <input type="text" id="newCommentInput" placeholder="Write a comment…" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg)">
            <button class="btn btn-primary btn-sm" id="postCommentBtn">Post</button>
          </div>` : `<p class="field-hint" style="margin-top:16px"><a href="login.html">Log in</a> to comment.</p>`}
        <div id="commentList">
          ${top.length ? top.map(c => renderOne(c,false) + replies.filter(r=>r.parent_comment_id===c.id).map(r=>renderOne(r,true)).join('')).join('') : '<div class="empty-state">No comments yet.</div>'}
        </div>`;

      document.getElementById('postCommentBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('newCommentInput');
        const content = input.value.trim();
        if (!content) return;
        await sb.from('comments').insert({ author_id: window.UG.user.id, target_type: targetType, target_id: targetId, content });
        input.value = '';
        load();
      });
      el.querySelectorAll('.del-comment-btn').forEach(b => b.addEventListener('click', async () => {
        await sb.from('comments').delete().eq('id', b.dataset.id);
        load();
      }));
      el.querySelectorAll('.reply-btn').forEach(b => b.addEventListener('click', () => {
        const text = prompt('Reply:');
        if (text && text.trim()) {
          sb.from('comments').insert({ author_id: window.UG.user.id, target_type: targetType, target_id: targetId, content: text.trim(), parent_comment_id: b.dataset.id }).then(load);
        }
      }));
    };
    await load();
  },

  // ---------- Three-dot content menu ----------
  contentMenu(targetType, targetId, ownerId, shareUrl) {
    const isOwner = window.UG.user && window.UG.user.id === ownerId;
    const isAdmin = window.UG.profile?.is_admin;
    const id = 'menu-' + targetType + '-' + targetId;
    setTimeout(() => {
      document.getElementById('btn-' + id)?.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        document.getElementById(id).classList.toggle('open');
      });
    });
    return `
      <div style="position:relative" onclick="event.stopPropagation()">
        <button class="ug-dots" id="btn-${id}" style="width:30px;height:30px">
          <span></span><span></span><span></span>
        </button>
        <div class="ug-dropdown" id="${id}" style="right:0;top:34px">
          <button onclick="navigator.clipboard.writeText('${shareUrl}');alert('Link copied')">Copy link</button>
          ${!isOwner ? `<button onclick="UGApp.reportContent('${targetType}','${targetId}')">Report</button>` : ''}
          ${isOwner || isAdmin ? `<button onclick="UGApp.deleteContent('${targetType}','${targetId}')" style="color:var(--danger)">Delete</button>` : ''}
        </div>
      </div>`;
  },

  async reportContent(targetType, targetId) {
    if (!window.UG.user) { window.location.href = 'login.html'; return; }
    const reason = prompt('Why are you reporting this?') || '';
    await sb.from('reports').insert({ reporter_id: window.UG.user.id, target_type: targetType, target_id: targetId, reason });
    alert('Report submitted. Thanks for keeping UG clean.');
  },

  async deleteContent(targetType, targetId) {
    if (!confirm('Delete this permanently?')) return;
    const table = targetType === 'post' ? 'posts' : targetType === 'release' ? 'releases' : 'beats';
    await sb.from(table).delete().eq('id', targetId);
    window.location.reload();
  },

  async uploadFile(bucket, file) {
    if (!file) return null;
    const path = `${window.UG.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_')}`;
    const { error } = await sb.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
};
