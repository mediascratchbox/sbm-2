const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
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
app.use(compression({ threshold: 1024 }));

// Serve the built site so frontend and API share the same origin (local + production).
const staticRoot = path.join(__dirname, "..", "_site");
app.use(
  express.static(staticRoot, {
    maxAge: "7d",
    etag: true,
    setHeaders: (res, filePath) => {
      if (/\.(?:css|js|webp|png|jpg|jpeg|svg|mp4|webm)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      }
    },
  })
);

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
    crm: {
      status: { type: String, default: "new" },
      owner: { type: String, default: "" },
      followUpAt: { type: Date, default: null },
      opportunityValue: { type: Number, default: null },
      lostReason: { type: String, default: "" },
      notes: [{ body: String, createdAt: { type: Date, default: Date.now } }],
      updatedAt: { type: Date, default: Date.now },
    },
    page: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "SBM-SiteData" }
);

const Submission = mongoose.model("Submission", submissionSchema);
const CRM_STATUSES = ["new", "qualified", "discovery-booked", "proposal", "negotiation", "won", "lost", "nurture"];

const GROWTH_PLAN_REQUIRED_FIELDS = ["name", "email", "company", "role", "industry", "objective", "annual_revenue", "timeline"];

function cleanText(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanAttribution(value) {
  const attribution = value && typeof value === "object" ? value : {};
  const cleanTouch = (touch) => {
    const source = touch && typeof touch === "object" ? touch : {};
    return {
      utm_source: cleanText(source.utm_source, 120),
      utm_medium: cleanText(source.utm_medium, 120),
      utm_campaign: cleanText(source.utm_campaign, 180),
      utm_content: cleanText(source.utm_content, 180),
      utm_term: cleanText(source.utm_term, 180),
      gclid: cleanText(source.gclid, 500),
      fbclid: cleanText(source.fbclid, 500),
      li_fat_id: cleanText(source.li_fat_id, 500),
      landing_page: cleanText(source.landing_page, 1000),
      referrer: cleanText(source.referrer, 1000),
      captured_at: cleanText(source.captured_at, 50),
    };
  };
  return {
    first_touch: cleanTouch(attribution.first_touch),
    latest_touch: cleanTouch(attribution.latest_touch),
    latest_page: cleanText(attribution.latest_page, 1000),
    form_page: cleanText(attribution.form_page, 1000),
  };
}

function scoreGrowthPlan(data) {
  let score = 0;
  const reasons = [];
  const projectBudget = cleanText(data.project_budget, 40);
  const retainerBudget = cleanText(data.retainer_budget, 40);
  const revenue = cleanText(data.annual_revenue, 40);
  const timeline = cleanText(data.timeline, 40);
  const role = cleanText(data.role, 40);
  const industry = cleanText(data.industry, 40);
  const message = cleanText(data.message, 3000);

  if (["3-5l", "5-10l", "10l-plus", "2-3l", "3-5l", "5l-plus"].includes(projectBudget) || ["2-3l", "3-5l", "5l-plus"].includes(retainerBudget)) { score += 5; reasons.push("investment"); }
  if (["5-25cr", "25-100cr", "100cr-plus"].includes(revenue)) { score += 5; reasons.push("company-size"); }
  if (["immediately", "within-30-days"].includes(timeline)) { score += 5; reasons.push("urgency"); }
  if (message.length >= 80) { score += 5; reasons.push("problem-context"); }
  if (["Founder", "CEO", "CMO", "Marketing Head", "Growth Head"].includes(role)) { score += 5; reasons.push("decision-maker"); }
  if (["saas", "d2c", "healthcare", "b2b", "growing-business"].includes(industry)) { score += 5; reasons.push("icp-fit"); }

  return { score, reasons, priority: score >= 24 ? "sales-priority" : score >= 18 ? "sales-nurture" : "nurture" };
}

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

function normaliseCrm(crm = {}) {
  return {
    status: CRM_STATUSES.includes(crm.status) ? crm.status : "new",
    owner: cleanText(crm.owner, 120),
    followUpAt: crm.followUpAt || null,
    opportunityValue: Number.isFinite(crm.opportunityValue) ? crm.opportunityValue : null,
    lostReason: cleanText(crm.lostReason, 500),
    notes: Array.isArray(crm.notes) ? crm.notes : [],
    updatedAt: crm.updatedAt || null,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

app.get("/api/admin/leads", async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false });
  const filters = { type: { $in: ["contact", "project"] } };
  const status = cleanText(req.query.status, 40);
  const source = cleanText(req.query.source, 120);
  const priority = cleanText(req.query.priority, 40);
  const search = cleanText(req.query.search, 120);
  if (status && status !== "all" && CRM_STATUSES.includes(status)) filters["crm.status"] = status;
  if (source && source !== "all") filters["data.source"] = source;
  if (priority && priority !== "all") filters["data.lead_score.priority"] = priority;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filters.$or = [{ "data.name": pattern }, { "data.email": pattern }, { "data.company": pattern }];
  }
  const items = await Submission.find(filters).sort({ createdAt: -1 }).limit(500).lean();
  const leads = items.map((item) => ({ ...item, crm: normaliseCrm(item.crm) }));
  const stats = leads.reduce((result, lead) => {
    result.total += 1;
    if (lead.crm.status === "new") result.new += 1;
    if (["qualified", "discovery-booked", "proposal", "negotiation"].includes(lead.crm.status)) result.active += 1;
    if (lead.crm.status === "won") result.won += 1;
    if (lead.data?.lead_score?.priority === "sales-priority") result.priority += 1;
    return result;
  }, { total: 0, new: 0, active: 0, won: 0, priority: 0 });
  res.json({ ok: true, items: leads, stats, statuses: CRM_STATUSES });
});

