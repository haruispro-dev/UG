import express from "express";
import session from "express-session";
import multer from "multer";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(dataDir, {recursive:true});
fs.mkdirSync(uploadDir, {recursive:true});

const db = new Database(path.join(dataDir, "ug.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL, type TEXT NOT NULL, platform TEXT, platformLink TEXT, pfp TEXT,
 bio TEXT DEFAULT '', socials TEXT DEFAULT '{}', createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS posts(
 id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, title TEXT NOT NULL, body TEXT DEFAULT '',
 image TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS releases(
 id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, title TEXT NOT NULL, artist TEXT NOT NULL,
 cover TEXT, media TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS beats(
 id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, title TEXT NOT NULL, producer TEXT NOT NULL,
 bpm TEXT, keyName TEXT, cover TEXT, media TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS resources(
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL,
 description TEXT DEFAULT '', image TEXT, file TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
`);
const setDefault = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
setDefault.run("siteName","UNDERGROUND GEO");
setDefault.run("discordInvite",process.env.DISCORD_INVITE || "https://discord.gg/your-invite");
setDefault.run("heroText","The home of Georgian underground music.");

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
 secret: process.env.SESSION_SECRET || "ug-development-secret",
 resave:false, saveUninitialized:false,
 cookie:{httpOnly:true, sameSite:"lax", maxAge:1000*60*60*24*30}
}));
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname,"public")));

const storage = multer.diskStorage({
 destination: (_,__,cb)=>cb(null,uploadDir),
 filename: (_,file,cb)=>cb(null,Date.now()+"-"+file.originalname.replace(/[^a-zA-Z0-9._-]/g,"_"))
});
const upload = multer({storage});

function user(req){ return req.session.user || null; }
function requireLogin(req,res,next){ if(!user(req)) return res.status(401).json({error:"Login required"}); next(); }
function requireAdmin(req,res,next){
 const u=user(req);
 if(!u || u.type!=="admin") return res.status(403).json({error:"Admin access required"});
 next();
}
function safeUser(row){ if(!row) return null; const {password,...rest}=row; return {...rest, socials:JSON.parse(rest.socials||"{}")}; }
function settings(){
 return Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map(x=>[x.key,x.value]));
}
function platformAllowed(type, platform){
 const map={artist:["youtube","spotify","soundcloud"],producer:["beatstars","soundcloud","spotify","youtube"],member:[]};
 return map[type]?.includes(platform);
}
function adminSeed(){
 const email=process.env.ADMIN_EMAIL, password=process.env.ADMIN_PASSWORD;
 if(email && password){
   const exists=db.prepare("SELECT id FROM users WHERE email=?").get(email);
   if(!exists) db.prepare("INSERT INTO users(username,email,password,type) VALUES(?,?,?,'admin')").run("admin",email,password);
 }
}
adminSeed();

app.get("/api/bootstrap",(req,res)=>{
 res.json({user:safeUser(user(req)),settings:settings(),
 posts:db.prepare("SELECT posts.*,users.username,users.pfp FROM posts LEFT JOIN users ON users.id=posts.userId ORDER BY posts.id DESC").all(),
 releases:db.prepare("SELECT releases.*,users.username FROM releases LEFT JOIN users ON users.id=releases.userId ORDER BY releases.id DESC").all(),
 beats:db.prepare("SELECT beats.*,users.username FROM beats LEFT JOIN users ON users.id=beats.userId ORDER BY beats.id DESC").all(),
 resources:db.prepare("SELECT * FROM resources ORDER BY id DESC").all()});
});
app.post("/api/signup",(req,res)=>{
 const {username,email,password,type,platform,platformLink}=req.body;
 if(!username||!email||!password||!["artist","producer","member"].includes(type)) return res.status(400).json({error:"Complete the required fields"});
 if(type!=="member" && (!platform||!platformLink||!platformAllowed(type,platform))) return res.status(400).json({error:"Choose a valid platform and provide your profile link"});
 try{
  const result=db.prepare("INSERT INTO users(username,email,password,type,platform,platformLink) VALUES(?,?,?,?,?,?)").run(username,email,password,type,platform||null,platformLink||null);
  const row=db.prepare("SELECT * FROM users WHERE id=?").get(result.lastInsertRowid);
  req.session.user=safeUser(row); res.json({user:req.session.user});
 }catch(e){res.status(400).json({error:"Username or email already exists"});}
});
app.post("/api/login",(req,res)=>{
 const row=db.prepare("SELECT * FROM users WHERE (email=? OR username=?) AND password=?").get(req.body.login,req.body.login,req.body.password);
 if(!row) return res.status(401).json({error:"Invalid login"});
 req.session.user=safeUser(row); res.json({user:req.session.user});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.post("/api/profile",requireLogin,(req,res)=>{
 const u=user(req), {bio,socials,pfp,username}=req.body;
 db.prepare("UPDATE users SET username=?,bio=?,socials=?,pfp=? WHERE id=?").run(username||u.username,bio||"",JSON.stringify(socials||{}),pfp||null,u.id);
 req.session.user=safeUser(db.prepare("SELECT * FROM users WHERE id=?").get(u.id)); res.json({user:req.session.user});
});
app.post("/api/posts",requireLogin,upload.single("image"),(req,res)=>{
 const image=req.file?"/uploads/"+req.file.filename:null;
 db.prepare("INSERT INTO posts(userId,title,body,image) VALUES(?,?,?,?)").run(user(req).id,req.body.title,req.body.body||"",image); res.json({ok:true});
});
app.post("/api/releases",requireLogin,upload.single("cover"),(req,res)=>{
 const cover=req.file?"/uploads/"+req.file.filename:null;
 db.prepare("INSERT INTO releases(userId,title,artist,cover,media) VALUES(?,?,?,?,?)").run(user(req).id,req.body.title,req.body.artist,cover,req.body.media||""); res.json({ok:true});
});
app.post("/api/beats",requireLogin,upload.single("cover"),(req,res)=>{
 const cover=req.file?"/uploads/"+req.file.filename:null;
 db.prepare("INSERT INTO beats(userId,title,producer,bpm,keyName,cover,media) VALUES(?,?,?,?,?,?,?)").run(user(req).id,req.body.title,req.body.producer,req.body.bpm,req.body.keyName,cover,req.body.media||""); res.json({ok:true});
});
app.post("/api/resources",requireAdmin,upload.fields([{name:"file",maxCount:1},{name:"image",maxCount:1}]),(req,res)=>{
 const f=req.files?.file?.[0], i=req.files?.image?.[0];
 if(!f) return res.status(400).json({error:"A real resource file is required"});
 db.prepare("INSERT INTO resources(title,category,description,image,file) VALUES(?,?,?,?,?)").run(req.body.title,req.body.category,req.body.description||"",i?"/uploads/"+i.filename:null,"/uploads/"+f.filename);
 res.json({ok:true});
});
app.delete("/api/admin/:kind/:id",requireAdmin,(req,res)=>{
 const allowed={users:"users",posts:"posts",releases:"releases",beats:"beats",resources:"resources"};
 const table=allowed[req.params.kind]; if(!table) return res.status(400).json({error:"Invalid type"});
 db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id); res.json({ok:true});
});
app.post("/api/admin/settings",requireAdmin,(req,res)=>{
 for(const [key,value] of Object.entries(req.body)) db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,String(value));
 res.json({ok:true});
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`UG running on port ${PORT}`));
