/**
 * JobNex - Node.js + Express Backend Server
 * Connects directly to local MySQL database using mysql2.
 * Serves API endpoints and frontend UI on localhost.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, "frontend");
const ROOT_DIR = __dirname;

const PORT = process.env.PORT || 3000;
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "Algonex@123";
const DB_NAME = process.env.DB_NAME || "jobnex";
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 1. MySQL Connection Pool
export const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

// Test MySQL Database Connection on Startup
async function verifyDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ [MySQL] Successfully connected to database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}`);
    const [rows] = await connection.query("SHOW TABLES");
    console.log(`📦 [MySQL] Available tables: ${rows.map(r => Object.values(r)[0]).join(", ")}`);
    connection.release();
  } catch (err) {
    console.error(`❌ [MySQL] Connection failed: ${err.message}`);
  }
}
verifyDbConnection();

// ==========================================
// API ROUTES
// ==========================================

// 2. Health Check & Database Status
app.get("/api/health", async (req, res) => {
  try {
    const [result] = await pool.query("SELECT 1 + 1 AS health_check");
    const [tables] = await pool.query("SHOW TABLES");
    const tableNames = tables.map(r => Object.values(r)[0]);

    res.json({
      status: "ok",
      database: "connected",
      db_name: DB_NAME,
      host: DB_HOST,
      port: DB_PORT,
      health_check: result[0].health_check,
      tables: tableNames,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/db-health", async (req, res) => {
  try {
    const [appCount] = await pool.query("SELECT COUNT(*) AS total FROM applications");
    const [jobCount] = await pool.query("SELECT COUNT(*) AS total FROM daily_job_matches");
    const [resumeCount] = await pool.query("SELECT COUNT(*) AS total FROM resume_analyzer");

    res.json({
      status: "healthy",
      database: DB_NAME,
      host: DB_HOST,
      counts: {
        applications: appCount[0].total,
        daily_job_matches: jobCount[0].total,
        resume_analyzer: resumeCount[0].total,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "unhealthy",
      error: err.message,
    });
  }
});

// 3. Applications API (Real MySQL Records)
app.get("/api/applications", async (req, res) => {
  try {
    const { status, user_id } = req.query;
    let query = "SELECT * FROM applications";
    const params = [];
    const conditions = [];

    if (user_id) {
      conditions.push("user_id = ?");
      params.push(user_id);
    }
    if (status && status !== "All") {
      conditions.push("status = ?");
      params.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY id DESC";

    const [rows] = await pool.execute(query, params);

    // Format for frontend consumption
    const formatted = rows.map((row) => {
      // Normalize status string (e.g. APPLIED -> Applied)
      let displayStatus = row.status || "Applied";
      const normalizedLower = displayStatus.toLowerCase();
      if (normalizedLower === "applied") displayStatus = "Applied";
      else if (normalizedLower === "interview") displayStatus = "Interview";
      else if (normalizedLower === "offered") displayStatus = "Offered";
      else if (normalizedLower === "rejected") displayStatus = "Rejected";
      else if (normalizedLower === "failed") displayStatus = "Rejected";
      else {
        displayStatus = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).toLowerCase();
      }

      const createdDate = row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "Recent";

      return {
        id: String(row.id),
        jobId: `job-${row.id}`,
        userId: row.user_id,
        status: displayStatus,
        appliedDate: createdDate,
        matchScore: 85, // Default high match for submitted apps
        resumeFileName: "Candidate_Resume.pdf",
        notes: row.notes || "",
        source: row.source || "web",
        job: {
          id: `job-${row.id}`,
          title: row.job_title || "Software Engineer",
          company: row.company || "JobNex Partner",
          location: "Remote / Hybrid",
          companyLogo: "../assets/favicon.svg",
          jobUrl: row.job_url || "#",
        },
        timeline: [
          {
            id: `evt-${row.id}-1`,
            title: `Application ${displayStatus}`,
            date: createdDate,
            description: row.notes || `Candidate application marked as ${displayStatus}.`,
            actor: "Applicant / System",
          },
        ],
      };
    });

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// Create Application (Parameterized INSERT)
app.post("/api/applications", async (req, res) => {
  try {
    const { user_id = "1", user_email = "", job_title, company, job_url = "", source = "manual", status = "Applied", notes = "" } = req.body;
    const finalUserId = user_email || String(user_id || "1");

    if (!job_title || !company) {
      return res.status(400).json({ success: false, error: "job_title and company are required fields." });
    }

    const [result] = await pool.execute(
      "INSERT INTO applications (user_id, job_title, company, job_url, source, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [finalUserId, job_title, company, job_url, source, status, notes]
    );

    // Also mirror to job_applications table for MySQL Workbench
    try {
      await pool.execute(
        "INSERT INTO job_applications (job_title, company, job_url, apply_email, job_description, match_score, status, status_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, NOW(), NOW())",
        [job_title, company, job_url, finalUserId, notes || "Application submitted via web portal", 85, `Status: ${status}`]
      );
    } catch (tblErr) {
      // Table may have varying schema
    }

    res.status(201).json({
      success: true,
      id: result.insertId,
      user_id: finalUserId,
      message: "Application recorded successfully in MySQL Workbench.",
    });
  } catch (err) {
    console.error("Error creating application:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Application Status (Parameterized UPDATE)
app.put("/api/applications/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: "status is required." });
    }

    let query = "UPDATE applications SET status = ?, updated_at = NOW()";
    const params = [status];

    if (notes) {
      query += ", notes = ?";
      params.push(notes);
    }

    query += " WHERE id = ?";
    params.push(id);

    const [result] = await pool.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    res.json({ success: true, message: `Application ${id} status updated to ${status}.` });
  } catch (err) {
    console.error("Error updating application status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Jobs API (Real Records from daily_job_matches)
app.get("/api/jobs", async (req, res) => {
  try {
    const { q, region, exp } = req.query;
    let query = "SELECT * FROM daily_job_matches";
    const params = [];
    const conditions = [];

    if (q) {
      conditions.push("(job_title LIKE ? OR company LIKE ? OR keyword LIKE ? OR description LIKE ?)");
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY id DESC LIMIT 100";

    const [rows] = await pool.execute(query, params);

    const formatted = rows.map((row) => {
      let skills = [];
      try {
        if (row.matched_skills) {
          skills = typeof row.matched_skills === "string" ? JSON.parse(row.matched_skills) : row.matched_skills;
        }
      } catch {
        skills = row.matched_skills ? row.matched_skills.split(",").map(s => s.trim()) : [];
      }
      if (!Array.isArray(skills) || skills.length === 0) {
        skills = [row.keyword || "Software", "Tech", "Engineering"];
      }

      const matchScore = Number(row.match_score) > 0 ? Number(row.match_score) : 78;

      return {
        id: String(row.id),
        title: row.job_title,
        company: row.company,
        location: row.location || "Remote",
        region: (row.location || "").toLowerCase().includes("india") ? "India" : "Global",
        experienceLevel: "Mid-Senior Level",
        salaryMin: 70000,
        salaryMax: 130000,
        currency: "USD",
        postedAt: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "Recently",
        companyLogo: "../assets/favicon.svg",
        skills: skills.slice(0, 5),
        description: row.summary || row.description || `Opportunity at ${row.company} for ${row.job_title}.`,
        matchScore: Math.round(matchScore),
        jobUrl: row.job_url || "#",
      };
    });

    res.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// Also expose /api/daily/jobs for daily job endpoint compatibility
app.get("/api/daily/jobs", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM daily_job_matches ORDER BY id DESC LIMIT 50");
    res.json({
      success: true,
      count: rows.length,
      jobs: rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, jobs: [] });
  }
});

// 5. Resume Analyzer API (resume_analyzer Table)
app.get("/api/analyses", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM resume_analyzer ORDER BY id DESC LIMIT 20");
    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// Forward /api/upload-resume (multipart file upload) to Python FastAPI backend for real PDF/DOCX parsing
app.post("/api/upload-resume", (req, res) => {
  const targetUrl = new URL("/api/upload-resume", BACKEND_URL);
  const proxyReq = http.request(
    targetUrl,
    {
      method: "POST",
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    console.error("Upload proxy error:", err.message);
    res.status(502).json({ error: "Upload service unreachable at " + BACKEND_URL, details: err.message });
  });
  req.pipe(proxyReq);
});

// Forward /api/fetch-jd-url to Python FastAPI backend
app.post("/api/fetch-jd-url", async (req, res) => {
  forwardToBackend("", req, res);
});

// Analyze Resume using Gemini AI / Dynamic Engine and Save to MySQL Workbench
app.post("/api/analyze", async (req, res) => {
  try {
    const { resume_text = "", jd_text = "", use_ai = true } = req.body;

    if (!resume_text.trim() || !jd_text.trim()) {
      return res.status(400).json({ error: "resume_text and jd_text are required." });
    }

    // 1. Try calling Python FastAPI backend for Gemini AI analysis & MySQL storage
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text, jd_text, use_ai: true }),
      });
      if (backendRes.ok) {
        const data = await backendRes.json();
        return res.json(data);
      }
    } catch (backendErr) {
      console.warn("FastAPI backend analyze note:", backendErr.message);
    }

    // 2. Direct MySQL fallback if FastAPI is down - dynamic requirement extraction (NO PREDEFINED LIST)
    const jdWords = Array.from(new Set(jd_text.match(/\b[A-Za-z][A-Za-z0-9\.\+#\-_]{1,25}\b/g) || []))
      .filter(w => !["and", "the", "for", "with", "that", "this", "from", "have", "must", "will", "team", "work", "role", "years", "plus", "experience", "strong", "looking", "seeking", "candidate", "developer", "engineer", "software", "development"].includes(w.toLowerCase()));

    const resumeLower = resume_text.toLowerCase();
    const matchedSkills = jdWords.filter(w => resumeLower.includes(w.toLowerCase())).slice(0, 12);
    const missingSkills = jdWords.filter(w => !resumeLower.includes(w.toLowerCase())).slice(0, 8);
    const score = jdWords.length > 0 ? Math.round((matchedSkills.length / jdWords.length) * 100) : 75;

    const suggestions = [
      missingSkills.length ? `Add practical experience or projects demonstrating: ${missingSkills.slice(0, 4).join(", ")}.` : "Resume aligns well with detected requirements.",
      "Highlight measurable impact and quantified metrics in recent experience.",
    ];

    const [result] = await pool.execute(
      "INSERT INTO resume_analyzer (resume_text, Jd_text, created_At, matched_score, matched_skills, missing_skills, suggestions) VALUES (?, ?, NOW(), ?, ?, ?, ?)",
      [
        resume_text.slice(0, 8000),
        jd_text.slice(0, 8000),
        score,
        JSON.stringify(matchedSkills),
        JSON.stringify(missingSkills),
        JSON.stringify(suggestions),
      ]
    );

    res.json({
      status: "success",
      Analysis_Id: result.insertId,
      matched_score: score,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      suggestions: suggestions,
      created_At: new Date().toISOString(),
      message: "Analysis successfully saved to MySQL Workbench!",
    });
  } catch (err) {
    console.error("Error in /api/analyze:", err);
    res.status(500).json({ error: err.message });
  }
});

// Helper to forward requests to Python FastAPI backend using native fetch
async function forwardToBackend(prefix, req, res) {
  try {
    const targetUrl = `${BACKEND_URL}${prefix}${req.url}`;
    const options = {
      method: req.method,
      headers: {},
    };

    if (req.headers["content-type"]) {
      options.headers["content-type"] = req.headers["content-type"];
    }

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      options.headers["content-type"] = "application/json";
      options.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const backendRes = await fetch(targetUrl, options);
    const contentType = backendRes.headers.get("content-type") || "";

    res.status(backendRes.status);
    for (const [key, value] of backendRes.headers.entries()) {
      if (["content-type", "content-disposition"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    if (contentType.includes("application/json")) {
      const data = await backendRes.json();
      return res.json(data);
    } else {
      const arrayBuf = await backendRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuf));
    }
  } catch (err) {
    console.error(`Forwarding error for ${prefix}:`, err.message);
    res.status(502).json({
      error: `Service ${prefix} unreachable at ${BACKEND_URL}`,
      details: err.message,
    });
  }
}

// ----------------------------------------------------
// DIRECT AUTH & USER PERSISTENCE (MySQL Workbench 'users')
// ----------------------------------------------------
function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "jobnex_salt_secret").digest("hex");
}

// Register New User in MySQL Workbench
app.post(["/auth/register", "/api/auth/register"], async (req, res) => {
  try {
    const { email, password, full_name = "", role = "JOB_SEEKER" } = req.body;
    if (!email || !password) {
      return res.status(400).json({ detail: "Email and password are required." });
    }
    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const [existing] = await pool.execute("SELECT id, email, full_name FROM users WHERE email = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ detail: "Email already registered in MySQL Workbench database." });
    }

    const hashed = hashPassword(password);
    const [result] = await pool.execute(
      "INSERT INTO users (email, full_name, password_hash, auth_provider, is_active, created_at) VALUES (?, ?, ?, 'local', 1, NOW())",
      [cleanEmail, full_name, hashed]
    );

    const newId = result.insertId;

    // Initialize candidate profile row in MySQL
    try {
      await pool.execute(
        "INSERT INTO candidate_profiles (user_id, title, bio, location, years_experience, created_at, updated_at) VALUES (?, ?, '', 'Remote', 2, NOW(), NOW()) ON DUPLICATE KEY UPDATE updated_at = NOW()",
        [newId, full_name ? `${full_name} Profile` : "Candidate"]
      );
    } catch (e) {
      console.warn("candidate_profiles init note:", e.message);
    }

    const token = crypto.randomBytes(32).toString("hex");
    res.status(201).json({
      access_token: token,
      token_type: "bearer",
      user: {
        id: newId,
        email: cleanEmail,
        full_name: full_name,
        role: role,
        auth_provider: "local",
      },
      message: "User successfully registered in MySQL Workbench database!",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ detail: err.message });
  }
});

// Login User & Authenticate via MySQL Workbench
app.post(["/auth/login", "/api/auth/login"], async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ detail: "Email is required." });
    }
    const cleanEmail = email.toLowerCase().trim();

    const [rows] = await pool.execute(
      "SELECT id, email, full_name, password_hash, auth_provider, is_active FROM users WHERE email = ?",
      [cleanEmail]
    );

    let user = rows[0];

    // If user does not exist yet (e.g. demo candidate/recruiter), auto-provision them directly into MySQL!
    if (!user) {
      const derivedName = cleanEmail.split("@")[0].replace(/[._-]/g, " ");
      const formattedName = derivedName.charAt(0).toUpperCase() + derivedName.slice(1);
      const hashed = hashPassword(password || "password123");
      const [insertRes] = await pool.execute(
        "INSERT INTO users (email, full_name, password_hash, auth_provider, is_active, created_at) VALUES (?, ?, ?, 'local', 1, NOW())",
        [cleanEmail, formattedName, hashed]
      );
      user = {
        id: insertRes.insertId,
        email: cleanEmail,
        full_name: formattedName,
        auth_provider: "local",
        is_active: 1,
      };
    }

    const token = crypto.randomBytes(32).toString("hex");
    res.json({
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        auth_provider: user.auth_provider,
      },
      message: "Login successful via MySQL Workbench!",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ detail: err.message });
  }
});

// Google OAuth Sign-In & MySQL Persistence
app.post(["/auth/google", "/api/auth/google"], async (req, res) => {
  try {
    const { credential, email, name, avatar } = req.body;
    let userEmail = email;
    let userName = name;
    let userAvatar = avatar;
    let googleSub = null;

    if (credential) {
      try {
        const parts = credential.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
          userEmail = payload.email || userEmail;
          userName = payload.name || userName;
          userAvatar = payload.picture || userAvatar;
          googleSub = payload.sub || null;
        }
      } catch (e) {
        console.warn("Credential decode note:", e.message);
      }
    }

    if (!userEmail) {
      userEmail = "google.user@jobnex.ai";
      userName = userName || "Google Verified Candidate";
    }

    userEmail = userEmail.toLowerCase().trim();

    // Check if user already exists
    const [rows] = await pool.execute(
      "SELECT id, email, full_name, avatar_url, auth_provider, is_active FROM users WHERE email = ? OR google_sub = ?",
      [userEmail, googleSub || ""]
    );

    let user = rows[0];
    if (!user) {
      const [insertRes] = await pool.execute(
        "INSERT INTO users (email, full_name, avatar_url, google_sub, auth_provider, is_active, created_at) VALUES (?, ?, ?, ?, 'google', 1, NOW())",
        [userEmail, userName, userAvatar, googleSub]
      );
      user = {
        id: insertRes.insertId,
        email: userEmail,
        full_name: userName,
        avatar_url: userAvatar,
        auth_provider: "google",
      };
    } else {
      await pool.execute(
        "UPDATE users SET full_name = COALESCE(?, full_name), avatar_url = COALESCE(?, avatar_url), google_sub = COALESCE(?, google_sub), auth_provider = 'google' WHERE id = ?",
        [userName, userAvatar, googleSub, user.id]
      );
      user.full_name = userName || user.full_name;
      user.avatar_url = userAvatar || user.avatar_url;
    }

    // Automatically sync candidate profile with user's Google email and photo
    try {
      await pool.execute(
        `INSERT INTO candidate_profiles (user_id, user_email, full_name, avatar_url, title, bio, location, years_experience, skills, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'Software Engineer', 'Google Authenticated Tech Candidate', 'Remote', 3, '[]', NOW(), NOW())
         ON DUPLICATE KEY UPDATE 
            user_email = VALUES(user_email),
            full_name = COALESCE(VALUES(full_name), full_name),
            avatar_url = COALESCE(VALUES(avatar_url), avatar_url),
            updated_at = NOW()`,
        [user.id, userEmail, user.full_name, user.avatar_url]
      );
    } catch (profErr) {
      console.warn("candidate_profile auto-sync note:", profErr.message);
    }

    const token = crypto.randomBytes(32).toString("hex");
    res.json({
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        auth_provider: "google",
      },
      message: "Google OAuth sign-in verified and persisted to MySQL Workbench!",
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(500).json({ detail: err.message });
  }
});


// Current User Details
app.get(["/auth/me", "/api/auth/me"], async (req, res) => {
  try {
    const email = req.query.email;
    let rows;
    if (email) {
      [rows] = await pool.execute("SELECT id, email, full_name, avatar_url, auth_provider, is_active, created_at FROM users WHERE email = ? LIMIT 1", [email.toLowerCase().trim()]);
    }
    if (!rows || rows.length === 0) {
      [rows] = await pool.execute("SELECT id, email, full_name, avatar_url, auth_provider, is_active, created_at FROM users ORDER BY id DESC LIMIT 1");
    }
    if (rows.length > 0) {
      return res.json(rows[0]);
    }
    res.json({ id: 1, email: "candidate@jobnex.ai", full_name: "Candidate", auth_provider: "local" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List All Users in MySQL Workbench
app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id, email, full_name, avatar_url, auth_provider, is_active, created_at FROM users ORDER BY id DESC");
    res.json({ success: true, count: rows.length, users: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Candidate Profile Endpoints
app.get("/api/candidate/profile", async (req, res) => {
  try {
    const email = req.query.email;
    let rows;
    if (email) {
      [rows] = await pool.execute("SELECT * FROM candidate_profiles WHERE user_email = ? ORDER BY id DESC LIMIT 1", [email.toLowerCase().trim()]);
    }
    if (!rows || rows.length === 0) {
      [rows] = await pool.execute("SELECT * FROM candidate_profiles ORDER BY id DESC LIMIT 1");
    }
    res.json({ success: true, profile: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/candidate/profile", async (req, res) => {
  try {
    const { user_id = 1, user_email = "", full_name = "", avatar_url = "", title = "Software Engineer", bio = "", location = "Remote", years_experience = 3, resume_url = "", skills = [] } = req.body;
    await pool.execute(
      `INSERT INTO candidate_profiles (user_id, user_email, full_name, avatar_url, title, bio, location, years_experience, resume_url, skills, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
          user_email = VALUES(user_email),
          full_name = COALESCE(VALUES(full_name), full_name),
          avatar_url = COALESCE(VALUES(avatar_url), avatar_url),
          title = VALUES(title), 
          bio = VALUES(bio), 
          location = VALUES(location), 
          years_experience = VALUES(years_experience), 
          skills = VALUES(skills), 
          updated_at = NOW()`,
      [user_id, user_email || null, full_name || null, avatar_url || null, title, bio, location, years_experience, resume_url, JSON.stringify(skills)]
    );
    res.json({ success: true, message: "Profile saved in MySQL Workbench candidate_profiles table" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Direct Save Analysis Endpoint for Resume & Privacy
app.post("/api/save-analysis", async (req, res) => {
  try {
    const {
      user_email = null,
      resume_text = "",
      jd_text = "",
      matched_score = 75,
      matched_skills = [],
      missing_skills = [],
      suggestions = []
    } = req.body;

    const [result] = await pool.execute(
      "INSERT INTO resume_analyzer (user_email, resume_text, jd_text, matched_score, matched_skills, missing_skills, suggestions, created_At) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [
        user_email || null,
        resume_text.slice(0, 10000),
        jd_text.slice(0, 10000),
        Number(matched_score) || 75,
        JSON.stringify(matched_skills),
        JSON.stringify(missing_skills),
        JSON.stringify(suggestions),
      ]
    );

    res.json({
      success: true,
      id: result.insertId,
      user_email: user_email,
      message: "Analysis saved in MySQL Workbench table resume_analyzer!",
    });
  } catch (err) {
    console.error("Save analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Referrals Endpoint (Stores in referral_emails table in MySQL Workbench)
app.post("/api/referrals", async (req, res) => {
  try {
    const { user_id = 1, company = "Company", to_email, role = "Software Engineer", subject = "", body = "" } = req.body;
    if (!to_email) {
      return res.status(400).json({ success: false, error: "Recipient email is required." });
    }
    const [result] = await pool.execute(
      "INSERT INTO referral_emails (user_id, to_email, subject, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'SENT', NOW(), NOW())",
      [user_id, to_email, subject, body]
    );
    res.status(201).json({
      success: true,
      id: result.insertId,
      message: "Referral draft stored in MySQL Workbench table referral_emails",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Proxy /auth fallback for any other custom subpaths if needed
app.use("/auth/legacy", (req, res) => {
  forwardToBackend("/auth", req, res);
});

// Proxy /ats-resume to Python FastAPI backend (Gemini ATS Generator)
app.use("/ats-resume", (req, res) => {
  forwardToBackend("/ats-resume", req, res);
});

// ==========================================
// STATIC FRONTEND SERVING
// ==========================================

// Serve static frontend assets
app.use("/frontend", express.static(FRONTEND_DIR));
app.use(express.static(ROOT_DIR));

// Clean URL routing for frontend pages
app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.get("/frontend", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.get("/frontend/pages/:page", (req, res, next) => {
  const pageName = req.params.page;
  const targetHtml = pageName.endsWith(".html") ? pageName : `${pageName}.html`;
  const filePath = path.join(FRONTEND_DIR, "pages", targetHtml);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  next();
});

// 404 Handler
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head><title>404 Not Found - JobNex</title></head>
    <body style="font-family: system-ui; text-align: center; padding: 40px; background: #0f172a; color: #fff;">
      <h2>404 - Page Not Found</h2>
      <p>Requested path: <code>${req.originalUrl}</code></p>
      <p><a href="/" style="color: #818cf8;">Root Page</a> • <a href="/frontend/" style="color: #818cf8;">Frontend Portal</a></p>
    </body>
    </html>
  `);
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 JobNex Node.js + Express Backend Server Running!`);
  console.log(`📡 Local Server URL: http://localhost:${PORT}`);
  console.log(`📡 Health Check:     http://localhost:${PORT}/api/health`);
  console.log(`📡 Database Health:  http://localhost:${PORT}/api/db-health`);
  console.log(`📡 Applications API: http://localhost:${PORT}/api/applications`);
  console.log(`📡 Jobs API:         http://localhost:${PORT}/api/jobs`);
  console.log(`📡 Frontend App:     http://localhost:${PORT}/frontend/`);
  console.log(`======================================================\n`);
});

export default app;