app.patch("/api/admin/leads/:id", async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false });
  const updates = req.body || {};
  const existing = await Submission.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: "Lead not found" });
  const crm = normaliseCrm(existing.crm?.toObject?.() || existing.crm || {});
  if (CRM_STATUSES.includes(updates.status)) crm.status = updates.status;
  if (typeof updates.owner === "string") crm.owner = cleanText(updates.owner, 120);
  if (typeof updates.lostReason === "string") crm.lostReason = cleanText(updates.lostReason, 500);
  if (updates.followUpAt === "") crm.followUpAt = null;
  else if (typeof updates.followUpAt === "string" && !Number.isNaN(Date.parse(updates.followUpAt))) crm.followUpAt = new Date(updates.followUpAt);
  if (updates.opportunityValue === "") crm.opportunityValue = null;
  else if (Number.isFinite(Number(updates.opportunityValue)) && Number(updates.opportunityValue) >= 0) crm.opportunityValue = Number(updates.opportunityValue);
  const note = cleanText(updates.note, 3000);
  if (note) crm.notes.push({ body: note, createdAt: new Date() });
  crm.updatedAt = new Date();
  existing.crm = crm;
  await existing.save();
  res.json({ ok: true, item: { ...existing.toObject(), crm: normaliseCrm(existing.crm.toObject?.() || existing.crm) } });
});

app.post("/api/contact", async (req, res) => {
  try {
    const data = req.body || {};
    const isGrowthPlan = req.get("x-lead-form") === "growth-plan";
    if (!isGrowthPlan) return res.status(400).json({ ok: false, error: "Outdated form. Please refresh the page and submit the Growth Plan form again." });
    const missing = GROWTH_PLAN_REQUIRED_FIELDS.filter((field) => !cleanText(data[field], 200));
    if (missing.length) return res.status(400).json({ ok: false, error: "Missing required fields" });
    if (!/^\S+@\S+\.\S+$/.test(cleanText(data.email, 254))) return res.status(400).json({ ok: false, error: "Invalid email" });
    data.name = cleanText(data.name, 120);
    data.email = cleanText(data.email, 254);
    data.company = cleanText(data.company, 160);
    data.website = cleanText(data.website, 300);
    data.phone = cleanText(data.phone, 50);
    data.message = cleanText(data.message, 3000);
    data.source = cleanText(data.source, 120);
    data.landing_page = cleanText(data.landing_page, 1000);
    data.attribution = cleanAttribution(data.attribution);
    data.lead_score = scoreGrowthPlan(data);
    const payload = {
      type: "contact",
      data,
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
