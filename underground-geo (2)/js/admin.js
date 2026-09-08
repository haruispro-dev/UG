const AdminApp = {
  async init() {
    const ok = await window.UG.requireAdmin();
    if (!ok) return;
    document.querySelectorAll('.tab-link').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.tab-link').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        this.render(a.dataset.tab);
      });
    });
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
      e.preventDefault(); await sb.auth.signOut(); window.location.href = 'admin-login.html';
    });
    this.render('overview');
  },

  main() { return document.getElementById('adminMain'); },

  async render(tab) {
    const fn = this['render_' + tab];
    if (fn) await fn.call(this);
  },

  async render_overview() {
    const [{count:users}, {count:releases}, {count:beats}, {count:posts}, {count:reports}, {count:collab}] = await Promise.all([
      sb.from('profiles').select('*', { count:'exact', head:true }),
      sb.from('releases').select('*', { count:'exact', head:true }),
      sb.from('beats').select('*', { count:'exact', head:true }),
      sb.from('posts').select('*', { count:'exact', head:true }),
      sb.from('reports').select('*', { count:'exact', head:true }).eq('status','open'),
      sb.from('collab_requests').select('*', { count:'exact', head:true }).eq('status','pending')
    ]);
    this.main().innerHTML = `
      <h2>Overview</h2>
      <div class="stat-grid">
        ${this.stat(users,'Users')} ${this.stat(releases,'Releases')} ${this.stat(beats,'Beats')}
        ${this.stat(posts,'Community posts')} ${this.stat(reports,'Open reports')} ${this.stat(collab,'Pending requests')}
      </div>`;
  },
  stat(n,label){ return `<div class="stat-card"><div class="num">${n||0}</div><div class="label">${label}</div></div>`; },

  async render_users() {
    const { data } = await sb.from('profiles').select('*').order('created_at', { ascending:false });
    this.main().innerHTML = `
      <h2>Users (${data.length})</h2>
      <table class="admin-table"><thead><tr><th>Name</th><th>Username</th><th>Type</th><th>Admin</th><th>Actions</th></tr></thead>
      <tbody>${data.map(u => `
        <tr>
          <td>${UGApp.escapeHtml(u.display_name)}</td>
          <td>@${u.username}</td>
          <td>${u.account_type}</td>
          <td><label class="switch"><input type="checkbox" ${u.is_admin?'checked':''} onchange="AdminApp.toggleAdmin('${u.id}', this.checked)"><span class="slider"></span></label></td>
          <td><button class="btn btn-danger btn-sm" onclick="AdminApp.deleteRow('profiles','${u.id}','render_users')">Delete</button></td>
        </tr>`).join('')}</tbody></table>`;
  },
  async toggleAdmin(id, val) { await sb.from('profiles').update({ is_admin: val }).eq('id', id); },

  async render_releases() { await this.renderContentTable('releases', ['title'], (r) => `<a href="profile.html" target="_blank">artist</a>`); },
  async render_beats() { await this.renderContentTable('beats', ['name']); },
  async render_posts() { await this.renderContentTable('posts', ['title']); },

  async renderContentTable(table, titleKeys) {
    const { data } = await sb.from(table).select('*').order('created_at', { ascending:false });
    this.main().innerHTML = `
      <h2>${table[0].toUpperCase()+table.slice(1)} (${data.length})</h2>
      <table class="admin-table"><thead><tr><th>Title</th><th>Featured</th><th>Pinned</th><th>Hidden</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>${data.map(row => `
        <tr>
          <td>${UGApp.escapeHtml(titleKeys.map(k=>row[k]).join(' '))}</td>
          <td><label class="switch"><input type="checkbox" ${row.featured?'checked':''} onchange="AdminApp.toggleField('${table}','${row.id}','featured',this.checked)"><span class="slider"></span></label></td>
          <td><label class="switch"><input type="checkbox" ${row.pinned?'checked':''} onchange="AdminApp.toggleField('${table}','${row.id}','pinned',this.checked)"><span class="slider"></span></label></td>
          <td><label class="switch"><input type="checkbox" ${row.hidden?'checked':''} onchange="AdminApp.toggleField('${table}','${row.id}','hidden',this.checked)"><span class="slider"></span></label></td>
          <td>${new Date(row.created_at).toLocaleDateString()}</td>
          <td><button class="btn btn-danger btn-sm" onclick="AdminApp.deleteRow('${table}','${row.id}','render_${table}')">Delete</button></td>
        </tr>`).join('')}</tbody></table>`;
  },
  async toggleField(table,id,field,val){ await sb.from(table).update({[field]:val}).eq('id',id); },
  async deleteRow(table,id,rerender){ if(!confirm('Delete this permanently?'))return; await sb.from(table).delete().eq('id',id); this.render(rerender.replace('render_','')); },

  async render_reports() {
    const { data } = await sb.from('reports').select('*, profiles:reporter_id(display_name)').order('created_at', { ascending:false });
    this.main().innerHTML = `
      <h2>Reports</h2>
      <table class="admin-table"><thead><tr><th>Target</th><th>Reason</th><th>Reporter</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${data.map(r => `
        <tr><td>${r.target_type} / ${r.target_id.slice(0,8)}</td><td>${UGApp.escapeHtml(r.reason||'')}</td>
        <td>${UGApp.escapeHtml(r.profiles?.display_name||'')}</td><td>${r.status}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="AdminApp.hideReported('${r.target_type}','${r.target_id}','${r.id}')">Hide content</button>
          <button class="btn btn-ghost btn-sm" onclick="AdminApp.setReportStatus('${r.id}','resolved')">Resolve</button>
          <button class="btn btn-ghost btn-sm" onclick="AdminApp.setReportStatus('${r.id}','dismissed')">Dismiss</button>
        </td></tr>`).join('')}</tbody></table>`;
  },
  async setReportStatus(id,status){ await sb.from('reports').update({status}).eq('id',id); this.render('reports'); },
  async hideReported(targetType, targetId, reportId) {
    const table = targetType === 'post' ? 'posts' : targetType === 'release' ? 'releases' : targetType === 'beat' ? 'beats' : null;
    if (!table) { alert('This content type cannot be hidden here.'); return; }
    await sb.from(table).update({ hidden: true }).eq('id', targetId);
    await sb.from('reports').update({ status: 'resolved' }).eq('id', reportId);
    this.render('reports');
  },

  async render_collab() {
    const { data } = await sb.from('collab_requests').select('*, sender:sender_id(display_name), receiver:receiver_id(display_name)').order('created_at', { ascending:false });
    this.main().innerHTML = `
      <h2>Collaboration & Contact Requests</h2>
      <table class="admin-table"><thead><tr><th>From</th><th>To</th><th>Kind</th><th>Status</th></tr></thead>
      <tbody>${data.map(r => `<tr><td>${UGApp.escapeHtml(r.sender?.display_name||'')}</td><td>${UGApp.escapeHtml(r.receiver?.display_name||'')}</td><td>${r.kind}</td><td>${r.status}</td></tr>`).join('')}</tbody></table>`;
  },

  async render_resources() {
    const { data } = await sb.from('resources').select('*').order('created_at', { ascending:false });
    this.main().innerHTML = `
      <h2>Resources</h2>
      <form id="resourceForm" style="max-width:420px;margin-bottom:26px" class="form-card">
        <div class="field"><label>Name</label><input type="text" id="rName" required></div>
        <div class="field"><label>Category</label><select id="rCategory"><option value="plugin">Plugin</option><option value="preset">Preset</option><option value="daw">DAW</option><option value="other">Other</option></select></div>
        <div class="field"><label>Description</label><textarea id="rDesc" rows="2"></textarea></div>
        <div class="field"><label>Version <span class="field-hint">(optional)</span></label><input type="text" id="rVersion"></div>
        <div class="field"><label>File <span class="field-hint">(required — the real download)</span></label><input type="file" id="rFile" required></div>
        <div class="field"><label>Preview image <span class="field-hint">(optional)</span></label><input type="file" id="rPreview" accept="image/*"></div>
        <div class="field"><label>Require Discord join to download?</label><label class="switch"><input type="checkbox" id="rGated" checked><span class="slider"></span></label></div>
        <button class="btn btn-primary btn-block" type="submit">Upload resource</button>
      </form>
      <table class="admin-table"><thead><tr><th>Name</th><th>Category</th><th>Gated</th><th>Actions</th></tr></thead>
      <tbody>${data.map(r => `<tr><td>${UGApp.escapeHtml(r.name)}</td><td>${r.category}</td><td>${r.discord_gated?'Yes':'No'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="AdminApp.deleteRow('resources','${r.id}','render_resources')">Delete</button></td></tr>`).join('')}</tbody></table>`;

    document.getElementById('resourceForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('rFile').files[0];
      const preview = document.getElementById('rPreview').files[0];
      const file_url = await UGApp.uploadFile('resources', file);
      const preview_image_url = preview ? await UGApp.uploadFile('resources', preview) : null;
      await sb.from('resources').insert({
        name: document.getElementById('rName').value.trim(),
        category: document.getElementById('rCategory').value,
        description: document.getElementById('rDesc').value.trim(),
        version: document.getElementById('rVersion').value.trim() || null,
        file_url, preview_image_url,
        discord_gated: document.getElementById('rGated').checked
      });
      this.render('resources');
    });
  },

  async render_categories() {
    const { data } = await sb.from('categories').select('*').order('order_index');
    this.main().innerHTML = `
      <h2>Categories & Navigation</h2>
      <p class="field-hint">Controls what shows on the homepage vs. the ⋯ menu, and reorders both.</p>
      <table class="admin-table"><thead><tr><th></th><th>Icon</th><th>Label</th><th>Enabled</th><th>On Homepage</th><th>In ⋯ Menu</th><th>Needs login</th><th></th></tr></thead>
      <tbody id="catBody">${data.map((c,i) => `
        <tr draggable="true" data-id="${c.id}" data-order="${c.order_index}">
          <td class="drag-handle">⠿</td>
          <td><input value="${UGApp.escapeHtml(c.icon||'')}" maxlength="2" placeholder="🎵" onchange="AdminApp.updateCategory('${c.id}',{icon:this.value})" style="width:44px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px;text-align:center"></td>
          <td><input value="${UGApp.escapeHtml(c.label)}" onchange="AdminApp.updateCategory('${c.id}',{label:this.value})" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px"></td>
          <td><label class="switch"><input type="checkbox" ${c.enabled?'checked':''} onchange="AdminApp.updateCategory('${c.id}',{enabled:this.checked})"><span class="slider"></span></label></td>
          <td><label class="switch"><input type="checkbox" ${c.show_on_home?'checked':''} onchange="AdminApp.updateCategory('${c.id}',{show_on_home:this.checked})"><span class="slider"></span></label></td>
          <td><label class="switch"><input type="checkbox" ${c.show_in_menu?'checked':''} onchange="AdminApp.updateCategory('${c.id}',{show_in_menu:this.checked})"><span class="slider"></span></label></td>
          <td><label class="switch"><input type="checkbox" ${c.requires_registration?'checked':''} onchange="AdminApp.updateCategory('${c.id}',{requires_registration:this.checked})"><span class="slider"></span></label></td>
          <td><button class="btn btn-danger btn-sm" onclick="AdminApp.deleteRow('categories','${c.id}','render_categories')">Delete</button></td>
        </tr>`).join('')}</tbody></table>
      <button class="btn btn-ghost btn-sm" style="margin-top:14px" onclick="AdminApp.addCategory()">+ Add category</button>`;
    this.wireDragReorder('catBody', 'categories');
  },
  wireDragReorder(bodyId, table) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    let dragEl = null;
    body.querySelectorAll('tr').forEach(row => {
      row.addEventListener('dragstart', () => { dragEl = row; row.style.opacity = '.4'; });
      row.addEventListener('dragend', () => { row.style.opacity = '1'; });
      row.addEventListener('dragover', (e) => e.preventDefault());
      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!dragEl || dragEl === row) return;
        const rows = Array.from(body.children);
        const dragIdx = rows.indexOf(dragEl), dropIdx = rows.indexOf(row);
        if (dragIdx < dropIdx) row.after(dragEl); else row.before(dragEl);
        const updates = Array.from(body.children).map((r, i) => sb.from(table).update({ order_index: i }).eq('id', r.dataset.id));
        await Promise.all(updates);
      });
    });
  },

  async updateCategory(id, fields) { await sb.from('categories').update(fields).eq('id', id); },
  async addCategory() {
    const label = prompt('Category label:'); if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    const { data } = await sb.from('categories').select('order_index').order('order_index',{ascending:false}).limit(1);
    await sb.from('categories').insert({ key, label, order_index: (data?.[0]?.order_index || 0) + 1 });
    this.render('categories');
  },
  async moveCategory(id, dir) {
    const { data } = await sb.from('categories').select('*').order('order_index');
    const idx = data.findIndex(c => c.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= data.length) return;
    const a = data[idx], b = data[swapIdx];
    await sb.from('categories').update({ order_index: b.order_index }).eq('id', a.id);
    await sb.from('categories').update({ order_index: a.order_index }).eq('id', b.id);
    this.render('categories');
  },

  async render_homepage() {
    const { data } = await sb.from('homepage_sections').select('*').order('order_index');
    this.main().innerHTML = `
      <h2>Homepage Sections</h2>
      <table class="admin-table"><thead><tr><th></th><th>Title</th><th>Type</th><th>Enabled</th><th>Item limit</th><th></th></tr></thead>
      <tbody id="secBody">${data.map((s,i) => `
        <tr draggable="true" data-id="${s.id}" data-order="${s.order_index}">
          <td class="drag-handle">⠿</td>
          <td><input value="${UGApp.escapeHtml(s.title)}" onchange="AdminApp.updateSection('${s.id}',{title:this.value})" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px"></td>
          <td>${s.section_type}</td>
          <td><label class="switch"><input type="checkbox" ${s.enabled?'checked':''} onchange="AdminApp.updateSection('${s.id}',{enabled:this.checked})"><span class="slider"></span></label></td>
          <td><input type="number" value="${s.item_limit}" style="width:60px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px" onchange="AdminApp.updateSection('${s.id}',{item_limit:parseInt(this.value)})"></td>
          <td><button class="btn btn-danger btn-sm" onclick="AdminApp.deleteRow('homepage_sections','${s.id}','render_homepage')">Delete</button></td>
        </tr>`).join('')}</tbody></table>`;
    this.wireDragReorder('secBody', 'homepage_sections');
  },
  async updateSection(id, fields) { await sb.from('homepage_sections').update(fields).eq('id', id); },
  async moveSection(id, dir) {
    const { data } = await sb.from('homepage_sections').select('*').order('order_index');
    const idx = data.findIndex(s => s.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= data.length) return;
    const a = data[idx], b = data[swapIdx];
    await sb.from('homepage_sections').update({ order_index: b.order_index }).eq('id', a.id);
    await sb.from('homepage_sections').update({ order_index: a.order_index }).eq('id', b.id);
    this.render('homepage');
  },

  async render_settings() {
    const { data: s } = await sb.from('site_settings').select('*').single();
    this.main().innerHTML = `
      <h2>Site Settings</h2>
      <form id="settingsForm" class="form-card" style="max-width:480px">
        <div class="field"><label>Site name</label><input id="sName" value="${UGApp.escapeHtml(s.site_name||'')}"></div>
        <div class="field"><label>Hero title</label><input id="sHeroTitle" value="${UGApp.escapeHtml(s.homepage_hero_title||'')}"></div>
        <div class="field"><label>Hero subtitle</label><input id="sHeroSub" value="${UGApp.escapeHtml(s.homepage_hero_subtitle||'')}"></div>
        <div class="field"><label>Discord invite link</label><input id="sDiscord" value="${UGApp.escapeHtml(s.discord_invite_link||'')}"></div>
        <div class="field"><label>Discord server (guild) ID</label><input id="sGuild" value="${UGApp.escapeHtml(s.discord_guild_id||'')}"></div>
        <div class="field"><label>Max upload size (MB)</label><input type="number" id="sMaxUpload" value="${s.max_upload_mb}"></div>
        <div class="field"><label>Registration open?</label><label class="switch"><input type="checkbox" id="sRegOpen" ${s.registration_enabled?'checked':''}><span class="slider"></span></label></div>
        <button class="btn btn-primary btn-block" type="submit">Save settings</button>
      </form>`;
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await sb.from('site_settings').update({
        site_name: document.getElementById('sName').value,
        homepage_hero_title: document.getElementById('sHeroTitle').value,
        homepage_hero_subtitle: document.getElementById('sHeroSub').value,
        discord_invite_link: document.getElementById('sDiscord').value,
        discord_guild_id: document.getElementById('sGuild').value,
        max_upload_mb: parseInt(document.getElementById('sMaxUpload').value) || 50,
        registration_enabled: document.getElementById('sRegOpen').checked
      }).eq('id', 1);
      alert('Settings saved.');
    });
  }
};

AdminApp.init();
