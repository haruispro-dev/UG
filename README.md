# UNDERGROUND GEO — Setup & Free 24/7 Hosting

This is a real, working site: plain HTML/CSS/JS frontend (no build step) talking to a
**Supabase** backend (Postgres database + auth + file storage). Nothing here is a mockup —
every form, upload, and admin action reads/writes the real database.

Total cost: **$0**, hosted **24/7**, on free tiers.

## What's included right now (Phase 1 — foundation)
- Real registration/login (Artist / Producer / Music Lover), sessions, logout
- Editable profiles with social links, avatar upload, collab availability
- Releases & Beats: real upload (audio/video/cover files), real playback, real pages
- Community feed: posts, comments, replies, likes, sorting
- Contact / Collaboration requests + notifications
- Plugins/Presets/DAWs resource library with real file downloads, Discord-gated
- Discord OAuth membership verification (needs your Discord app credentials — see below)
- Full admin panel at `/admin.html`: users, content moderation, reports, categories,
  homepage section order/visibility, site settings — all writing to the real database
- Light/dark mode, responsive layout, reveal animations

Not yet wired (flagged honestly, not faked): drag-and-drop reordering (uses ↑/↓ buttons
instead, same real effect), the cursor-follow HUD flourish, and some of the deeper visual
polish from the original spec. Tell me which of these matters most and I'll build it next.

---

## STEP 1 — Create your free Supabase project (backend + database + storage)
1. Go to https://supabase.com → sign up free → **New project**.
2. Once it's created, go to **SQL Editor → New query**, paste the entire contents of
   `supabase/schema.sql` from this folder, and click **Run**. This creates every table,
   security rule, and storage bucket.
3. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
4. Open `js/config.js` in this project and paste them in:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```

## STEP 2 — Add your real logo
Drop your actual UG logo file (transparent PNG) at `assets/logo.png`. No logo file was
attached to this conversation, so the site currently just shows the "UNDERGROUND GEO"
text wordmark. Once you add the file, it appears automatically in the header — no code
changes needed. Same for `assets/favicon.ico` if you want a browser tab icon.

## STEP 3 — Deploy the frontend for free, 24/7
Pick one (all free, all always-on, no sleep/spin-down since it's static files):
- **Netlify**: drag this whole folder onto https://app.netlify.com/drop — done in ~30 seconds.
- **Vercel**: `vercel` CLI or connect a GitHub repo at https://vercel.com/new.
- **Cloudflare Pages** or **GitHub Pages**: also work great for a static folder like this.

Once deployed you'll have a permanent URL like `underground-geo.netlify.app` (or attach
your own domain later).

## STEP 4 — Make your first admin account
1. Visit your deployed site and register a normal account (any account type).
2. Back in Supabase → **SQL Editor**, run:
   ```sql
   update profiles set is_admin = true where username = 'your_username';
   ```
3. Go to `yoursite.com/admin-login.html` and log in with that account's email/password.
   There is no admin link anywhere on the public site, as required.

## STEP 5 (optional) — Real Discord gated downloads
1. In Supabase → **Authentication → Providers → Discord**, enable it and fill in a
   **Client ID/Secret** from a Discord app you create at https://discord.com/developers/applications.
2. In that Discord app, add your Supabase callback URL (shown on the same provider page)
   as a valid OAuth2 redirect.
3. In `/admin.html → Settings`, paste your Discord **invite link** and your server's
   **Guild ID** (right-click your server icon in Discord with Developer Mode on → Copy ID).
4. Users click "Verify my membership" on the Discord page — this checks their real
   Discord guilds via OAuth and unlocks gated resources. No membership is ever faked;
   if this isn't configured, gated downloads simply won't unlock, as required.

## Free tier limits to know about
- Supabase free: 500MB database, 1GB file storage, 50k monthly active users, project
  pauses after 7 days with zero API activity (any visit wakes it back up in seconds).
- Netlify/Vercel/Cloudflare Pages free: generous bandwidth, always-on, no sleep.

## File map
```
index.html, login.html, register.html, welcome.html, settings.html, profile.html,
people.html, releases.html, release.html, beats.html, beat.html, community.html,
post.html, upload.html, resources.html, discord.html, notifications.html,
admin-login.html, admin.html
css/style.css
js/config.js          ← your Supabase keys go here
js/supabase-client.js ← session handling
js/app.js              ← shared nav, comments, reactions, uploads
js/admin.js            ← admin dashboard logic
supabase/schema.sql    ← run once in Supabase SQL editor
assets/                ← put your real logo.png here
```

## What to tell me next
This was built as a solid, fully-wired foundation rather than all ~40 spec sections at
once (attempting that in one pass produces broken wiring, which defeats the point).
Good next slices to request: deeper homepage/section visual customization, drag-and-drop
admin reordering, the animated HUD/cursor layer, richer community categories/pagination,
or profile-picture import from YouTube/Spotify/SoundCloud.
