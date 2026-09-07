
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@undergroundgeo.ge";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-now";

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "public", "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, "ug.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('artist','producer','member','admin')),
 display_name TEXT NOT NULL,
 bio TEXT DEFAULT '',
 avatar TEXT DEFAULT '',
 youtube TEXT DEFAULT '',
 instagram TEXT DEFAULT '',
 tiktok TEXT DEFAULT '',
 soundcloud TEXT DEFAULT '',
 spotify TEXT DEFAULT '',
 discord TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS releases (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 artist_name TEXT NOT NULL,
 cover TEXT NOT NULL,
 audio TEXT DEFAULT '',
 video TEXT DEFAULT '',
 external_link TEXT DEFAULT '',
 description TEXT DEFAULT '',
 category TEXT DEFAULT 'Releases',
 featured INTEGER DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 type TEXT DEFAULT 'discussion',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 body TEXT NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(post_id) REFERENCES posts(id),
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS reactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 kind TEXT DEFAULT 'like',
 UNIQUE(post_id,user_id,kind)
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT UNIQUE NOT NULL,
 sort_order INTEGER DEFAULT 0,
 enabled INTEGER DEFAULT 1
);
`);

const defaults = {
 discord_link: "https://discord.gg/jEcAXNzHuX",
 discord_message: "Free production resources, artists, producers, and real community discussions.",
 discord_enabled: "1",
 discord_categories: "Featured,Artists,Producers,Releases,Community",
 discord_position: "after-content",
 site_tagline: "Georgia's underground music community."
};
for (const [key,value] of Object.entries(defaults)) {
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run(key,value);
}
for (const [name, sort_order] of [["Featured",0],["Artists",1],["Producers",2],["Releases",3],["Community",4]]) {
  db.prepare("INSERT OR IGNORE INTO categories(name,sort_order) VALUES(?,?)").run(name,sort_order);
}

function ensureAdmin() {
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(ADMIN_EMAIL);
  if (!exists) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
    db.prepare(`INSERT INTO users(email,password,role,display_name,bio) VALUES(?,?,?,?,?)`)
      .run(ADMIN_EMAIL, hash, "admin", "UG Admin", "UNDERGROUND GEO administrator");
  }
}
ensureAdmin();

app.use(express.json({limit:"12mb"}));
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname,"public")));

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const upload = multer({storage, limits:{fileSize:100*1024*1024}});

function publicUser(u) {
  if (!u) return null;
  return {id:u.id,email:u.email,role:u.role,display_name:u.display_name,bio:u.bio,avatar:u.avatar,
    youtube:u.youtube,instagram:u.instagram,tiktok:u.tiktok,soundcloud:u.soundcloud,spotify:u.spotify,discord:u.discord};
}
function tokenFor(u) {
  return jwt.sign({id:u.id,role:u.role}, JWT_SECRET, {expiresIn:"7d"});
}
function auth(req,res,next) {
  try {
    const raw = req.cookies.ug_token || req.headers.authorization?.replace("Bearer ","");
    if (!raw) return res.status(401).json({error:"Login required"});
    req.user = jwt.verify(raw, JWT_SECRET);
    next();
  } catch { res.status(401).json({error:"Invalid or expired session"}); }
}
function admin(req,res,next) {
  if (req.user?.role !== "admin") return res.status(403).json({error:"Admin access required"});
  next();
}
function setting(key) { return db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value || ""; }
function safeFile(v) { return v ? `/uploads/${path.basename(v)}` : ""; }

app.get("/api/bootstrap", (req,res) => {
  const categories = db.prepare("SELECT * FROM categories WHERE enabled=1 ORDER BY sort_order,id").all();
  const users = db.prepare("SELECT id,display_name,role,bio,avatar,youtube,instagram,tiktok,soundcloud,spotify,discord FROM users WHERE role IN ('artist','producer') ORDER BY created_at DESC").all();
  const releases = db.prepare("SELECT r.*,u.display_name,u.avatar FROM releases r JOIN users u ON u.id=r.user_id ORDER BY r.featured DESC,r.created_at DESC").all();
  const posts = db.prepare(`SELECT p.*,u.display_name,u.avatar,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comments,
    (SELECT COUNT(*) FROM reactions x WHERE x.post_id=p.id) reactions
    FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC`).all();
  res.json({categories,users,releases,posts,settings:{discord_link:setting("discord_link"),discord_message:setting("discord_message"),discord_enabled:setting("discord_enabled"),discord_categories:setting("discord_categories"),discord_position:setting("discord_position"),site_tagline:setting("site_tagline")}});
});

app.post("/api/register", async (req,res) => {
  const {email,password,display_name,role,bio=""} = req.body;
  if (!email || !password || !display_name || !["artist","producer","member"].includes(role)) return res.status(400).json({error:"Complete all required fields"});
  if (password.length < 8) return res.status(400).json({error:"Password must be at least 8 characters"});
  try {
    const hash = await bcrypt.hash(password,12);
    const info = db.prepare(`INSERT INTO users(email,password,role,display_name,bio) VALUES(?,?,?,?,?)`).run(email.toLowerCase(),hash,role,display_name,bio);
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
    res.cookie("ug_token",tokenFor(u),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:7*24*3600*1000});
    res.json({user:publicUser(u)});
  } catch { res.status(409).json({error:"That email is already registered"}); }
});
app.post("/api/login", async (req,res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=?").get((req.body.email||"").toLowerCase());
  if (!u || !(await bcrypt.compare(req.body.password||"",u.password))) return res.status(401).json({error:"Incorrect email or password"});
  res.cookie("ug_token",tokenFor(u),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:7*24*3600*1000});
  res.json({user:publicUser(u)});
});
app.post("/api/logout",(req,res)=>{res.clearCookie("ug_token");res.json({ok:true})});
app.get("/api/me",auth,(req,res)=>res.json({user:publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id))}));

app.put("/api/profile",auth,upload.single("avatar"),(req,res)=>{
  const fields=["display_name","bio","youtube","instagram","tiktok","soundcloud","spotify","discord"];
  const values=fields.map(k=>req.body[k] ?? "");
  let avatar = req.body.avatar || "";
  if (req.file) avatar = `/uploads/${req.file.filename}`;
  db.prepare(`UPDATE users SET ${fields.map(k=>`${k}=?`).join(",")},avatar=? WHERE id=?`).run(...values,avatar,req.user.id);
  res.json({user:publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id))});
});

app.post("/api/releases",auth,upload.fields([{name:"cover",maxCount:1},{name:"audio",maxCount:1},{name:"video",maxCount:1}]),(req,res)=>{
  if (!["artist","producer","admin"].includes(req.user.role)) return res.status(403).json({error:"Only artists and producers can publish"});
  const f=req.files||{};
  const cover=f.cover?.[0] ? `/uploads/${f.cover[0].filename}` : req.body.cover_url;
  if (!req.body.title || !req.body.artist_name || !cover) return res.status(400).json({error:"Title, artist name, and cover are required"});
  const info=db.prepare(`INSERT INTO releases(user_id,title,artist_name,cover,audio,video,external_link,description) VALUES(?,?,?,?,?,?,?,?)`)
    .run(req.user.id,req.body.title,req.body.artist_name,cover,f.audio?.[0]?`/uploads/${f.audio[0].filename}`:(req.body.audio_url||""),f.video?.[0]?`/uploads/${f.video[0].filename}`:(req.body.video_url||""),req.body.external_link||"",req.body.description||"");
  res.json({id:info.lastInsertRowid});
});
app.delete("/api/releases/:id",auth,(req,res)=>{
  const r=db.prepare("SELECT * FROM releases WHERE id=?").get(req.params.id);
  if (!r || (r.user_id!==req.user.id && req.user.role!=="admin")) return res.status(403).json({error:"Not allowed"});
  db.prepare("DELETE FROM releases WHERE id=?").run(req.params.id); res.json({ok:true});
});

app.post("/api/posts",auth,(req,res)=>{
  if (!req.body.title || !req.body.body) return res.status(400).json({error:"Title and body are required"});
  const i=db.prepare("INSERT INTO posts(user_id,title,body,type) VALUES(?,?,?,?)").run(req.user.id,req.body.title,req.body.body,req.body.type||"discussion");
  res.json({id:i.lastInsertRowid});
});
app.post("/api/posts/:id/comments",auth,(req,res)=>{
  if (!req.body.body) return res.status(400).json({error:"Comment cannot be empty"});
  db.prepare("INSERT INTO comments(post_id,user_id,body) VALUES(?,?,?)").run(req.params.id,req.user.id,req.body.body); res.json({ok:true});
});
app.post("/api/posts/:id/react",auth,(req,res)=>{
  try { db.prepare("INSERT INTO reactions(post_id,user_id,kind) VALUES(?,?,?)").run(req.params.id,req.user.id,"like"); }
  catch { db.prepare("DELETE FROM reactions WHERE post_id=? AND user_id=? AND kind='like'").run(req.params.id,req.user.id); }
  res.json({ok:true});
});
app.get("/api/posts/:id/comments",(req,res)=>res.json(db.prepare(`SELECT c.*,u.display_name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.created_at`).all(req.params.id)));

app.get("/api/admin/overview",auth,admin,(req,res)=>{
  res.json({
    users:db.prepare("SELECT id,email,display_name,role,created_at FROM users ORDER BY created_at DESC").all(),
    categories:db.prepare("SELECT * FROM categories ORDER BY sort_order,id").all(),
    settings:{discord_link:setting("discord_link"),discord_message:setting("discord_message"),discord_enabled:setting("discord_enabled"),discord_categories:setting("discord_categories"),discord_position:setting("discord_position"),site_tagline:setting("site_tagline")}
  });
});
app.put("/api/admin/settings",auth,admin,(req,res)=>{
  for (const k of ["discord_link","discord_message","discord_enabled","discord_categories","discord_position","site_tagline"]) {
    if (req.body[k] !== undefined) db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k,String(req.body[k]));
  }
  res.json({ok:true});
});
app.post("/api/admin/categories",auth,admin,(req,res)=>{
  if (!req.body.name) return res.status(400).json({error:"Name required"});
  try { db.prepare("INSERT INTO categories(name,sort_order) VALUES(?,?)").run(req.body.name,req.body.sort_order||0); res.json({ok:true}); }
  catch { res.status(409).json({error:"Category already exists"}); }
});
app.put("/api/admin/categories/:id",auth,admin,(req,res)=>{
  db.prepare("UPDATE categories SET name=?,sort_order=?,enabled=? WHERE id=?").run(req.body.name,req.body.sort_order||0,req.body.enabled?1:0,req.params.id); res.json({ok:true});
});
app.delete("/api/admin/categories/:id",auth,admin,(req,res)=>{db.prepare("DELETE FROM categories WHERE id=?").run(req.params.id);res.json({ok:true})});
app.put("/api/admin/users/:id",auth,admin,(req,res)=>{
  db.prepare("UPDATE users SET display_name=?,role=?,bio=? WHERE id=?").run(req.body.display_name,req.body.role,req.body.bio||"",req.params.id);res.json({ok:true});
});
app.delete("/api/admin/users/:id",auth,admin,(req,res)=>{if(Number(req.params.id)!==req.user.id) db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);res.json({ok:true})});
app.put("/api/admin/releases/:id/feature",auth,admin,(req,res)=>{db.prepare("UPDATE releases SET featured=? WHERE id=?").run(req.body.featured?1:0,req.params.id);res.json({ok:true})});
app.delete("/api/admin/posts/:id",auth,admin,(req,res)=>{db.prepare("DELETE FROM posts WHERE id=?").run(req.params.id);res.json({ok:true})});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`UG running on http://localhost:${PORT}`));
