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
const DB_PASSWORD = process.env.DB_PASSWORD || "Algonex@2003";
const DB_NAME = process.env.DB_NAME || "jobnex";
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

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
    const { user_id = "1", job_title, company, job_url = "", source = "manual", status = "Applied", notes = "" } = req.body;

    if (!job_title || !company) {
      return res.status(400).json({ success: false, error: "job_title and company are required fields." });
    }

    const [result] = await pool.execute(
      "INSERT INTO applications (user_id, job_title, company, job_url, source, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [String(user_id), job_title, company, job_url, source, status, notes]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: "Application recorded successfully.",
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
    const [rows] = await pool.execute("SELECT * FROM resume_analyzer ORDER BY Analysis_Id DESC LIMIT 20");
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
    const pathAndQuery = req.originalUrl || `${prefix}${req.url}`;
    const targetUrl = `${BACKEND_URL}${pathAndQuery}`;
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

// Proxy /auth to Python FastAPI if running
app.use("/auth", (req, res) => {
  forwardToBackend("/auth", req, res);
});

// Proxy /ats-resume to Python FastAPI backend (Gemini ATS Generator)
app.use("/ats-resume", (req, res) => {
  forwardToBackend("/ats-resume", req, res);
});

// Direct MySQL query endpoint for saved Skill Gap courses with proxy fallback
app.get("/api/skill-gap/courses", async (req, res) => {
  const { user_id = "u-1", skill, status } = req.query;
  try {
    let query = "SELECT * FROM user_course_recommendations WHERE user_id = ?";
    const params = [user_id];
    if (skill) {
      query += " AND skill = ?";
      params.push(skill);
    }
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    query += " ORDER BY updated_at DESC LIMIT 50";
    const [rows] = await pool.execute(query, params);

    const formatted = rows.map((r) => {
      let skillsTargeted = [];
      try {
        skillsTargeted = typeof r.skills_targeted === "string" ? JSON.parse(r.skills_targeted) : (r.skills_targeted || [r.skill]);
      } catch {
        skillsTargeted = [r.skill];
      }
      return {
        id: String(r.id),
        userId: r.user_id,
        skill: r.skill,
        title: r.course_title,
        provider: r.provider,
        domain: (r.course_url || "").split("/")[2] || "online",
        url: r.course_url,
        type: r.course_type || "course",
        rating: Number(r.rating) || 4.8,
        reviewCount: Number(r.review_count) || 1200,
        duration: r.duration || "Self-paced",
        badgeColor: r.badge_color || "bg-blue-50 text-blue-700 border-blue-200",
        skillsTargeted: skillsTargeted || [r.skill],
        status: r.status || "recommended",
        aiTip: r.ai_tip || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    return res.json({ success: true, user_id, count: formatted.length, total: formatted.length, courses: formatted });
  } catch (err) {
    forwardToBackend("/api/skill-gap", req, res);
  }
});

// Proxy /api/resources and /api/skill-gap to Python FastAPI backend
app.use("/api/resources", (req, res) => {
  forwardToBackend("/api/resources", req, res);
});

app.use("/api/skill-gap", (req, res) => {
  forwardToBackend("/api/skill-gap", req, res);
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
