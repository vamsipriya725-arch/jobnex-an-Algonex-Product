/**
 * Job Details Page Logic (frontend/js/job-details.js)
 * Fetches single job posting details via /api/jobs/:id with offline fallback.
 */

document.addEventListener("DOMContentLoaded", async () => {
  await loadComponent("navbar-container", "../components/navbar.html");
  await loadComponent("footer-container", "../components/footer.html");
  initNav("jobs");

  // Determine Job ID from URL (?id=... or /jobs/...)
  const urlParams = new URLSearchParams(window.location.search);
  let jobId = urlParams.get("id");
  if (!jobId) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last !== "job-details.html" && last !== "jobs") {
      jobId = last;
    }
  }

  const loadingEl = document.getElementById("job-details-loading");
  const errorEl = document.getElementById("job-details-error");
  const contentEl = document.getElementById("job-details-content");

  if (!jobId) {
    showError("No Job Specified", "Please provide a valid job ID to view posting details.");
    return;
  }

  function letterLogo(company) {
    const letter = ((company || "?").trim()[0] || "?").toUpperCase();
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">` +
      `<rect width="80" height="80" fill="#e0e7ff" rx="16"/>` +
      `<text x="50%" y="54%" font-family="Arial, sans-serif" font-size="36" font-weight="700" ` +
      `fill="#4338ca" text-anchor="middle" dominant-baseline="middle">${letter}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function showError(title, message) {
    if (loadingEl) loadingEl.classList.add("hidden");
    if (contentEl) contentEl.classList.add("hidden");
    if (errorEl) {
      errorEl.classList.remove("hidden");
      document.getElementById("error-title").textContent = title;
      document.getElementById("error-msg").textContent = message;
    }
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }

  let currentJob = null;

  async function loadJobDetails() {
    const API_BASE = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      if (res.ok) {
        const json = await res.json();
        currentJob = json.job || json;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn("[JobDetails] Could not fetch from backend API, checking fallback...", err);
      // Fallback check
      const fallbackList = [
        {
          id: "job-101",
          title: "Senior Full Stack Engineer",
          company: "Algonex AI Labs",
          locations: "Bengaluru, Hyderabad, Remote",
          work_mode: "Hybrid",
          job_type: "Full-time",
          exp_min: 3,
          exp_max: 7,
          salary_range: "₹18,00,000 - ₹28,00,000",
          key_skills: "Python, FastAPI, React, TypeScript, Docker, PostgreSQL",
          education: "B.Tech / B.E / MCA in Computer Science",
          department: "Engineering",
          openings: 4,
          description: "Join our core engineering team building high-performance AI agent tools and career intelligence engines. You will lead development of FastAPI microservices and React dashboards.",
          apply_last_date: "2026-11-30",
          apply_link: "https://algonex.com/careers",
          apply_email: "careers@algonex.com",
          status: "Active",
          applicants_count: 14,
        },
        {
          id: "job-102",
          title: "AI / ML Solutions Architect",
          company: "NovaCloud Tech",
          locations: "Bengaluru, San Francisco",
          work_mode: "Office",
          job_type: "Full-time",
          exp_min: 5,
          exp_max: 10,
          salary_range: "₹32,00,000 - ₹45,00,000",
          key_skills: "PyTorch, LLMs, LangChain, Python, Cloud Architecture, Vector Databases",
          education: "Master's or Bachelor's in CS / AI",
          department: "AI & Research",
          openings: 2,
          description: "Architect enterprise generative AI systems and fine-tuning pipelines. Direct involvement with model orchestration and retrieval augmented generation architectures.",
          apply_last_date: "2026-12-15",
          apply_link: "https://novacloud.ai/jobs",
          apply_email: "hiring@novacloud.ai",
          status: "Active",
          applicants_count: 8,
        },
        {
          id: "job-103",
          title: "Frontend Developer (React / Next.js)",
          company: "Kinetix Digital",
          locations: "Pune, Mumbai, Remote",
          work_mode: "Remote",
          job_type: "Full-time",
          exp_min: 2,
          exp_max: 5,
          salary_range: "₹12,00,000 - ₹18,00,000",
          key_skills: "React, Next.js, Tailwind CSS, TypeScript, Redux, Web Performance",
          education: "Any Graduate / BCA / B.Tech",
          department: "Engineering",
          openings: 3,
          description: "Craft pixel-perfect user interfaces, fluid micro-interactions, and accessible web experiences for global client applications.",
          apply_last_date: "2026-11-20",
          apply_link: "https://kinetixdigital.com/apply",
          apply_email: "jobs@kinetix.io",
          status: "Active",
          applicants_count: 21,
        }
      ];

      currentJob = fallbackList.find(j => j.id === jobId);

      if (!currentJob && window.JobNexData?.INITIAL_JOBS) {
        const found = window.JobNexData.INITIAL_JOBS.find(j => j.id === jobId);
        if (found) {
          currentJob = {
            id: found.id,
            title: found.title,
            company: found.company,
            locations: found.location,
            work_mode: "Hybrid",
            job_type: "Full-time",
            exp_min: 2,
            exp_max: 5,
            salary_range: found.salaryText || "Competitive",
            key_skills: (found.skills || []).join(", "),
            education: "Bachelor's Degree",
            department: "Engineering",
            openings: 1,
            description: found.description || `Exciting opportunity at ${found.company} for a ${found.title}.`,
            status: "Active",
            applicants_count: 5,
          };
        }
      }
    }

    if (!currentJob) {
      showError("Job Posting Not Found", `We could not find active job details for ID: "${jobId}". It may have expired or been removed.`);
      return;
    }

    renderJob(currentJob);
  }

  function renderJob(job) {
    if (loadingEl) loadingEl.classList.add("hidden");
    if (errorEl) errorEl.classList.add("hidden");
    if (contentEl) contentEl.classList.remove("hidden");

    document.title = `${job.title} at ${job.company} | JobNex`;

    // Elements
    document.getElementById("job-title").textContent = job.title;
    document.getElementById("job-company-name").textContent = job.company;
    document.getElementById("job-department-name").textContent = job.department || "Engineering";
    document.getElementById("job-locations").textContent = job.locations || "Remote";
    
    // Experience
    let expText = "Fresher";
    if (job.exp_min || job.exp_max) {
      expText = `${job.exp_min || 0} - ${job.exp_max || 5} Years`;
    } else if (job.experience) {
      expText = job.experience;
    }
    document.getElementById("job-experience").textContent = expText;
    document.getElementById("job-exp-val").textContent = expText;

    // Salary
    document.getElementById("job-salary").textContent = job.salary_range || job.salary || "Not disclosed";

    // Work Mode & Job Type
    document.getElementById("job-work-mode").textContent = job.work_mode || "Office";
    document.getElementById("job-type-badge").textContent = job.job_type || "Full-time";

    // Posted date
    let postedStr = "Posted recently";
    if (job.created_at) {
      try {
        const d = new Date(job.created_at);
        postedStr = `Posted on ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } catch {}
    }
    document.getElementById("job-posted-date").textContent = postedStr;

    // Logo
    const logoContainer = document.getElementById("job-company-logo-container");
    const logoSrc = job.company_logo || letterLogo(job.company);
    logoContainer.innerHTML = `<img src="${logoSrc}" alt="${job.company}" class="w-full h-full object-cover" onerror="this.src='${letterLogo(job.company)}'" />`;

    // Description
    const descEl = document.getElementById("job-description-body");
    descEl.textContent = job.description || "No description provided.";

    // Key Skills
    const skillsContainer = document.getElementById("job-skills-container");
    let skills = [];
    if (Array.isArray(job.skills)) {
      skills = job.skills;
    } else if (typeof job.key_skills === "string") {
      skills = job.key_skills.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (skills.length > 0) {
      skillsContainer.innerHTML = skills.map(s => `
        <span class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
          ${s}
        </span>
      `).join("");
    } else {
      skillsContainer.innerHTML = `<span class="text-xs text-slate-400">No specific skills listed.</span>`;
    }

    // Qualifications
    document.getElementById("job-education-val").textContent = job.education || "Any Graduate";
    document.getElementById("job-dept-val").textContent = job.department || "Engineering";
    document.getElementById("job-openings-val").textContent = `${job.openings || 1} opening${(job.openings || 1) > 1 ? 's' : ''}`;

    // Sidebar Summary
    document.getElementById("side-job-id").textContent = job.id;
    document.getElementById("side-job-type").textContent = job.job_type || "Full-time";
    document.getElementById("side-work-mode").textContent = job.work_mode || "Office";
    document.getElementById("side-last-date").textContent = job.apply_last_date || "Open until filled";
    document.getElementById("side-applicants-count").textContent = `${job.applicants_count || 0} candidate${(job.applicants_count || 0) === 1 ? '' : 's'}`;

    // Bookmarking
    let savedBookmarks = new Set(JSON.parse(localStorage.getItem("jobnex_bookmarks") || "[]"));
    const bookmarkBtn = document.getElementById("job-bookmark-btn");
    function updateBookmarkUI() {
      const isSaved = savedBookmarks.has(job.id);
      if (isSaved) {
        bookmarkBtn.classList.add("text-rose-500", "fill-rose-500", "border-rose-200", "bg-rose-50");
        bookmarkBtn.classList.remove("text-slate-400");
      } else {
        bookmarkBtn.classList.remove("text-rose-500", "fill-rose-500", "border-rose-200", "bg-rose-50");
        bookmarkBtn.classList.add("text-slate-400");
      }
    }
    updateBookmarkUI();

    bookmarkBtn.addEventListener("click", () => {
      if (savedBookmarks.has(job.id)) {
        savedBookmarks.delete(job.id);
        showToast("Job removed from saved bookmarks");
      } else {
        savedBookmarks.add(job.id);
        showToast("Job saved to your bookmarks");
      }
      localStorage.setItem("jobnex_bookmarks", JSON.stringify([...savedBookmarks]));
      updateBookmarkUI();
      if (typeof playSound === "function") playSound("click");
    });

    // Share action
    document.getElementById("job-share-btn")?.addEventListener("click", async () => {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(window.location.href);
          showToast("Job link copied to clipboard!");
        } else {
          showToast("Link: " + window.location.href);
        }
      } catch (e) {
        showToast("Link: " + window.location.href);
      }
    });

    // Apply Buttons
    function handleApply() {
      if (job.apply_link && job.apply_link.trim().startsWith("http")) {
        window.open(job.apply_link.trim(), "_blank", "noopener,noreferrer");
      } else if (job.apply_email && job.apply_email.includes("@")) {
        window.location.href = `mailto:${job.apply_email.trim()}?subject=Application for ${encodeURIComponent(job.title)} (ID: ${job.id})`;
      } else {
        // Open Apply Modal
        openApplyModal(job);
      }
    }

    document.getElementById("job-primary-apply-btn")?.addEventListener("click", handleApply);
    document.getElementById("job-secondary-apply-btn")?.addEventListener("click", handleApply);

    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }

  function openApplyModal(job) {
    const modal = document.getElementById("apply-modal");
    if (!modal) return;
    document.getElementById("modal-job-title").textContent = job.title;
    document.getElementById("modal-job-company").textContent = job.company;
    modal.classList.remove("hidden");
  }

  // Modal Close & Submit
  document.getElementById("modal-close-btn")?.addEventListener("click", () => {
    document.getElementById("apply-modal")?.classList.add("hidden");
  });
  document.getElementById("modal-cancel-btn")?.addEventListener("click", () => {
    document.getElementById("apply-modal")?.classList.add("hidden");
  });
  document.getElementById("modal-apply-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("apply-modal")?.classList.add("hidden");
    showToast("Application submitted successfully! Recruiter has been notified.");
  });

  // Start loading
  loadJobDetails();
});
