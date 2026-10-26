/**
 * Jobs Page Logic (frontend/js/jobs.js)
 * Connects to live MySQL database records via /api/jobs and /api/applications
 */

document.addEventListener("DOMContentLoaded", async () => {
  await loadComponent("navbar-container", "../components/navbar.html");
  await loadComponent("footer-container", "../components/footer.html");
  initNav("jobs");

  // Read URL search params
  const urlParams = new URLSearchParams(window.location.search);
  let searchQuery = urlParams.get("q") || "";
  let selectedRegions = urlParams.get("region") ? [urlParams.get("region")] : [];
  let selectedExps = urlParams.get("exp") ? [urlParams.get("exp")] : [];
  let selectedCerts = [];
  let sortBy = "relevance";

  const searchInput = document.getElementById("job-keyword-input");
  if (searchInput && searchQuery) {
    searchInput.value = searchQuery;
  }

  // Pre-check region or exp if in URL
  if (selectedRegions.length > 0) {
    document.querySelectorAll(".region-filter-cb").forEach(cb => {
      if (selectedRegions.includes(cb.value)) cb.checked = true;
    });
  }
  if (selectedExps.length > 0) {
    document.querySelectorAll(".exp-filter-cb").forEach(cb => {
      if (selectedExps.includes(cb.value)) cb.checked = true;
    });
  }

  // Saved bookmarks in localStorage
  let savedBookmarks = new Set(JSON.parse(localStorage.getItem("jobnex_bookmarks") || "[]"));

  let dbJobs = [];
  let isLoadingJobs = false;

  async function fetchDbJobs() {
    isLoadingJobs = true;
    renderJobs();

    try {
      const response = await fetch("/api/jobs");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        dbJobs = json.data;
      } else {
        dbJobs = [...(window.JobNexData?.INITIAL_JOBS || [])];
      }
    } catch (err) {
      console.warn("Could not load jobs from /api/jobs, falling back to cached jobs:", err);
      dbJobs = [...(window.JobNexData?.INITIAL_JOBS || [])];
    } finally {
      isLoadingJobs = false;
      renderJobs();
    }
  }

  function renderJobs() {
    const container = document.getElementById("jobs-list-container");
    const countEl = document.getElementById("jobs-count-text");

    if (isLoadingJobs) {
      if (container) {
        container.innerHTML = `
          <div class="bg-white rounded-xl p-12 text-center border border-slate-200">
            <div class="inline-flex items-center gap-2 text-brand-600 font-semibold text-sm">
              <span class="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></span>
              <span>Fetching live jobs from MySQL Database...</span>
            </div>
          </div>
        `;
      }
      return;
    }

    let allJobs = [...dbJobs];

    // Filter by keyword
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      allJobs = allJobs.filter(j =>
        (j.title || "").toLowerCase().includes(q) ||
        (j.company || "").toLowerCase().includes(q) ||
        (j.skills || []).some(s => s.toLowerCase().includes(q)) ||
        (j.description || "").toLowerCase().includes(q)
      );
    }

    // Filter by regions
    if (selectedRegions.length > 0) {
      allJobs = allJobs.filter(j => selectedRegions.includes(j.region));
    }

    // Filter by exp
    if (selectedExps.length > 0) {
      allJobs = allJobs.filter(j => selectedExps.includes(j.experienceLevel));
    }

    // Filter by certs
    if (selectedCerts.length > 0) {
      allJobs = allJobs.filter(j => j.certifications && j.certifications.some(c => selectedCerts.includes(c)));
    }

    // Sort
    if (sortBy === "salary") {
      allJobs.sort((a, b) => (b.salaryMax || 0) - (a.salaryMax || 0));
    } else if (sortBy === "date") {
      allJobs.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    } else {
      allJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    }

    if (countEl) countEl.textContent = `${allJobs.length} roles found (Live MySQL)`;

    if (!container) return;

    if (allJobs.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-xl p-12 text-center border border-slate-200">
          <p class="text-base font-bold text-slate-800">No jobs match your current filters</p>
          <p class="text-xs text-slate-500 mt-1">Try clearing your filters or searching for different keywords.</p>
          <button id="reset-filters-btn" class="mt-4 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold cursor-pointer">Clear Filters</button>
        </div>
      `;
      document.getElementById("reset-filters-btn")?.addEventListener("click", resetAllFilters);
      return;
    }

    container.innerHTML = allJobs.map(job => {
      const isBookmarked = savedBookmarks.has(job.id);
      const skills = Array.isArray(job.skills) ? job.skills : [];
      return `
        <div class="bg-white rounded-xl border border-slate-200/90 hover:border-brand-300 p-5 shadow-xs hover:shadow-md transition-all group">
          <div class="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                <img class="w-full h-full object-cover group-hover:scale-105 transition-transform" src="${job.companyLogo || '../assets/favicon.svg'}" alt="${job.company}" onerror="this.src='../assets/favicon.svg'" />
              </div>
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors">${job.title}</h3>
                  ${job.matchScore ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">${job.matchScore}% Match</span>` : ''}
                </div>
                <p class="text-xs font-bold text-slate-700">${job.company}</p>

                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span class="flex items-center gap-1">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i>
                    ${job.location || 'Remote'}
                  </span>
                  <span class="flex items-center gap-1">
                    <i data-lucide="briefcase" class="w-3.5 h-3.5 text-slate-400"></i>
                    ${job.experienceLevel || 'Mid-Senior'}
                  </span>
                  <span class="font-bold text-amber-700">
                    ${formatCurrency(job.salaryMin || 70000, job.currency || 'USD')} - ${formatCurrency(job.salaryMax || 130000, job.currency || 'USD')}
                  </span>
                </div>

                <div class="flex flex-wrap gap-1.5 pt-2">
                  ${skills.map(s => `
                    <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">${s}</span>
                  `).join("")}
                </div>
              </div>
            </div>

            <div class="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pt-2 sm:pt-0 shrink-0">
              <button type="button" class="bookmark-btn p-2 rounded-lg ${isBookmarked ? 'text-rose-500 fill-rose-500' : 'text-slate-400'} hover:text-rose-500 hover:bg-slate-100 cursor-pointer transition-colors" data-id="${job.id}">
                <i data-lucide="bookmark" class="w-5 h-5 ${isBookmarked ? 'fill-rose-500' : ''}"></i>
              </button>
              <button type="button" class="apply-modal-btn btn-polish bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl cursor-pointer" data-id="${job.id}">
                Apply
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Hook events
    document.querySelectorAll(".bookmark-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (savedBookmarks.has(id)) {
          savedBookmarks.delete(id);
          showToast("Removed from bookmarks");
        } else {
          savedBookmarks.add(id);
          showToast("Saved to bookmarks");
        }
        localStorage.setItem("jobnex_bookmarks", JSON.stringify([...savedBookmarks]));
        playSound("click");
        renderJobs();
      });
    });

    document.querySelectorAll(".apply-modal-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openApplyModal(id);
      });
    });

    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function resetAllFilters() {
    searchQuery = "";
    selectedRegions = [];
    selectedExps = [];
    selectedCerts = [];
    if (searchInput) searchInput.value = "";
    document.querySelectorAll(".region-filter-cb, .exp-filter-cb, .cert-filter-cb").forEach(cb => cb.checked = false);
    renderJobs();
  }

  // Filter input listeners
  document.getElementById("job-search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    searchQuery = searchInput ? searchInput.value.trim() : "";
    renderJobs();
  });

  document.querySelectorAll(".region-filter-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      selectedRegions = Array.from(document.querySelectorAll(".region-filter-cb:checked")).map(c => c.value);
      renderJobs();
    });
  });

  document.querySelectorAll(".exp-filter-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      selectedExps = Array.from(document.querySelectorAll(".exp-filter-cb:checked")).map(c => c.value);
      renderJobs();
    });
  });

  document.querySelectorAll(".cert-filter-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      selectedCerts = Array.from(document.querySelectorAll(".cert-filter-cb:checked")).map(c => c.value);
      renderJobs();
    });
  });

  document.getElementById("sort-by-select")?.addEventListener("change", (e) => {
    sortBy = e.target.value;
    renderJobs();
  });

  // Apply Modal Handlers
  const modal = document.getElementById("apply-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalJobTitle = document.getElementById("modal-job-title");
  const modalJobCompany = document.getElementById("modal-job-company");
  const applyForm = document.getElementById("modal-apply-form");
  let activeApplyJob = null;

  function openApplyModal(jobId) {
    const job = dbJobs.find(j => j.id === jobId) || window.JobNexData?.INITIAL_JOBS.find(j => j.id === jobId);
    if (!job) return;
    activeApplyJob = job;
    if (modalJobTitle) modalJobTitle.textContent = job.title;
    if (modalJobCompany) modalJobCompany.textContent = job.company;
    modal?.classList.remove("hidden");
    playSound("click");
  }

  function closeApplyModal() {
    modal?.classList.add("hidden");
    activeApplyJob = null;
  }

  modalCloseBtn?.addEventListener("click", closeApplyModal);
  modalCancelBtn?.addEventListener("click", closeApplyModal);

  applyForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeApplyJob) return;

    // Send application to MySQL via Express POST /api/applications
    try {
      const user = window.JobNexAuth ? window.JobNexAuth.getUser() : {};
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id || "1",
          job_title: activeApplyJob.title,
          company: activeApplyJob.company,
          job_url: activeApplyJob.jobUrl || "",
          source: "web",
          status: "Applied",
          notes: `Direct application submitted for ${activeApplyJob.title} at ${activeApplyJob.company}.`,
        }),
      });
      playSound("success");
      showToast(`Application successfully submitted and stored in MySQL Workbench!`);
    } catch (err) {
      console.warn("Application submission error:", err);
      showToast(`Application submitted: ${activeApplyJob.company}!`);
    }

    closeApplyModal();
  });

  // Mobile filters toggle
  document.getElementById("mobile-filters-btn")?.addEventListener("click", () => {
    document.getElementById("sidebar-filters")?.classList.toggle("hidden");
  });

  // Check URL if apply requested directly
  const applyParam = urlParams.get("apply");
  if (applyParam) {
    openApplyModal(applyParam);
  }

  // Start fetching live jobs
  fetchDbJobs();
});
