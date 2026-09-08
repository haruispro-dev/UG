-- ============================================================
-- UNDERGROUND GEO — Database Schema (Supabase / Postgres)
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Extension for UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- PROFILES (extends Supabase auth.users)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  account_type text not null check (account_type in ('artist','producer','member')),
  bio text default '',
  avatar_url text,
  youtube_url text,
  spotify_url text,
  soundcloud_url text,
  instagram_url text,
  tiktok_url text,
  discord_username text,
  beatstars_url text,
  other_links jsonb default '[]'::jsonb,
  collab_availability boolean default false,
  contact_preference text default 'platform',
  is_admin boolean default false,
  discord_verified boolean default false,
  profile_complete boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- RELEASES
-- ------------------------------------------------------------
create table if not exists releases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  cover_url text,
  audio_url text,
  video_url text,
  external_link text,
  youtube_link text,
  description text,
  genre text,
  location text,
  featured boolean default false,
  pinned boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- BEATS
-- ------------------------------------------------------------
create table if not exists beats (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  bpm int not null,
  key text not null,
  cover_url text,
  audio_url text,
  video_url text,
  external_link text,
  youtube_link text,
  description text,
  genre text,
  location text,
  featured boolean default false,
  pinned boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- COMMUNITY POSTS
-- ------------------------------------------------------------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  category text default 'discussion',
  title text not null,
  content text,
  image_url text,
  audio_url text,
  video_url text,
  link text,
  featured boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- COMMENTS (polymorphic: post / release / beat)
-- ------------------------------------------------------------
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','release','beat')),
  target_id uuid not null,
  parent_comment_id uuid references comments(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- REACTIONS (polymorphic)
-- ------------------------------------------------------------
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','release','beat','comment')),
  target_id uuid not null,
  reaction_type text not null default 'like',
  created_at timestamptz default now(),
  unique (user_id, target_type, target_id, reaction_type)
);

-- ------------------------------------------------------------
-- COLLABORATION / CONTACT REQUESTS
-- ------------------------------------------------------------
create table if not exists collab_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'collab' check (kind in ('collab','contact')),
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- REPORTS
-- ------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  reason text,
  status text default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  message text not null,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- RESOURCES (Plugins / Presets / DAWs)
-- ------------------------------------------------------------
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('plugin','preset','daw','other')),
  name text not null,
  description text,
  version text,
  file_url text not null,
  preview_image_url text,
  external_link text,
  discord_gated boolean default true,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- CATEGORIES (nav / homepage control)
-- ------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  description text default '',
  icon text default '',
  enabled boolean default true,
  show_on_home boolean default true,
  show_in_menu boolean default true,
  requires_registration boolean default false,
  order_index int default 0
);

-- ------------------------------------------------------------
-- HOMEPAGE SECTIONS
-- ------------------------------------------------------------
create table if not exists homepage_sections (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  title text not null,
  description text default '',
  section_type text not null, -- 'featured' | 'latest_releases' | 'latest_beats' | 'registered' | 'community' | 'resources' | 'banner' | 'custom'
  enabled boolean default true,
  order_index int default 0,
  item_limit int default 6,
  show_on_mobile boolean default true,
  show_on_desktop boolean default true
);

