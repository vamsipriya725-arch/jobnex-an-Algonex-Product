/**
 * Jobs Directory Logic (frontend/js/jobs.js)
 * Connects to live Job Management API via /api/jobs, with offline fallback.
 * Displays admin-posted roles with search, filters, sorting, View Details, and Apply.
 */

document.addEventListener("DOMContentLoaded", async () => {
  await loadComponent("navbar-container", "../components/navbar.html");
  await loadComponent("footer-container", "../components/footer.html");
  initNav("jobs");

  // Read URL search params
  const urlParams = new URLSearchParams(window.location.search);
  let searchQuery = urlParams.get("q") || "";
  let selectedModes = [];
  let selectedTypes = [];
  let selectedExps = [];
  let selectedLocations = [];
  let sortBy = "latest";

  const searchInput = document.getElementById("job-keyword-input");
  if (searchInput && searchQuery) {
    searchInput.value = searchQuery;
  }

  // Pre-check filters if passed via URL
  if (urlParams.get("location")) {
    selectedLocations.push(urlParams.get("location"));
    document.querySelectorAll(".location-filter-cb").forEach(cb => {
      if (cb.value.toLowerCase() === urlParams.get("location").toLowerCase()) cb.checked = true;
    });
  }
  if (urlParams.get("exp")) {
    selectedExps.push(urlParams.get("exp"));
    document.querySelectorAll(".exp-filter-cb").forEach(cb => {
      if (cb.value.toLowerCase() === urlParams.get("exp").toLowerCase()) cb.checked = true;
    });
  }

  // Bookmarks in localStorage
  let savedBookmarks = new Set(JSON.parse(localStorage.getItem("jobnex_bookmarks") || "[]"));

  let allJobs = [];
  let isLoadingJobs = false;

  function letterLogo(company) {
    const letter = ((company || "?").trim()[0] || "?").toUpperCase();
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56">` +
      `<rect width="56" height="56" fill="#e0e7ff" rx="12"/>` +
      `<text x="50%" y="54%" font-family="Arial, sans-serif" font-size="26" font-weight="700" ` +
      `fill="#4338ca" text-anchor="middle" dominant-baseline="middle">${letter}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function formatPostedDate(raw) {
    if (!raw) return "Recently posted";
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return "Recently posted";
      const now = new Date();
      const diffMs = now - d;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Posted today";
      if (diffDays === 1) return "Posted 1 day ago";
      if (diffDays < 30) return `Posted ${diffDays} days ago`;
      return `Posted on ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    } catch {
      return "Recently posted";
    }
  }

  const FALLBACK_SEED_JOBS = [
    {
      id: "job-101",
      title: "Senior Full Stack Engineer",
      company: "Algonex AI Labs",
      company_logo: "",
      locations: "Bengaluru, Hyderabad, Remote",
      work_mode: "Hybrid",
      job_type: "Full-time",
      exp_min: 3,
      exp_max: 7,
      salary_range: "₹18,00,000 - ₹28,00,000",
      key_skills: "Python, FastAPI, React, TypeScript, Docker, PostgreSQL",
      skills: ["Python", "FastAPI", "React", "TypeScript", "Docker", "PostgreSQL"],
      education: "B.Tech / B.E / MCA in Computer Science",
      department: "Engineering",
      openings: 4,
      description: "Join our core engineering team building high-performance AI agent tools and career intelligence engines. You will lead development of FastAPI microservices and React dashboards.",
      apply_last_date: "2026-11-30",
      apply_link: "https://algonex.com/careers",
      apply_email: "careers@algonex.com",
      status: "Active",
      applicants_count: 14,
      created_at: new Date().toISOString()
    },
    {
      id: "job-102",
      title: "AI / ML Solutions Architect",
      company: "NovaCloud Tech",
      company_logo: "",
      locations: "Bengaluru, San Francisco",
      work_mode: "Office",
      job_type: "Full-time",
      exp_min: 5,
      exp_max: 10,
      salary_range: "₹32,00,000 - ₹45,00,000",
      key_skills: "PyTorch, LLMs, LangChain, Python, Cloud Architecture, Vector Databases",
      skills: ["PyTorch", "LLMs", "LangChain", "Python", "Cloud Architecture"],
      education: "Master's or Bachelor's in CS / AI",
      department: "AI & Research",
      openings: 2,
      description: "Architect enterprise generative AI systems and fine-tuning pipelines. Direct involvement with model orchestration and retrieval augmented generation architectures.",
      apply_last_date: "2026-12-15",
      apply_link: "https://novacloud.ai/jobs",
      apply_email: "hiring@novacloud.ai",
      status: "Active",
      applicants_count: 8,
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "job-103",
      title: "Frontend Developer (React / Next.js)",
      company: "Kinetix Digital",
      company_logo: "",
      locations: "Pune, Mumbai, Remote",
      work_mode: "Remote",
      job_type: "Full-time",
      exp_min: 2,
      exp_max: 5,
      salary_range: "₹12,00,000 - ₹18,00,000",
      key_skills: "React, Next.js, Tailwind CSS, TypeScript, Redux, Web Performance",
      skills: ["React", "Next.js", "Tailwind CSS", "TypeScript", "Redux"],
      education: "Any Graduate / BCA / B.Tech",
      department: "Engineering",
      openings: 3,
      description: "Craft pixel-perfect user interfaces, fluid micro-interactions, and accessible web experiences for global client applications.",
      apply_last_date: "2026-11-20",
      apply_link: "https://kinetixdigital.com/apply",
      apply_email: "jobs@kinetix.io",
      status: "Active",
      applicants_count: 21,
      created_at: new Date(Date.now() - 172800000).toISOString()
    }
  ];

  async function fetchJobs() {
    isLoadingJobs = true;
    renderJobs();

    const API_BASE = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";
    try {
      const res = await fetch(`${API_BASE}/api/jobs?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      
      const list = json.jobs || json.data || [];
      if (Array.isArray(list) && list.length > 0) {
        allJobs = list;
      } else {
        allJobs = [...FALLBACK_SEED_JOBS];
      }
    } catch (err) {
      console.warn("[Jobs] Using local fallback jobs dataset:", err);
      allJobs = [...FALLBACK_SEED_JOBS];
      if (window.JobNexData?.INITIAL_JOBS) {
        // Merge mock jobs
        const converted = window.JobNexData.INITIAL_JOBS.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          company_logo: j.companyLogo || "",
          locations: j.location || "Remote",
          work_mode: j.location && j.location.toLowerCase().includes("remote") ? "Remote" : "Hybrid",
          job_type: "Full-time",
          exp_min: j.experienceLevel === "Fresher" ? 0 : 2,
          exp_max: 5,
          salary_range: j.salaryText || "Competitive",
          key_skills: (j.skills || []).join(", "),
          skills: j.skills || [],
          education: "Bachelor's Degree",
          department: "Engineering",
          openings: 1,
          description: j.description || "",
          status: "Active",
          applicants_count: 5,
          created_at: j.postedAt || new Date().toISOString()
        }));
        allJobs = [...allJobs, ...converted];
      }
    }

    isLoadingJobs = false;
    renderJobs();
  }

  function getActiveFilterValues() {
    selectedModes = Array.from(document.querySelectorAll(".mode-filter-cb:checked")).map(cb => cb.value.toLowerCase());
    selectedTypes = Array.from(document.querySelectorAll(".type-filter-cb:checked")).map(cb => cb.value.toLowerCase());
    selectedExps = Array.from(document.querySelectorAll(".exp-filter-cb:checked")).map(cb => cb.value.toLowerCase());
    selectedLocations = Array.from(document.querySelectorAll(".location-filter-cb:checked")).map(cb => cb.value.toLowerCase());
  }

  function renderJobs() {
    const container = document.getElementById("jobs-list-container");
    const countEl = document.getElementById("jobs-count-text");

    if (isLoadingJobs) {
      if (container) {
        container.innerHTML = `
          <div class="space-y-4">
            ${[1, 2, 3].map(() => `
              <div class="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs animate-pulse space-y-4">
                <div class="flex items-start gap-4">
                  <div class="w-14 h-14 rounded-xl bg-slate-200 shrink-0"></div>
                  <div class="space-y-2 flex-1">
                    <div class="h-5 bg-slate-200 rounded w-1/3"></div>
                    <div class="h-3.5 bg-slate-200 rounded w-1/5"></div>
                    <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        `;
      }
      return;
    }

    getActiveFilterValues();

    let filtered = [...allJobs];

    // Status filter: only show Active on candidate jobs directory
    filtered = filtered.filter(j => !j.status || j.status.toLowerCase() === "active");

    // 1. Keyword search (title / skills / company / description)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(j => {
        const titleMatch = (j.title || "").toLowerCase().includes(q);
        const compMatch = (j.company || "").toLowerCase().includes(q);
        const descMatch = (j.description || "").toLowerCase().includes(q);
        const skillsStr = Array.isArray(j.skills) ? j.skills.join(" ") : (j.key_skills || "");
        const skillMatch = skillsStr.toLowerCase().includes(q);
        return titleMatch || compMatch || descMatch || skillMatch;
      });
    }

    // 2. Work Mode Filter
    if (selectedModes.length > 0) {
      filtered = filtered.filter(j => {
        const mode = (j.work_mode || "office").toLowerCase();
        return selectedModes.includes(mode);
      });
    }

    // 3. Job Type Filter
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(j => {
        const type = (j.job_type || "full-time").toLowerCase();
        return selectedTypes.includes(type);
      });
    }

    // 4. Experience Level Filter
    if (selectedExps.length > 0) {
      filtered = filtered.filter(j => {
        const expMin = Number(j.exp_min || 0);
        const expMax = Number(j.exp_max || 0);
        return selectedExps.some(expKey => {
          if (expKey.includes("fresher")) return expMin === 0;
          if (expKey.includes("1-2")) return expMin <= 2 && expMax >= 1;
          if (expKey.includes("3-5")) return expMin <= 5 && expMax >= 3;
          if (expKey.includes("5+")) return expMax >= 5 || expMin >= 5;
          return false;
        });
      });
    }

    // 5. Location Filter
    if (selectedLocations.length > 0) {
      filtered = filtered.filter(j => {
        const loc = (j.locations || j.location || "").toLowerCase();
        return selectedLocations.some(l => loc.includes(l));
      });
    }

    // 6. Sorting
    if (sortBy === "salary") {
      filtered.sort((a, b) => {
        const extractNum = (str) => {
          if (!str) return 0;
          const nums = str.match(/\d[\d,]*/g);
          if (!nums) return 0;
          return parseInt(nums[nums.length - 1].replace(/,/g, ""), 10) || 0;
        };
        return extractNum(b.salary_range || b.salaryText) - extractNum(a.salary_range || a.salaryText);
      });
    } else if (sortBy === "relevance") {
      filtered.sort((a, b) => (b.applicants_count || 0) - (a.applicants_count || 0));
    } else {
      // Default: Latest First
      filtered.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
    }

    if (countEl) {
      countEl.textContent = `${filtered.length} role${filtered.length === 1 ? '' : 's'}`;
    }

    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl p-10 sm:p-12 text-center border border-slate-200/90 shadow-2xs space-y-4">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <i data-lucide="search-x" class="w-6 h-6"></i>
          </div>
          <div class="space-y-1">
            <h3 class="text-base font-bold text-slate-900">No matching jobs found</h3>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn't find any opportunities matching your selected criteria. Try adjusting your keyword or clearing active filters.
            </p>
          </div>
          <button id="empty-clear-btn" type="button" class="btn-polish bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer">
            Clear All Filters
          </button>
        </div>
      `;
      document.getElementById("empty-clear-btn")?.addEventListener("click", resetAllFilters);
      if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
      return;
    }

    // Render Job Cards
    container.innerHTML = filtered.map(job => {
      const isSaved = savedBookmarks.has(job.id);
      let skills = [];
      if (Array.isArray(job.skills) && job.skills.length > 0) {
        skills = job.skills;
      } else if (typeof job.key_skills === "string") {
        skills = job.key_skills.split(",").map(s => s.trim()).filter(Boolean);
      }
      const logo = job.company_logo || letterLogo(job.company);
      const salary = job.salary_range || job.salaryText || "Not disclosed";
      const postedText = formatPostedDate(job.created_at);
      
      let expText = "Fresher";
      if (job.exp_min || job.exp_max) {
        expText = `${job.exp_min || 0} - ${job.exp_max || 5} yrs`;
      } else if (job.experience) {
        expText = job.experience;
      }

      const locationsText = job.locations || job.location || "Remote";
      const workMode = job.work_mode || "Office";
      const jobType = job.job_type || "Full-time";

      return `
        <article class="bg-white rounded-2xl border border-slate-200/90 hover:border-brand-300 p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all group relative space-y-4">
          <div class="flex flex-col sm:flex-row items-start justify-between gap-4">
            <!-- Left Info -->
            <div class="flex items-start gap-3.5 sm:gap-4 flex-1 min-w-0">
              <div class="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center shadow-2xs">
                <img class="w-full h-full object-cover group-hover:scale-105 transition-transform" src="${logo}" alt="${job.company}" onerror="this.src='${letterLogo(job.company)}'" />
              </div>

              <div class="space-y-1.5 flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <a href="job-details.html?id=${job.id}" class="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                    ${job.title}
                  </a>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    ${jobType}
                  </span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                    ${workMode}
                  </span>
                </div>

                <p class="text-xs font-semibold text-slate-600 truncate">${job.company}</p>

                <!-- Metadata Row -->
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                  <span class="flex items-center gap-1">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                    <span class="truncate">${locationsText}</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <i data-lucide="briefcase" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                    <span>${expText}</span>
                  </span>
                  <span class="font-bold text-amber-700 flex items-center gap-1">
                    <i data-lucide="banknote" class="w-3.5 h-3.5 text-amber-600 shrink-0"></i>
                    <span>${salary}</span>
                  </span>
                  <span class="text-slate-400 text-[11px] flex items-center gap-1">
                    <i data-lucide="clock" class="w-3 h-3 text-slate-400 shrink-0"></i>
                    <span>${postedText}</span>
                  </span>
                </div>

                <!-- Skills Tag Pills -->
                <div class="flex flex-wrap gap-1.5 pt-2">
                  ${skills.slice(0, 6).map(s => `
                    <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors">
                      ${s}
                    </span>
                  `).join("")}
                  ${skills.length > 6 ? `<span class="text-[10px] font-semibold text-slate-400 px-1 py-0.5">+${skills.length - 6} more</span>` : ''}
                </div>
              </div>
            </div>

            <!-- Right Actions: View Details & Apply -->
            <div class="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2.5 pt-2 sm:pt-0 shrink-0 border-t sm:border-t-0 border-slate-100">
              <button type="button" class="bookmark-btn p-2 rounded-xl ${isSaved ? 'text-rose-500 fill-rose-500 bg-rose-50' : 'text-slate-400'} hover:text-rose-500 hover:bg-rose-50 cursor-pointer transition-colors" data-id="${job.id}" title="Bookmark Role">
                <i data-lucide="bookmark" class="w-4 h-4 ${isSaved ? 'fill-rose-500' : ''}"></i>
              </button>
              
              <div class="flex items-center gap-2 w-full sm:w-auto">
                <a href="job-details.html?id=${job.id}" class="inline-flex items-center justify-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200 hover:border-brand-400 hover:bg-brand-50 text-slate-700 hover:text-brand-700 transition-all cursor-pointer">
                  <span>View Details</span>
                </a>
                <button type="button" class="apply-trigger-btn btn-polish bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-1.5" data-id="${job.id}">
                  <span>Apply</span>
                  <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // Hook Bookmark Events
    document.querySelectorAll(".bookmark-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        if (savedBookmarks.has(id)) {
          savedBookmarks.delete(id);
          showToast("Role removed from bookmarks");
        } else {
          savedBookmarks.add(id);
          showToast("Role saved to bookmarks");
        }
        localStorage.setItem("jobnex_bookmarks", JSON.stringify([...savedBookmarks]));
        if (typeof playSound === "function") playSound("click");
        renderJobs();
      });
    });

    // Hook Apply Events
    document.querySelectorAll(".apply-trigger-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const job = allJobs.find(j => j.id === id);
        if (job && job.apply_link && job.apply_link.trim().startsWith("http")) {
          window.open(job.apply_link.trim(), "_blank", "noopener,noreferrer");
          return;
        }
        if (job && job.apply_email && job.apply_email.includes("@")) {
          window.location.href = `mailto:${job.apply_email.trim()}?subject=Application for ${encodeURIComponent(job.title)}`;
          return;
        }
        openApplyModal(id);
      });
    });

    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function resetAllFilters() {
    searchQuery = "";
    if (searchInput) searchInput.value = "";
    document.querySelectorAll(".mode-filter-cb, .type-filter-cb, .exp-filter-cb, .location-filter-cb").forEach(cb => {
      cb.checked = false;
    });
    sortBy = "latest";
    const sortSelect = document.getElementById("sort-by-select");
    if (sortSelect) sortSelect.value = "latest";
    renderJobs();
  }

  // Search Form Submit
  const searchForm = document.getElementById("job-search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      searchQuery = (searchInput?.value || "").trim();
      renderJobs();
    });
  }

  // Realtime Search Input debounce
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value.trim();
        renderJobs();
      }, 300);
    });
  }

  // Filters change listener
  document.querySelectorAll(".mode-filter-cb, .type-filter-cb, .exp-filter-cb, .location-filter-cb").forEach(cb => {
    cb.addEventListener("change", renderJobs);
  });

  // Sort change listener
  const sortSelect = document.getElementById("sort-by-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      sortBy = e.target.value;
      renderJobs();
    });
  }

  // Clear filters button
  document.getElementById("clear-all-filters-btn")?.addEventListener("click", resetAllFilters);

  // Mobile filters toggle
  const mobileFiltersBtn = document.getElementById("mobile-filters-btn");
  const sidebarFilters = document.getElementById("sidebar-filters");
  if (mobileFiltersBtn && sidebarFilters) {
    mobileFiltersBtn.addEventListener("click", () => {
      sidebarFilters.classList.toggle("hidden");
    });
  }

  // Apply Modal
  function openApplyModal(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    const modal = document.getElementById("apply-modal");
    if (!modal) return;
    if (job) {
      document.getElementById("modal-job-title").textContent = job.title;
      document.getElementById("modal-job-company").textContent = job.company;
    }
    modal.classList.remove("hidden");
  }

  document.getElementById("modal-close-btn")?.addEventListener("click", () => {
    document.getElementById("apply-modal")?.classList.add("hidden");
  });
  document.getElementById("modal-cancel-btn")?.addEventListener("click", () => {
    document.getElementById("apply-modal")?.classList.add("hidden");
  });
  document.getElementById("modal-apply-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("apply-modal")?.classList.add("hidden");
    showToast("Application submitted successfully! The recruiter will review your profile.");
  });

  // Initial Fetch
  fetchJobs();
});
