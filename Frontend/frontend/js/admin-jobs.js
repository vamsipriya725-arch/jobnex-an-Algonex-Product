/**
 * JobNex - Admin Job Management Portal Script (frontend/js/admin-jobs.js)
 * Implements:
 * 1. Role-based protection (Admin / Recruiter)
 * 2. Section A: Naukri-style Job Posting Form with tags, validation, draft/publish
 * 3. Section B: Bulk CSV upload with downloadable template, preview, and row validation
 * 4. Section C: Manage Jobs table with search, status filters, inline toggle, edit, and delete
 */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Load shared navbar & footer
  if (window.loadComponent) {
    await loadComponent("navbar-container", "../components/navbar.html");
    await loadComponent("footer-container", "../components/footer.html");
  }
  if (typeof initNav === "function") {
    initNav("admin-jobs");
  }

  // 2. Role Protection Check
  const user = window.JobNexAuth?.getUser() || { role: "JOB_SEEKER" };
  const isAdmin = user && (user.role === "ADMIN" || user.role === "RECRUITER" || (user.email && user.email.toLowerCase().includes("admin")));

  const unauthView = document.getElementById("unauthorized-view");
  const mainView = document.getElementById("admin-main-view");

  if (!isAdmin) {
    if (unauthView) unauthView.classList.remove("hidden");
    if (mainView) mainView.classList.add("hidden");

    document.getElementById("btn-switch-admin-demo")?.addEventListener("click", () => {
      window.JobNexAuth?.setUser({ ...user, role: "ADMIN", name: user.name || "Admin Recruiter" });
      window.location.reload();
    });
    return;
  }

  if (unauthView) unauthView.classList.add("hidden");
  if (mainView) mainView.classList.remove("hidden");

  // State
  let allJobs = [];
  let currentStatusFilter = "All";
  let editingJobId = null;
  let jobPendingDelete = null;
  let selectedLocations = ["Bengaluru", "Hybrid"];
  let selectedSkills = ["Python", "FastAPI", "React"];
  let bulkCsvRows = [];

  const API_BASE = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";

  // ------------------------------------------------------------------------
  // Toast Notifications
  // ------------------------------------------------------------------------
  function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold transition-all transform duration-300 translate-y-2 opacity-0 ${
      type === "error"
        ? "bg-red-900/90 text-white border-red-700 backdrop-blur-md"
        : type === "info"
        ? "bg-slate-900/90 text-white border-slate-700 backdrop-blur-md"
        : "bg-emerald-900/90 text-white border-emerald-700 backdrop-blur-md"
    }`;

    const icon = type === "error" ? "alert-circle" : type === "info" ? "info" : "check-circle";
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i><span>${message}</span>`;
    container.appendChild(toast);

    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

    setTimeout(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
    }, 10);

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ------------------------------------------------------------------------
  // Section Navigation Tabs
  // ------------------------------------------------------------------------
  const tabBtnPost = document.getElementById("tab-btn-post");
  const tabBtnBulk = document.getElementById("tab-btn-bulk");
  const tabBtnManage = document.getElementById("tab-btn-manage");

  const secPost = document.getElementById("section-post-job");
  const secBulk = document.getElementById("section-bulk-upload");
  const secManage = document.getElementById("manage-jobs-section");

  function switchTab(activeTab) {
    [tabBtnPost, tabBtnBulk, tabBtnManage].forEach(btn => {
      if (btn) {
        btn.className = "px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer flex items-center gap-2";
      }
    });

    if (secPost) secPost.classList.add("hidden");
    if (secBulk) secBulk.classList.add("hidden");

    if (activeTab === "post") {
      tabBtnPost.className = "px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-brand-600 text-white shadow-xs cursor-pointer flex items-center gap-2";
      if (secPost) secPost.classList.remove("hidden");
      secPost.scrollIntoView({ behavior: "smooth" });
    } else if (activeTab === "bulk") {
      tabBtnBulk.className = "px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-brand-600 text-white shadow-xs cursor-pointer flex items-center gap-2";
      if (secBulk) secBulk.classList.remove("hidden");
      secBulk.scrollIntoView({ behavior: "smooth" });
    } else if (activeTab === "manage") {
      tabBtnManage.className = "px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-brand-600 text-white shadow-xs cursor-pointer flex items-center gap-2";
      if (secPost) secPost.classList.remove("hidden");
      secManage.scrollIntoView({ behavior: "smooth" });
    }
  }

  tabBtnPost?.addEventListener("click", () => switchTab("post"));
  tabBtnBulk?.addEventListener("click", () => switchTab("bulk"));
  tabBtnManage?.addEventListener("click", () => switchTab("manage"));

  // ------------------------------------------------------------------------
  // Location Chips System
  // ------------------------------------------------------------------------
  const locContainer = document.getElementById("location-chips-container");
  const locInput = document.getElementById("input-location-tag");

  function renderLocations() {
    if (!locContainer || !locInput) return;
    // Clear chips but keep input
    locContainer.querySelectorAll(".location-chip").forEach(el => el.remove());

    selectedLocations.forEach((loc, idx) => {
      const chip = document.createElement("span");
      chip.className = "location-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 text-xs font-semibold";
      chip.innerHTML = `<span>${loc}</span><button type="button" data-idx="${idx}" class="remove-loc-btn text-slate-500 hover:text-red-600 font-bold">&times;</button>`;
      locContainer.insertBefore(chip, locInput);
    });

    locContainer.querySelectorAll(".remove-loc-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
        selectedLocations.splice(idx, 1);
        renderLocations();
      });
    });
  }

  function addLocation(val) {
    const clean = (val || "").trim().replace(/,/g, "");
    if (clean && !selectedLocations.some(l => l.toLowerCase() === clean.toLowerCase())) {
      selectedLocations.push(clean);
      renderLocations();
    }
  }

  locInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addLocation(locInput.value);
      locInput.value = "";
    }
  });

  document.querySelectorAll(".quick-loc-btn").forEach(btn => {
    btn.addEventListener("click", () => addLocation(btn.innerText));
  });

  renderLocations();

  // ------------------------------------------------------------------------
  // Key Skills Chips System
  // ------------------------------------------------------------------------
  const skillsContainer = document.getElementById("skills-chips-container");
  const skillInput = document.getElementById("input-skill-tag");

  function renderSkills() {
    if (!skillsContainer || !skillInput) return;
    skillsContainer.querySelectorAll(".skill-chip").forEach(el => el.remove());

    selectedSkills.forEach((skill, idx) => {
      const chip = document.createElement("span");
      chip.className = "skill-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-100 text-brand-800 text-xs font-semibold";
      chip.innerHTML = `<span>${skill}</span><button type="button" data-idx="${idx}" class="remove-skill-btn text-brand-600 hover:text-red-600 font-bold">&times;</button>`;
      skillsContainer.insertBefore(chip, skillInput);
    });

    skillsContainer.querySelectorAll(".remove-skill-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
        selectedSkills.splice(idx, 1);
        renderSkills();
      });
    });
  }

  function addSkill(val) {
    const clean = (val || "").trim().replace(/,/g, "");
    if (clean && !selectedSkills.some(s => s.toLowerCase() === clean.toLowerCase())) {
      selectedSkills.push(clean);
      renderSkills();
    }
  }

  skillInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillInput.value);
      skillInput.value = "";
    }
  });

  document.querySelectorAll(".quick-skill-btn").forEach(btn => {
    btn.addEventListener("click", () => addSkill(btn.innerText));
  });

  renderSkills();

  // Logo Preview
  const inputLogo = document.getElementById("input-logo");
  const logoPreviewBox = document.getElementById("logo-preview-box");
  inputLogo?.addEventListener("input", () => {
    const url = inputLogo.value.trim();
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      logoPreviewBox.innerHTML = `<img src="${url}" alt="Logo" class="w-full h-full object-contain" onerror="this.parentElement.innerHTML='<i data-lucide=\\'image\\' class=\\'w-4 h-4 text-slate-400\\'></i>';lucide.createIcons();" />`;
    } else {
      logoPreviewBox.innerHTML = `<i data-lucide="image" class="w-4 h-4 text-slate-400"></i>`;
      if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
    }
  });

  // Salary Not Disclosed checkbox
  const cbNotDisclosed = document.getElementById("cb-salary-not-disclosed");
  const inputSalary = document.getElementById("input-salary");
  cbNotDisclosed?.addEventListener("change", () => {
    if (cbNotDisclosed.checked) {
      inputSalary.value = "Not disclosed";
      inputSalary.disabled = true;
    } else {
      inputSalary.value = "";
      inputSalary.disabled = false;
    }
  });

  // Description character count
  const textareaDesc = document.getElementById("textarea-description");
  const charCountText = document.getElementById("char-count-text");
  textareaDesc?.addEventListener("input", () => {
    charCountText.innerText = `${textareaDesc.value.length} characters`;
  });

  // ------------------------------------------------------------------------
  // Form Submission (Save as Draft or Publish)
  // ------------------------------------------------------------------------
  async function submitJobForm(statusToSet = "Active") {
    // Clear previous errors
    ["title", "company", "locations", "skills", "description", "exp"].forEach(field => {
      const err = document.getElementById(`error-${field}`);
      if (err) {
        err.innerText = "";
        err.classList.add("hidden");
      }
    });

    const title = document.getElementById("input-title").value.trim();
    const company = document.getElementById("input-company").value.trim();
    const logo = inputLogo.value.trim();
    const department = document.getElementById("select-department").value;
    const workMode = document.getElementById("select-work-mode").value;
    const jobType = document.getElementById("select-job-type").value;
    const expMin = parseInt(document.getElementById("input-exp-min").value || "0");
    const expMax = parseInt(document.getElementById("input-exp-max").value || "0");
    const openings = parseInt(document.getElementById("input-openings").value || "1");
    const salary = cbNotDisclosed.checked ? "Not disclosed" : (inputSalary.value.trim() || "Not disclosed");
    const education = document.getElementById("input-education").value.trim() || "Any Graduate";
    const description = textareaDesc.value.trim();
    const applyLastDate = document.getElementById("input-last-date").value;
    const applyLink = document.getElementById("input-apply-link").value.trim();
    const applyEmail = document.getElementById("input-apply-email").value.trim();

    // Validation
    let hasError = false;
    if (!title) {
      showFieldError("title", "Job Title is required");
      hasError = true;
    }
    if (!company) {
      showFieldError("company", "Company Name is required");
      hasError = true;
    }
    if (selectedLocations.length === 0) {
      showFieldError("locations", "Please provide at least one location");
      hasError = true;
    }
    if (selectedSkills.length === 0) {
      showFieldError("skills", "Please add at least one key skill");
      hasError = true;
    }
    if (!description || description.length < 10) {
      showFieldError("description", "Description must be at least 10 characters");
      hasError = true;
    }
    if (expMin < 0 || expMax < 0 || (expMax > 0 && expMin > expMax)) {
      showFieldError("exp", "Invalid experience range (Min should be <= Max)");
      hasError = true;
    }

    if (hasError) {
      showToast("Please fix the highlighted form errors.", "error");
      return;
    }

    const payload = {
      title,
      company,
      company_logo: logo,
      department,
      locations: selectedLocations,
      work_mode: workMode,
      job_type: jobType,
      exp_min: expMin,
      exp_max: expMax,
      openings,
      salary_range: salary,
      key_skills: selectedSkills,
      education,
      description,
      apply_last_date: applyLastDate,
      apply_link: applyLink,
      apply_email: applyEmail,
      status: statusToSet,
    };

    try {
      const isEditing = Boolean(editingJobId);
      const url = isEditing ? `${API_BASE}/api/jobs/${editingJobId}` : `${API_BASE}/api/jobs`;
      const method = isEditing ? "PUT" : "POST";

      const headers = {
        "Content-Type": "application/json",
        "X-User-Role": "ADMIN",
        "X-User-Id": user.id || "admin",
      };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save job posting");
      }

      showToast(isEditing ? "Job posting updated successfully!" : "Job published successfully!", "success");
      resetJobForm();
      fetchAndRenderJobs();
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
    }
  }

  function showFieldError(field, msg) {
    const el = document.getElementById(`error-${field}`);
    if (el) {
      el.innerText = msg;
      el.classList.remove("hidden");
    }
  }

  document.getElementById("btn-publish")?.addEventListener("click", () => submitJobForm("Active"));
  document.getElementById("btn-save-draft")?.addEventListener("click", () => submitJobForm("Draft"));

  function resetJobForm() {
    editingJobId = null;
    document.getElementById("form-header-title").innerHTML = `
      <i data-lucide="briefcase" class="w-5 h-5 text-brand-600"></i>
      <span>Post a New Job Vacancy</span>
    `;
    document.getElementById("btn-publish-text").innerText = "Publish Job";
    document.getElementById("editing-indicator").classList.add("hidden");
    document.getElementById("job-post-form").reset();
    selectedLocations = ["Bengaluru", "Hybrid"];
    selectedSkills = ["Python", "FastAPI", "React"];
    renderLocations();
    renderSkills();
    charCountText.innerText = "0 characters";
    logoPreviewBox.innerHTML = `<i data-lucide="image" class="w-4 h-4 text-slate-400"></i>`;
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }

  document.getElementById("btn-reset-form")?.addEventListener("click", resetJobForm);
  document.getElementById("btn-cancel-edit")?.addEventListener("click", resetJobForm);

  // ------------------------------------------------------------------------
  // Section B: Bulk CSV Upload & Preview
  // ------------------------------------------------------------------------
  const dropzone = document.getElementById("csv-dropzone");
  const csvInput = document.getElementById("input-csv-file");
  const bulkPreviewWrapper = document.getElementById("bulk-preview-wrapper");
  const bulkPreviewTbody = document.getElementById("bulk-preview-tbody");
  const previewFilename = document.getElementById("preview-filename");
  const previewSummaryBadge = document.getElementById("preview-summary-badge");
  const btnImportValid = document.getElementById("btn-import-valid-jobs");

  dropzone?.addEventListener("click", () => csvInput?.click());
  dropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("border-brand-500", "bg-brand-50/40");
  });
  dropzone?.addEventListener("dragleave", () => {
    dropzone.classList.remove("border-brand-500", "bg-brand-50/40");
  });
  dropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("border-brand-500", "bg-brand-50/40");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCsvFile(e.dataTransfer.files[0]);
    }
  });

  csvInput?.addEventListener("change", () => {
    if (csvInput.files && csvInput.files[0]) {
      handleCsvFile(csvInput.files[0]);
    }
  });

  function parseCsvText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Simple CSV parser supporting quotes
    function parseLine(line) {
      const result = [];
      let insideQuote = false;
      let entry = "";
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          result.push(entry.trim());
          entry = "";
        } else {
          entry += char;
        }
      }
      result.push(entry.trim());
      return result;
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_]+/g, ""));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] || "";
      });
      rows.push(obj);
    }
    return rows;
  }

  let selectedRawFile = null;

  function handleCsvFile(file) {
    selectedRawFile = file;
    if (previewFilename) previewFilename.innerText = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCsvText(text);

      bulkCsvRows = parsed.map((r, idx) => {
        const title = r.title || r.jobtitle || "";
        const company = r.company || r.companyname || "";
        const description = r.description || r.jobdescription || "";
        const errors = [];

        if (!title) errors.push("Missing title");
        if (!company) errors.push("Missing company");
        if (!description || description.length < 5) errors.push("Short/missing description");

        return {
          rowNum: idx + 2,
          title,
          company,
          locations: r.locations || r.location || "Remote",
          exp: `${r.expmin || r.exp_min || 0} - ${r.expmax || r.exp_max || 0} yrs`,
          workMode: r.workmode || r.work_mode || "Office",
          status: r.status || "Active",
          isValid: errors.length === 0,
          errors,
        };
      });

      renderBulkPreview();
    };
    reader.readAsText(file);
  }

  function renderBulkPreview() {
    if (!bulkPreviewWrapper || !bulkPreviewTbody) return;
    bulkPreviewWrapper.classList.remove("hidden");
    bulkPreviewTbody.innerHTML = "";

    const validCount = bulkCsvRows.filter(r => r.isValid).length;
    previewSummaryBadge.innerText = `${validCount} of ${bulkCsvRows.length} Valid Rows`;

    bulkCsvRows.forEach(r => {
      const tr = document.createElement("tr");
      tr.className = r.isValid ? "hover:bg-slate-50" : "bg-red-50/50 hover:bg-red-50";
      tr.innerHTML = `
        <td class="p-3 font-semibold text-slate-500">${r.rowNum}</td>
        <td class="p-3 font-bold text-slate-900">${r.title || '<span class="text-red-500 italic">Empty</span>'}</td>
        <td class="p-3 text-slate-700">${r.company || '<span class="text-red-500 italic">Empty</span>'}</td>
        <td class="p-3 text-slate-600">${r.locations}</td>
        <td class="p-3 text-slate-600">${r.exp}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">${r.workMode}</span></td>
        <td class="p-3">
          ${r.isValid
            ? '<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Valid</span>'
            : `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-red-600"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> ${r.errors.join(", ")}</span>`
          }
        </td>
      `;
      bulkPreviewTbody.appendChild(tr);
    });

    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }

  btnImportValid?.addEventListener("click", async () => {
    if (!selectedRawFile) {
      showToast("Please choose a CSV file first.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedRawFile);

    try {
      btnImportValid.disabled = true;
      btnImportValid.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Importing...`;
      if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

      const res = await fetch(`${API_BASE}/api/jobs/bulk`, {
        method: "POST",
        headers: {
          "X-User-Role": "ADMIN",
          "X-User-Id": user.id || "admin",
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Bulk import failed");

      showToast(`Success! Imported ${data.imported_count} jobs. (${data.error_count} skipped errors)`, "success");
      bulkPreviewWrapper.classList.add("hidden");
      csvInput.value = "";
      selectedRawFile = null;
      fetchAndRenderJobs();
      switchTab("manage");
    } catch (err) {
      showToast(`Bulk upload error: ${err.message}`, "error");
    } finally {
      btnImportValid.disabled = false;
      btnImportValid.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Commit & Import Valid Jobs`;
      if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
    }
  });

  // ------------------------------------------------------------------------
  // Section C: Manage Jobs (Fetch, Search, Filter, Edit, Delete, Toggle)
  // ------------------------------------------------------------------------
  const tbody = document.getElementById("manage-jobs-tbody");
  const searchInput = document.getElementById("input-manage-search");

  async function fetchAndRenderJobs() {
    try {
      const res = await fetch(`${API_BASE}/api/jobs?status=All&limit=100`);
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      allJobs = data.jobs || [];

      updateCounts();
      renderManageTable();
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 font-medium">Failed to load jobs (${err.message})</td></tr>`;
      }
    }
  }

  function updateCounts() {
    const active = allJobs.filter(j => (j.status || "").toLowerCase() === "active").length;
    const draft = allJobs.filter(j => (j.status || "").toLowerCase() === "draft").length;
    const totalApplicants = allJobs.reduce((acc, j) => acc + (j.applicants_count || 0), 0);
    const totalOpenings = allJobs.reduce((acc, j) => acc + (j.openings || 1), 0);

    const elActive = document.getElementById("count-active");
    const elDraft = document.getElementById("count-draft");
    const elAll = document.getElementById("count-all");
    if (elActive) elActive.innerText = active;
    if (elDraft) elDraft.innerText = draft;
    if (elAll) elAll.innerText = allJobs.length;

    // Banner metrics
    const statActive = document.getElementById("stat-active-count");
    const statDraft = document.getElementById("stat-draft-count");
    const statOpenings = document.getElementById("stat-openings-count");
    const statApplicants = document.getElementById("stat-applicants-count");
    if (statActive) statActive.innerText = active;
    if (statDraft) statDraft.innerText = draft;
    if (statOpenings) statOpenings.innerText = totalOpenings;
    if (statApplicants) statApplicants.innerText = totalApplicants;
  }

  function renderManageTable() {
    if (!tbody) return;

    const query = (searchInput?.value || "").toLowerCase().trim();

    let filtered = allJobs.filter(j => {
      const matchStatus = currentStatusFilter === "All" || (j.status || "").toLowerCase() === currentStatusFilter.toLowerCase();
      const matchQuery = !query ||
        (j.title || "").toLowerCase().includes(query) ||
        (j.company || "").toLowerCase().includes(query) ||
        (j.key_skills || "").toLowerCase().includes(query) ||
        (j.locations || "").toLowerCase().includes(query);
      return matchStatus && matchQuery;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="p-12 text-center text-slate-400">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
            <p class="font-semibold text-xs text-slate-600">No jobs match your search or filter criteria.</p>
          </td>
        </tr>
      `;
      if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
      return;
    }

    tbody.innerHTML = "";
    filtered.forEach(job => {
      const isActive = (job.status || "").toLowerCase() === "active";
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50/80 transition-colors";

      const createdDate = job.created_at ? new Date(job.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Recent";

      tr.innerHTML = `
        <td class="p-3.5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 font-bold flex items-center justify-center shrink-0 border border-brand-200">
              ${(job.company || "C").charAt(0).toUpperCase()}
            </div>
            <div>
              <a href="job-details.html?id=${job.id}" target="_blank" class="font-bold text-slate-900 hover:text-brand-600 transition-colors text-xs flex items-center gap-1">
                <span>${job.title}</span>
                <i data-lucide="external-link" class="w-3 h-3 text-slate-400"></i>
              </a>
              <p class="text-[11px] text-slate-500 font-medium">${job.company} &bull; ${job.department || "General"}</p>
            </div>
          </div>
        </td>
        <td class="p-3.5">
          <p class="font-semibold text-slate-800 text-[11px]">${job.locations}</p>
          <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 mt-0.5">${job.work_mode || "Office"}</span>
        </td>
        <td class="p-3.5">
          <p class="font-semibold text-slate-800 text-[11px]">${job.exp_min || 0} - ${job.exp_max || 0} Yrs</p>
          <p class="text-[10px] text-slate-500 font-medium">${job.salary_range || "Not disclosed"}</p>
        </td>
        <td class="p-3.5">
          <button data-id="${job.id}" data-current="${job.status}" class="toggle-status-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
            isActive ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-amber-100 text-amber-800 hover:bg-amber-200"
          }">
            <span class="w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-600" : "bg-amber-600"}"></span>
            <span>${isActive ? "Active" : "Draft"}</span>
          </button>
        </td>
        <td class="p-3.5 font-semibold text-slate-700">
          <span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-bold">
            ${job.applicants_count || 0}
          </span>
        </td>
        <td class="p-3.5 text-slate-500 text-[11px] whitespace-nowrap">
          ${createdDate}
        </td>
        <td class="p-3.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button data-id="${job.id}" class="btn-edit-job p-1.5 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer" title="Edit Requisition">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button data-id="${job.id}" data-title="${job.title}" class="btn-delete-job p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete Job">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

    // Attach actions
    attachTableActions();
  }

  function attachTableActions() {
    // Toggle Status
    tbody.querySelectorAll(".toggle-status-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const current = btn.getAttribute("data-current");
        const next = current.toLowerCase() === "active" ? "Draft" : "Active";

        try {
          const res = await fetch(`${API_BASE}/api/jobs/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-User-Role": "ADMIN",
            },
            body: JSON.stringify({ status: next }),
          });
          if (!res.ok) throw new Error("Could not update status");
          showToast(`Job status switched to ${next}`, "info");
          fetchAndRenderJobs();
        } catch (e) {
          showToast(`Update error: ${e.message}`, "error");
        }
      });
    });

    // Edit Job
    tbody.querySelectorAll(".btn-edit-job").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const job = allJobs.find(j => j.id === id);
        if (!job) return;

        editingJobId = job.id;
        document.getElementById("form-header-title").innerHTML = `
          <i data-lucide="edit-3" class="w-5 h-5 text-amber-600"></i>
          <span>Edit Job Requisition (${job.id})</span>
        `;
        document.getElementById("editing-job-id-text").innerText = job.title;
        document.getElementById("editing-indicator").classList.remove("hidden");
        document.getElementById("btn-publish-text").innerText = "Save & Update";

        // Fill Form
        document.getElementById("input-title").value = job.title || "";
        document.getElementById("input-company").value = job.company || "";
        inputLogo.value = job.company_logo || "";
        document.getElementById("select-department").value = job.department || "Engineering";
        document.getElementById("select-work-mode").value = job.work_mode || "Office";
        document.getElementById("select-job-type").value = job.job_type || "Full-time";
        document.getElementById("input-exp-min").value = job.exp_min || 0;
        document.getElementById("input-exp-max").value = job.exp_max || 0;
        document.getElementById("input-openings").value = job.openings || 1;
        document.getElementById("input-education").value = job.education || "Any Graduate";
        textareaDesc.value = job.description || "";
        charCountText.innerText = `${textareaDesc.value.length} characters`;
        document.getElementById("input-last-date").value = job.apply_last_date || "";
        document.getElementById("input-apply-link").value = job.apply_link || "";
        document.getElementById("input-apply-email").value = job.apply_email || "";

        if (job.salary_range && job.salary_range.toLowerCase() === "not disclosed") {
          cbNotDisclosed.checked = true;
          inputSalary.value = "Not disclosed";
          inputSalary.disabled = true;
        } else {
          cbNotDisclosed.checked = false;
          inputSalary.value = job.salary_range || "";
          inputSalary.disabled = false;
        }

        selectedLocations = Array.isArray(job.locations_list) && job.locations_list.length > 0
          ? [...job.locations_list]
          : (job.locations ? job.locations.split(",").map(s => s.trim()) : ["Remote"]);
        renderLocations();

        selectedSkills = Array.isArray(job.skills) && job.skills.length > 0
          ? [...job.skills]
          : (job.key_skills ? job.key_skills.split(",").map(s => s.trim()) : ["Python"]);
        renderSkills();

        switchTab("post");
      });
    });

    // Delete Job
    tbody.querySelectorAll(".btn-delete-job").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const title = btn.getAttribute("data-title");
        jobPendingDelete = { id, title };

        document.getElementById("delete-modal-job-title").innerText = title;
        document.getElementById("delete-modal").classList.remove("hidden");
      });
    });
  }

  // Delete modal buttons
  document.getElementById("btn-cancel-delete")?.addEventListener("click", () => {
    document.getElementById("delete-modal").classList.add("hidden");
    jobPendingDelete = null;
  });

  document.getElementById("btn-confirm-delete")?.addEventListener("click", async () => {
    if (!jobPendingDelete) return;
    const { id } = jobPendingDelete;
    document.getElementById("delete-modal").classList.add("hidden");

    try {
      const res = await fetch(`${API_BASE}/api/jobs/${id}`, {
        method: "DELETE",
        headers: {
          "X-User-Role": "ADMIN",
        },
      });
      if (!res.ok) throw new Error("Could not delete job");
      showToast("Job posting deleted.", "info");
      fetchAndRenderJobs();
    } catch (e) {
      showToast(`Delete error: ${e.message}`, "error");
    } finally {
      jobPendingDelete = null;
    }
  });

  // Search input filter
  searchInput?.addEventListener("input", () => renderManageTable());

  // Status Filter Tabs
  document.querySelectorAll(".status-filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".status-filter-tab").forEach(t => {
        t.className = "status-filter-tab px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer";
      });
      tab.className = "status-filter-tab px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white cursor-pointer";
      currentStatusFilter = tab.getAttribute("data-status");
      renderManageTable();
    });
  });

  document.getElementById("btn-refresh-jobs")?.addEventListener("click", () => {
    fetchAndRenderJobs();
    showToast("Refreshed jobs list.", "info");
  });

  // Initial load
  fetchAndRenderJobs();
});