-- ------------------------------------------------------------
-- SITE SETTINGS (single row)
-- ------------------------------------------------------------
create table if not exists site_settings (
  id int primary key default 1,
  site_name text default 'UNDERGROUND GEO',
  logo_url text,
  favicon_url text,
  discord_invite_link text default '',
  discord_guild_id text default '',
  registration_enabled boolean default true,
  max_upload_mb int default 50,
  homepage_hero_title text default 'UNDERGROUND GEO',
  homepage_hero_subtitle text default 'The home of the Georgian underground music scene.',
  constraint single_row check (id = 1)
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

-- Seed default categories
insert into categories (key, label, order_index, requires_registration) values
  ('featured','Featured',0,false),
  ('artists','Artists',1,false),
  ('producers','Producers',2,false),
  ('releases','Releases',3,false),
  ('beats','Beats',4,false),
  ('community','Community',5,true),
  ('plugins','Plugins',6,false),
  ('presets','Presets',7,false),
  ('daws','DAWs',8,false),
  ('discord','Discord',9,false)
on conflict (key) do nothing;

-- Seed default homepage sections
insert into homepage_sections (key, title, section_type, order_index) values
  ('hero','Welcome to UG','banner',0),
  ('featured','Featured','featured',1),
  ('latest_releases','Latest Releases','latest_releases',2),
  ('latest_beats','Latest Beats','latest_beats',3),
  ('registered','Registered Artists & Producers','registered',4),
  ('community','From the Community','community',5)
on conflict (key) do nothing;

-- Look up an email by username, for username-based login (security definer
-- so it can read auth.users without exposing the table itself)
create or replace function email_for_username(uname text) returns text as $$
  select u.email from auth.users u
  join profiles p on p.id = u.id
  where p.username = lower(uname)
  limit 1;
$$ language sql security definer;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table releases enable row level security;
alter table beats enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table reactions enable row level security;
alter table collab_requests enable row level security;
alter table reports enable row level security;
alter table notifications enable row level security;
alter table resources enable row level security;
alter table categories enable row level security;
alter table homepage_sections enable row level security;
alter table site_settings enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin() returns boolean as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$ language sql stable;

-- PROFILES: public read, owner or admin write
create policy "profiles are publicly readable" on profiles for select using (true);
create policy "users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "users can update their own profile" on profiles for update using (auth.uid() = id or is_admin());
create policy "admins can delete profiles" on profiles for delete using (is_admin());

-- RELEASES
create policy "releases publicly readable" on releases for select using (true);
create policy "artists insert own releases" on releases for insert with check (auth.uid() = artist_id);
create policy "owner or admin update releases" on releases for update using (auth.uid() = artist_id or is_admin());
create policy "owner or admin delete releases" on releases for delete using (auth.uid() = artist_id or is_admin());

-- BEATS
create policy "beats publicly readable" on beats for select using (true);
create policy "producers insert own beats" on beats for insert with check (auth.uid() = producer_id);
create policy "owner or admin update beats" on beats for update using (auth.uid() = producer_id or is_admin());
create policy "owner or admin delete beats" on beats for delete using (auth.uid() = producer_id or is_admin());

-- POSTS
create policy "posts publicly readable" on posts for select using (true);
create policy "users insert own posts" on posts for insert with check (auth.uid() = author_id);
create policy "owner or admin update posts" on posts for update using (auth.uid() = author_id or is_admin());
create policy "owner or admin delete posts" on posts for delete using (auth.uid() = author_id or is_admin());

-- COMMENTS
create policy "comments publicly readable" on comments for select using (true);
create policy "users insert own comments" on comments for insert with check (auth.uid() = author_id);
create policy "owner or admin update comments" on comments for update using (auth.uid() = author_id or is_admin());
create policy "owner or admin delete comments" on comments for delete using (auth.uid() = author_id or is_admin());

-- REACTIONS
create policy "reactions publicly readable" on reactions for select using (true);
create policy "users insert own reactions" on reactions for insert with check (auth.uid() = user_id);
create policy "owner delete own reactions" on reactions for delete using (auth.uid() = user_id or is_admin());

-- COLLAB REQUESTS (private to sender/receiver/admin)
create policy "participants read their requests" on collab_requests for select using (auth.uid() = sender_id or auth.uid() = receiver_id or is_admin());
create policy "users send requests" on collab_requests for insert with check (auth.uid() = sender_id);
create policy "receiver or admin updates status" on collab_requests for update using (auth.uid() = receiver_id or is_admin());

-- REPORTS
create policy "users create reports" on reports for insert with check (auth.uid() = reporter_id);
create policy "admins read reports" on reports for select using (is_admin());
create policy "admins update reports" on reports for update using (is_admin());

-- NOTIFICATIONS (private to owner)
create policy "users read own notifications" on notifications for select using (auth.uid() = user_id);
create policy "system inserts notifications" on notifications for insert with check (true);
create policy "users update own notifications" on notifications for update using (auth.uid() = user_id);

-- RESOURCES
create policy "resources publicly readable" on resources for select using (true);
create policy "admins manage resources" on resources for insert with check (is_admin());
create policy "admins update resources" on resources for update using (is_admin());
create policy "admins delete resources" on resources for delete using (is_admin());

-- CATEGORIES
create policy "categories publicly readable" on categories for select using (true);
create policy "admins manage categories" on categories for insert with check (is_admin());
create policy "admins update categories" on categories for update using (is_admin());
create policy "admins delete categories" on categories for delete using (is_admin());

-- HOMEPAGE SECTIONS
create policy "sections publicly readable" on homepage_sections for select using (true);
create policy "admins manage sections" on homepage_sections for insert with check (is_admin());
create policy "admins update sections" on homepage_sections for update using (is_admin());
create policy "admins delete sections" on homepage_sections for delete using (is_admin());

-- SITE SETTINGS
create policy "settings publicly readable" on site_settings for select using (true);
create policy "admins update settings" on site_settings for update using (is_admin());

-- ============================================================
-- STORAGE BUCKETS (run these in SQL editor too — creates buckets)
-- ============================================================
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('covers','covers', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('audio','audio', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('video','video', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('community','community', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('resources','resources', true) on conflict (id) do nothing;

-- Allow any logged-in user to upload to their own folder (path prefix = their user id), public read for all buckets above
create policy "public read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "public read covers" on storage.objects for select using (bucket_id = 'covers');
create policy "public read audio" on storage.objects for select using (bucket_id = 'audio');
create policy "public read video" on storage.objects for select using (bucket_id = 'video');
create policy "public read community" on storage.objects for select using (bucket_id = 'community');
create policy "public read resources" on storage.objects for select using (bucket_id = 'resources');

create policy "authenticated upload avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "authenticated upload covers" on storage.objects for insert with check (bucket_id = 'covers' and auth.role() = 'authenticated');
create policy "authenticated upload audio" on storage.objects for insert with check (bucket_id = 'audio' and auth.role() = 'authenticated');
create policy "authenticated upload video" on storage.objects for insert with check (bucket_id = 'video' and auth.role() = 'authenticated');
create policy "authenticated upload community" on storage.objects for insert with check (bucket_id = 'community' and auth.role() = 'authenticated');
create policy "admin upload resources" on storage.objects for insert with check (bucket_id = 'resources' and is_admin());

create policy "owner delete own files" on storage.objects for delete using (auth.uid()::text = (storage.foldername(name))[1] or is_admin());

-- ============================================================
-- Make yourself an admin AFTER you register your first account:
--   update profiles set is_admin = true where username = 'YOUR_USERNAME';
-- ============================================================
