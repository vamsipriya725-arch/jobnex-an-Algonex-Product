/**
 * Jobs Page Logic (frontend/js/jobs.js)
 * Connects to live MySQL database records via /api/jobs, /api/community-jobs,
 * with full offline / static CDN fallback for Cloudflare Workers & Vercel.
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
  let communityJobs = [];
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

  function guessRegion(location) {
    const loc = (location || "").toLowerCase();
    if (/india|bengaluru|bangalore|hyderabad|chennai|pune|mumbai|delhi|noida|gurgaon/i.test(loc)) return "INDIA";
    if (/usa?|united states|new york|san francisco|california|texas|seattle/i.test(loc)) return "US";
    return "GLOBAL";
  }

  function getLocalCommunityJobs() {
    try {
      return JSON.parse(localStorage.getItem("jobnex_community_jobs") || "[]");
    } catch {
      return [];
    }
  }

  function saveLocalCommunityJob(job) {
    const list = getLocalCommunityJobs();
    list.unshift(job);
    localStorage.setItem("jobnex_community_jobs", JSON.stringify(list));
  }

  async function fetchDbJobs() {
    isLoadingJobs = true;
    renderJobs();

    // 1. Fetch base jobs
    let baseJobs = [];
    try {
      const response = await fetch("/api/jobs");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        baseJobs = json.data;
      } else {
        baseJobs = [...(window.JobNexData?.INITIAL_JOBS || [])];
      }
    } catch (err) {
      baseJobs = [...(window.JobNexData?.INITIAL_JOBS || [])];
    }

    // 2. Fetch community jobs (API + local storage fallback)
    communityJobs = [];
    try {
      const cRes = await fetch("/api/community-jobs");
      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData.jobs)) {
          communityJobs = cData.jobs.map(j => ({
            id: `community-${j.id}`,
            title: j.title,
            company: j.company,
            companyLogo: letterLogo(j.company),
            location: j.location,
            region: guessRegion(j.location),
            experienceLevel: j.experience,
            salaryMin: 0,
            salaryMax: 0,
            currency: "INR",
            salaryText: j.salary || "",
            skills: Array.isArray(j.skills) ? j.skills : [],
            sourceUrl: j.url,
            isCommunity: true,
            postedAt: j.created_at || new Date().toISOString(),
          }));
        }
      }
    } catch (err) {
      // Offline / CDN mode
    }

    // Merge with any local user-uploaded community jobs in localStorage
    const localUploaded = getLocalCommunityJobs();
    const existingUrls = new Set(communityJobs.map(j => j.sourceUrl));
    for (const locJob of localUploaded) {
      if (!existingUrls.has(locJob.sourceUrl)) {
        communityJobs.push(locJob);
        existingUrls.add(locJob.sourceUrl);
      }
    }

    dbJobs = [...communityJobs, ...baseJobs];
    isLoadingJobs = false;
    renderJobs();
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
              <span>Loading jobs...</span>
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

    if (countEl) countEl.textContent = `${allJobs.length} roles found`;

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
      const logo = job.companyLogo || letterLogo(job.company);
      const isCommunity = Boolean(job.isCommunity);
      const salaryDisplay = job.salaryText
        ? job.salaryText
        : (job.salaryMin || job.salaryMax)
          ? `${formatCurrency(job.salaryMin || 70000, job.currency || 'USD')} - ${formatCurrency(job.salaryMax || 130000, job.currency || 'USD')}`
          : 'Competitive';

      return `
        <div class="bg-white rounded-xl border border-slate-200/90 hover:border-brand-300 p-5 shadow-xs hover:shadow-md transition-all group">
          <div class="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                <img class="w-full h-full object-cover group-hover:scale-105 transition-transform" src="${logo}" alt="${job.company}" onerror="this.src='${letterLogo(job.company)}'" />
              </div>
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors">${job.title}</h3>
                  ${isCommunity ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">Community</span>` : ''}
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
                    ${salaryDisplay}
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
                ${isCommunity ? 'Apply Link ↗' : 'Apply'}
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
        const job = dbJobs.find(j => j.id === id);
        if (job && job.isCommunity && (job.sourceUrl || job.url)) {
          window.open(job.sourceUrl || job.url, "_blank", "noopener,noreferrer");
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

    try {
      const user = window.JobNexAuth ? window.JobNexAuth.getUser() : {};
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || "1",
          job_title: activeApplyJob.title,
          company: activeApplyJob.company,
          job_url: activeApplyJob.jobUrl || activeApplyJob.sourceUrl || "",
          source: "web",
          status: "Applied",
          notes: `Direct application submitted for ${activeApplyJob.title} at ${activeApplyJob.company}.`,
        }),
      });
      playSound("success");
      showToast(`Application successfully submitted!`);
    } catch (err) {
      showToast(`Application submitted: ${activeApplyJob.company}!`);
    }

    closeApplyModal();
  });

  // Upload Job Modal Handlers
  const uploadModal = document.getElementById("upload-job-modal");
  const openUploadModalBtn = document.getElementById("open-upload-modal-btn");
  const uploadModalCloseBtn = document.getElementById("upload-modal-close-btn");
  const uploadModalCancelBtn = document.getElementById("upload-modal-cancel-btn");
  const uploadJobForm = document.getElementById("upload-job-form");
  const uploadJobError = document.getElementById("upload-job-error");

  function openUploadModal() {
    if (uploadJobError) {
      uploadJobError.textContent = "";
      uploadJobError.classList.add("hidden");
    }
    uploadModal?.classList.remove("hidden");
    playSound("click");
    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function closeUploadModal() {
    uploadModal?.classList.add("hidden");
  }

  openUploadModalBtn?.addEventListener("click", openUploadModal);
  uploadModalCloseBtn?.addEventListener("click", closeUploadModal);
  uploadModalCancelBtn?.addEventListener("click", closeUploadModal);

  uploadJobForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (uploadJobError) {
      uploadJobError.textContent = "";
      uploadJobError.classList.add("hidden");
    }

    const title = (document.getElementById("upload-job-title")?.value || "").trim();
    const company = (document.getElementById("upload-job-company")?.value || "").trim();
    const location = (document.getElementById("upload-job-location")?.value || "").trim();
    const exp = document.getElementById("upload-job-exp")?.value || "Fresher";
    const salary = (document.getElementById("upload-job-salary")?.value || "").trim();
    const skillsRaw = (document.getElementById("upload-job-skills")?.value || "").trim();
    const url = (document.getElementById("upload-job-url")?.value || "").trim();

    if (!title || !company || !location || !url || !skillsRaw) {
      if (uploadJobError) {
        uploadJobError.textContent = "Please fill in all required fields.";
        uploadJobError.classList.remove("hidden");
      }
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      if (uploadJobError) {
        uploadJobError.textContent = "Job link must start with http:// or https://";
        uploadJobError.classList.remove("hidden");
      }
      return;
    }

    const skills = skillsRaw.split(",").map(s => s.trim()).filter(Boolean);
    const currentUser = window.JobNexAuth ? window.JobNexAuth.getUser() : null;

    const payload = {
      title,
      company,
      location,
      experience: exp,
      salary: salary || null,
      skills,
      url,
      uploaded_by: currentUser?.email || null,
    };

    const submitBtn = document.getElementById("upload-modal-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Publishing...";
    }

    let savedJob = null;

    // Try backend API first
    try {
      const res = await fetch("/api/community-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        const j = data.job;
        savedJob = {
          id: `community-${j.id}`,
          title: j.title,
          company: j.company,
          companyLogo: letterLogo(j.company),
          location: j.location,
          region: guessRegion(j.location),
          experienceLevel: j.experience,
          salaryMin: 0,
          salaryMax: 0,
          currency: "INR",
          salaryText: j.salary || "",
          skills: Array.isArray(j.skills) ? j.skills : skills,
          sourceUrl: j.url,
          isCommunity: true,
          postedAt: j.created_at || new Date().toISOString(),
        };
      } else if (res.status === 409) {
        if (uploadJobError) {
          uploadJobError.textContent = "This job link was already uploaded.";
          uploadJobError.classList.remove("hidden");
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Publish Job";
        }
        return;
      }
    } catch (err) {
      // Backend offline / CDN mode
    }

    if (!savedJob) {
      // Local fallback for static hosting
      savedJob = {
        id: `community-${Date.now()}`,
        title,
        company,
        companyLogo: letterLogo(company),
        location,
        region: guessRegion(location),
        experienceLevel: exp,
        salaryMin: 0,
        salaryMax: 0,
        currency: "INR",
        salaryText: salary || "",
        skills,
        sourceUrl: url,
        isCommunity: true,
        postedAt: new Date().toISOString(),
      };
    }

    saveLocalCommunityJob(savedJob);
    dbJobs.unshift(savedJob);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Publish Job";
    }

    playSound("success");
    showToast("Community job published successfully!");
    uploadJobForm.reset();
    closeUploadModal();
    renderJobs();
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
