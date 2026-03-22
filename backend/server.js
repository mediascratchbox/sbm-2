const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const path = require("path");

// Always load .env from the backend folder, regardless of cwd.
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in environment.");
  process.exit(1);
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Serve the built site so frontend and API share the same origin (local + production).
const staticRoot = path.join(__dirname, "..", "_site");
app.use(express.static(staticRoot));

const adminSessions = new Set();
const ADMIN_COOKIE = "sbm_admin";

function isAuthed(req) {
  const token = req.cookies[ADMIN_COOKIE];
  return token && adminSessions.has(token);
}

const submissionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["contact", "project"], required: true },
    data: { type: Object, required: true },
    page: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "SBM-SiteData" }
);

const Submission = mongoose.model("Submission", submissionSchema);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/adminAccess", (req, res) => {
  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(500).send("Admin credentials not configured.");
  }
  if (!isAuthed(req)) {
    return res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Admin Login</title>
<style>
body{font-family:Arial, sans-serif;background:#f7f5ef;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;}
.card{background:#fff;border:1px solid #eee;border-radius:16px;padding:28px;width:340px;box-shadow:0 10px 30px rgba(0,0,0,.08);}
input{width:100%;padding:12px 14px;margin:8px 0;border-radius:10px;border:1px solid #ddd;font-size:14px;}
button{width:100%;padding:12px;border:none;border-radius:10px;background:#0d0d0d;color:#fff;font-weight:700;}
.err{color:#b00020;font-size:12px;}
</style></head>
<body>
<div class="card">
  <h2>Admin Login</h2>
  <div class="err" id="err"></div>
  <input id="user" placeholder="Username"/>
  <input id="pass" type="password" placeholder="Password"/>
  <button onclick="login()">Login</button>
</div>
<script>
async function login(){
  const user = document.getElementById('user').value;
  const pass = document.getElementById('pass').value;
  const res = await fetch('/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,pass})});
  if(res.ok){ location.reload(); return; }
  document.getElementById('err').textContent = 'Invalid credentials';
}
</script>
</body></html>`);
  }
  return res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Admin Dashboard</title>
<style>
body{font-family:Arial, sans-serif;background:#f7f5ef;margin:0;padding:24px;}
h1{margin:0 0 12px;}
.table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;}
.table th,.table td{padding:12px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top;}
.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#0d0d0d;color:#fff;font-size:11px;}
.row{white-space:pre-wrap;word-break:break-word;}
</style></head>
<body>
<h1>Submissions</h1>
<table class="table" id="tbl">
  <thead><tr><th>Type</th><th>Created</th><th>Data</th></tr></thead>
  <tbody></tbody>
</table>
<script>
async function load(){
  const res = await fetch('/api/admin/submissions');
  if(!res.ok){ document.body.innerHTML='Unauthorized'; return; }
  const data = await res.json();
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = data.items.map(i => (
    '<tr>' +
      '<td><span class="pill">'+i.type+'</span></td>' +
      '<td>'+new Date(i.createdAt).toLocaleString()+'</td>' +
      '<td class="row">'+JSON.stringify(i.data, null, 2)+'</td>' +
    '</tr>'
  )).join('');
}
load();
</script>
</body></html>`);
});

app.post("/admin/login", (req, res) => {
  if (!ADMIN_USER || !ADMIN_PASS) return res.status(500).json({ ok: false });
  const { user, pass } = req.body || {};
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    const token = crypto.randomBytes(24).toString("hex");
    adminSessions.add(token);
    res.cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: "lax" });
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false });
});

app.get("/api/admin/submissions", async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false });
  const items = await Submission.find({}).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ ok: true, items });
});

app.post("/api/contact", async (req, res) => {
  try {
    const payload = {
      type: "contact",
      data: req.body || {},
      page: req.headers["x-page"] || "",
      userAgent: req.headers["user-agent"] || "",
    };
    await Submission.create(payload);
    res.json({ ok: true });
  } catch (err) {
    console.error("Contact submit error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/project", async (req, res) => {
  try {
    const payload = {
      type: "project",
      data: req.body || {},
      page: req.headers["x-page"] || "",
      userAgent: req.headers["user-agent"] || "",
    };
    await Submission.create(payload);
    res.json({ ok: true });
  } catch (err) {
    console.error("Project submit error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SBM backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });
