/**
 * JobNex — Admin Jobs Page Logic
 * Handles: Post/Edit Job form, Bulk CSV Upload, Manage Jobs table.
 * Requires admin role (X-User-Role: ADMIN header sent on all write requests).
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Config                                                               */
  /* ------------------------------------------------------------------ */
  const API = window.location.port === "8000"
    ? ""
    : "http://" + (window.location.hostname || "127.0.0.1") + ":8000";

  const BASE = `${API}/api/jobs-board`;

  /* ------------------------------------------------------------------ */
  /* Auth helpers                                                         */
  /* ------------------------------------------------------------------ */
  function getRole() {
    return (window.JobNexAuth?.getUser()?.role || "").toUpperCase();
  }
  function isAdmin() {
    return getRole() === "ADMIN";
  }
  function adminHeaders() {
    return { "Content-Type": "application/json", "X-User-Role": "ADMIN" };
  }

  /* ------------------------------------------------------------------ */
  /* Toast / utility                                                      */
  /* ------------------------------------------------------------------ */
  function toast(msg, type = "success") {
    if (typeof showToast === "function") showToast(msg, type);
  }
  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function show(id) { document.getElementById(id)?.classList.remove("hidden"); }
  function hide(id) { document.getElementById(id)?.classList.add("hidden"); }
  function val(id) { return (document.getElementById(id)?.value || "").trim(); }

  /* ------------------------------------------------------------------ */
  /* Stats                                                                */
  /* ------------------------------------------------------------------ */
  async function loadStats() {
    try {
      const res = await fetch(`${BASE}/stats`, { headers: { "X-User-Role": "ADMIN" } });
      if (!res.ok) return;
      const data = await res.json();
      setText("stat-active",  data.active  ?? "–");
      setText("stat-draft",   data.draft   ?? "–");
      setText("stat-expired", data.expired ?? "–");
    } catch (_) {}
  }
  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  /* ================================================================== */
  /* TABS                                                                 */
  /* ================================================================== */
  function initTabs() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll("#panel-post,#panel-bulk,#panel-manage").forEach(p => p.classList.add("hidden"));
        show(`panel-${tab}`);
        if (typeof lucide !== "undefined") lucide.createIcons();
        if (tab === "manage") {
          manageState.page = 1;
          fetchManageJobs();
        }
      });
    });
  }

  /* ================================================================== */
  /* SECTION A — POST / EDIT JOB FORM                                    */
  /* ================================================================== */

  let skillsList = [];

  function initForm() {
    // Skills tag input
    const skillsInput = document.getElementById("f-skills-input");
    skillsInput?.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === ",") && skillsInput.value.trim()) {
        e.preventDefault();
        addSkill(skillsInput.value.trim().replace(/,$/, ""));
        skillsInput.value = "";
      }
    });

    // Publish button
    document.getElementById("job-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitJob("active");
    });

    // Save as Draft
    document.getElementById("btn-save-draft")?.addEventListener("click", () => {
      submitJob("draft");
    });

    // Reset
    document.getElementById("form-reset-btn")?.addEventListener("click", resetForm);
  }

  function addSkill(skill) {
    if (!skill || skillsList.includes(skill)) return;
    skillsList.push(skill);
    renderSkillPills();
  }

  function removeSkill(skill) {
    skillsList = skillsList.filter(s => s !== skill);
    renderSkillPills();
  }

  function renderSkillPills() {
    const wrapper = document.getElementById("skills-tag-wrapper");
    const input   = document.getElementById("f-skills-input");
    if (!wrapper || !input) return;

    // Remove existing pills (keep the input)
    wrapper.querySelectorAll(".skill-pill").forEach(el => el.remove());

    const frag = document.createDocumentFragment();
    skillsList.forEach(skill => {
      const pill = document.createElement("span");
      pill.className = "skill-pill";
      pill.innerHTML = `${esc(skill)}<button type="button" aria-label="Remove ${esc(skill)}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
      pill.querySelector("button").addEventListener("click", () => removeSkill(skill));
      frag.appendChild(pill);
    });
    wrapper.insertBefore(frag, input);
  }

  function getFormData(statusOverride) {
    const locRaw = val("f-locations");
    const locations = locRaw ? locRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

    return {
      title:          val("f-title"),
      company:        val("f-company"),
      company_logo:   val("f-logo"),
      locations,
      work_mode:      val("f-work-mode"),
      job_type:       val("f-job-type"),
      exp_min:        parseInt(document.getElementById("f-exp-min")?.value || "0", 10) || 0,
      exp_max:        parseInt(document.getElementById("f-exp-max")?.value || "5", 10) || 5,
      salary_label:   val("f-salary") || "Not disclosed",
      skills:         [...skillsList],
      education:      val("f-education"),
      department:     val("f-department"),
      openings:       parseInt(document.getElementById("f-openings")?.value || "1", 10) || 1,
      description:    val("f-description"),
      apply_last_date: val("f-last-date"),
      apply_link:     val("f-apply-link"),
      apply_email:    val("f-apply-email"),
      status:         statusOverride || val("f-status") || "active",
    };
  }

  function validateForm(data) {
    const errors = [];
    if (!data.title)   errors.push("Job Title is required.");
    if (!data.company) errors.push("Company Name is required.");
    if (!data.description) errors.push("Job Description is required.");
    if (data.exp_max < data.exp_min) errors.push("Max experience must be ≥ Min experience.");
    if (data.apply_link && !isValidUrl(data.apply_link)) errors.push("Apply Link must be a valid URL.");
    if (data.apply_email && !isValidEmail(data.apply_email)) errors.push("Apply Email must be valid.");
    return errors;
  }

  function isValidUrl(s) { try { new URL(s); return true; } catch (_) { return false; } }
  function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

  function showFormErrors(errors) {
    const el = document.getElementById("form-errors");
    if (!el) return;
    if (!errors.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
    el.classList.remove("hidden");
    el.innerHTML = errors.map(e => `<p>• ${esc(e)}</p>`).join("");
  }

  async function submitJob(statusOverride) {
    const data = getFormData(statusOverride);
    const errors = validateForm(data);
    showFormErrors(errors);
    if (errors.length) return;

    const editId = document.getElementById("edit-job-id")?.value || "";
    const isEdit = !!editId;
    const publishBtn = document.getElementById("btn-publish-text");
    if (publishBtn) publishBtn.textContent = isEdit ? "Saving..." : "Publishing...";

    try {
      const url    = isEdit ? `${BASE}/${editId}` : BASE;
      const method = isEdit ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: adminHeaders(), body: JSON.stringify(data) });
      const json   = await res.json();
      if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);

      toast(isEdit ? "Job updated successfully!" : (statusOverride === "draft" ? "Job saved as draft." : "Job published successfully!"), "success");
      resetForm();
      loadStats();
    } catch (err) {
      toast(err.message || "Failed to save job.", "error");
    } finally {
      if (publishBtn) publishBtn.textContent = "Publish Job";
    }
  }

  function resetForm() {
    document.getElementById("job-form")?.reset();
    document.getElementById("edit-job-id").value = "";
    skillsList = [];
    renderSkillPills();
    showFormErrors([]);
    document.getElementById("form-section-title").innerHTML = '<i data-lucide="plus-circle" class="w-5 h-5 text-brand-600"></i> Post a New Job';
    document.getElementById("btn-publish-text").textContent = "Publish Job";
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  function prefillForm(job) {
    // Switch to Post tab
    document.querySelector('[data-tab="post"]')?.click();

    document.getElementById("edit-job-id").value     = job.id || "";
    document.getElementById("f-title").value         = job.title || "";
    document.getElementById("f-company").value       = job.company || "";
    document.getElementById("f-logo").value          = job.company_logo || "";
    document.getElementById("f-locations").value     = (job.locations || []).join(", ");
    document.getElementById("f-work-mode").value     = job.work_mode || "Office";
    document.getElementById("f-job-type").value      = job.job_type || "Full-time";
    document.getElementById("f-status").value        = job.status || "active";
    document.getElementById("f-exp-min").value       = job.exp_min ?? 0;
    document.getElementById("f-exp-max").value       = job.exp_max ?? 5;
    document.getElementById("f-salary").value        = job.salary_label === "Not disclosed" ? "" : (job.salary_label || "");
    document.getElementById("f-openings").value      = job.openings ?? 1;
    document.getElementById("f-education").value     = job.education || "";
    document.getElementById("f-department").value    = job.department || "";
    document.getElementById("f-apply-link").value    = job.apply_link || "";
    document.getElementById("f-apply-email").value   = job.apply_email || "";
    document.getElementById("f-last-date").value     = job.apply_last_date || "";
    document.getElementById("f-description").value   = job.description || "";

    skillsList = [...(job.skills || [])];
    renderSkillPills();
    showFormErrors([]);

    document.getElementById("form-section-title").innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-brand-600"></i> Edit Job`;
    document.getElementById("btn-publish-text").textContent = "Save Changes";
    if (typeof lucide !== "undefined") lucide.createIcons();

    // Scroll to form
    document.getElementById("panel-post")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ================================================================== */
  /* SECTION B — BULK UPLOAD                                              */
  /* ================================================================== */

  let bulkRows = [];
  let bulkValidRows = [];
  let bulkInvalidRows = [];

  function initBulkUpload() {
    const input = document.getElementById("bulk-file-input");
    const zone  = document.getElementById("bulk-dropzone");
    const browseLink = document.getElementById("bulk-browse-link");

    browseLink?.addEventListener("click", () => input?.click());
    zone?.addEventListener("click", () => input?.click());
    zone?.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("border-brand-400"); });
    zone?.addEventListener("dragleave", () => zone.classList.remove("border-brand-400"));
    zone?.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("border-brand-400");
      const file = e.dataTransfer?.files?.[0];
      if (file) handleBulkFile(file);
    });
    input?.addEventListener("change", () => { if (input.files?.[0]) handleBulkFile(input.files[0]); });

    document.getElementById("bulk-clear-btn")?.addEventListener("click", clearBulkPreview);
    document.getElementById("btn-import")?.addEventListener("click", importBulk);
    document.getElementById("bulk-download-template")?.addEventListener("click", downloadTemplate);
  }

  function downloadTemplate() {
    const header = "title,company,company_logo,locations,work_mode,job_type,exp_min,exp_max,salary_label,skills,education,department,openings,description,apply_last_date,apply_link,apply_email";
    const sample = "Senior React Developer,Algonex Technologies,,Bangalore;Remote,Remote,Full-time,3,6,₹18-28 LPA,React;TypeScript;Node.js,B.Tech CS,Engineering,2,Looking for a skilled React developer.,2026-12-31,https://algonex.team/careers,";
    const blob   = new Blob([header + "\n" + sample], { type: "text/csv" });
    const a      = document.createElement("a");
    a.href       = URL.createObjectURL(blob);
    a.download   = "jobnex_jobs_template.csv";
    a.click();
  }

  function handleBulkFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      toast("Only .csv or .xlsx files are supported.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        if (ext === "csv") {
          parseCSV(ev.target.result);
        } else {
          toast("Excel files require the xlsx library. Please use CSV format.", "error");
        }
      } catch (err) {
        toast("Failed to parse file: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast("CSV must have a header row and at least one data row.", "error"); return; }

    const headers = lines[0].split(",").map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCSVLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => { row[h] = (cells[idx] || "").trim(); });
      rows.push(row);
    }
    bulkRows = rows;
    validateBulkRows(rows);
    renderBulkPreview(headers, rows);
  }

  function splitCSVLine(line) {
    const result = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === "," && !inQ) { result.push(cur); cur = ""; }
      else { cur += line[i]; }
    }
    result.push(cur);
    return result;
  }

  function validateBulkRows(rows) {
    bulkValidRows   = [];
    bulkInvalidRows = [];
    rows.forEach((row, i) => {
      const errors = [];
      if (!row.title)   errors.push("Missing title");
      if (!row.company) errors.push("Missing company");
      if (errors.length) {
        bulkInvalidRows.push({ index: i + 1, errors });
      } else {
        bulkValidRows.push(row);
      }
    });
  }

  function renderBulkPreview(headers, rows) {
    const head = document.getElementById("bulk-preview-head");
    const body = document.getElementById("bulk-preview-body");
    if (!head || !body) return;

    head.innerHTML = `<tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}<th>Status</th></tr>`;

    body.innerHTML = rows.slice(0, 100).map((row, i) => {
      const isValid = !bulkInvalidRows.find(e => e.index === i + 1);
      const statusCell = isValid
        ? `<td><span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">✓ OK</span></td>`
        : `<td><span class="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">✗ Error</span></td>`;
      return `<tr class="${isValid ? "" : "bg-rose-50/50"}">${headers.map(h => `<td title="${esc(row[h])}">${esc(row[h])}</td>`).join("")}${statusCell}</tr>`;
    }).join("");

    // Row error list
    const errSection = document.getElementById("bulk-errors-section");
    const errList    = document.getElementById("bulk-errors-list");
    if (bulkInvalidRows.length) {
      errSection?.classList.remove("hidden");
      errList.innerHTML = bulkInvalidRows.map(e => `<li>Row ${e.index}: ${e.errors.join(", ")}</li>`).join("");
    } else {
      errSection?.classList.add("hidden");
    }

    setText("bulk-row-count",   `(${rows.length} rows)`);
    setText("bulk-valid-count", bulkValidRows.length);
    show("bulk-preview-section");
    hide("bulk-result");
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  function clearBulkPreview() {
    bulkRows = []; bulkValidRows = []; bulkInvalidRows = [];
    hide("bulk-preview-section");
    hide("bulk-result");
    const inp = document.getElementById("bulk-file-input");
    if (inp) inp.value = "";
  }

  async function importBulk() {
    if (!bulkValidRows.length) { toast("No valid rows to import.", "error"); return; }

    const importBtn = document.getElementById("btn-import");
    if (importBtn) importBtn.textContent = "Importing...";

    // Normalize rows
    const payload = bulkValidRows.map(row => ({
      ...row,
      locations: row.locations ? row.locations.split(";").map(s => s.trim()).filter(Boolean) : [],
      skills:    row.skills    ? row.skills.split(";").map(s => s.trim()).filter(Boolean)    : [],
      exp_min:   parseInt(row.exp_min  || "0", 10) || 0,
      exp_max:   parseInt(row.exp_max  || "5", 10) || 5,
      openings:  parseInt(row.openings || "1", 10) || 1,
    }));

    try {
      const res  = await fetch(`${BASE}/bulk`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ rows: payload }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);

      const resultEl = document.getElementById("bulk-result");
      resultEl.className = "rounded-xl p-4 border text-sm font-semibold " + (json.skipped > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800");
      resultEl.innerHTML = `✓ Imported ${json.imported} job${json.imported !== 1 ? "s" : ""} successfully. ${json.skipped ? `<span class="text-amber-700">${json.skipped} skipped.</span>` : ""}`;
      show("bulk-result");
      clearBulkPreview();
      loadStats();
      toast(`${json.imported} jobs imported!`, "success");
    } catch (err) {
      const resultEl = document.getElementById("bulk-result");
      resultEl.className = "rounded-xl p-4 border text-sm font-semibold bg-rose-50 border-rose-200 text-rose-800";
      resultEl.textContent = "Import failed: " + err.message;
      show("bulk-result");
      toast("Import failed: " + err.message, "error");
    } finally {
      if (importBtn) importBtn.textContent = "Import Valid Rows";
    }
  }

  /* ================================================================== */
  /* SECTION C — MANAGE JOBS                                              */
  /* ================================================================== */

  const manageState = {
    jobs: [], total: 0, page: 1, perPage: 20, totalPages: 1,
    search: "", status: "all",
  };

  let deleteJobId   = null;
  let deleteJobName = "";

  function initManage() {
    document.getElementById("manage-refresh-btn")?.addEventListener("click", () => {
      manageState.page = 1;
      fetchManageJobs();
    });

    let searchTimer;
    document.getElementById("manage-search")?.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        manageState.search = e.target.value.trim();
        manageState.page   = 1;
        fetchManageJobs();
      }, 350);
    });

    document.getElementById("manage-status-filter")?.addEventListener("change", (e) => {
      manageState.status = e.target.value;
      manageState.page   = 1;
      fetchManageJobs();
    });

    document.getElementById("manage-prev")?.addEventListener("click", () => {
      if (manageState.page > 1) { manageState.page--; fetchManageJobs(); }
    });
    document.getElementById("manage-next")?.addEventListener("click", () => {
      if (manageState.page < manageState.totalPages) { manageState.page++; fetchManageJobs(); }
    });

    // Delete confirm
    document.getElementById("confirm-cancel")?.addEventListener("click", hideConfirm);
    document.getElementById("confirm-delete")?.addEventListener("click", doDelete);
    document.getElementById("confirm-overlay")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) hideConfirm();
    });
  }

  async function fetchManageJobs() {
    show("manage-loading");
    hide("manage-empty");
    document.getElementById("manage-table-body").innerHTML = "";

    const q = new URLSearchParams({ page: manageState.page, per_page: manageState.perPage, sort: "newest" });
    if (manageState.search) q.set("search", manageState.search);
    if (manageState.status && manageState.status !== "all") q.set("status", manageState.status);
    else if (manageState.status === "all") q.set("status", "all");

    try {
      const res  = await fetch(`${BASE}?${q}`, { headers: { "X-User-Role": "ADMIN" } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);
      manageState.jobs       = json.data || [];
      manageState.total      = json.total || 0;
      manageState.totalPages = json.total_pages || 1;
      renderManageTable();
    } catch (err) {
      document.getElementById("manage-table-body").innerHTML = `<tr><td colspan="7" class="text-center py-10 text-xs text-rose-500">${esc(err.message)}</td></tr>`;
    } finally {
      hide("manage-loading");
    }
  }

  function renderManageTable() {
    const body = document.getElementById("manage-table-body");
    if (!body) return;

    if (!manageState.jobs.length) {
      show("manage-empty");
      body.innerHTML = "";
      hide("manage-pagination");
      if (typeof lucide !== "undefined") lucide.createIcons();
      return;
    }
    hide("manage-empty");

    body.innerHTML = manageState.jobs.map(job => {
      const locs   = (job.locations || []).slice(0, 2).join(", ") || "–";
      const exp    = job.exp_min === job.exp_max ? `${job.exp_min} yrs` : `${job.exp_min}–${job.exp_max} yrs`;
      const posted = job.created_at ? new Date(job.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "–";
      const badgeCls = {
        "active":  "status-badge-active",
        "draft":   "status-badge-draft",
        "expired": "status-badge-expired",
      }[job.status] || "status-badge-draft";

      const applicants = job.applicant_count ? `<span class="ml-1 text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-full">${job.applicant_count} applied</span>` : "";

      return `
        <tr class="manage-row border-b border-slate-100" data-id="${esc(job.id)}">
          <td class="px-4 py-3">
            <p class="text-xs font-bold text-slate-900 truncate max-w-[200px]">${esc(job.title)}${applicants}</p>
            <p class="text-[10px] text-slate-500 truncate">${esc(job.company)}</p>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCls}">${esc(job.status)}</span>
          </td>
          <td class="px-4 py-3 text-[11px] text-slate-600">${esc(job.job_type || "–")}</td>
          <td class="px-4 py-3 text-[11px] text-slate-600 max-w-[120px] truncate">${esc(locs)}</td>
          <td class="px-4 py-3 text-[11px] text-slate-600">${esc(exp)}</td>
          <td class="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">${esc(posted)}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-1.5">
              <!-- Toggle Active/Draft -->
              <button class="manage-toggle-btn text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${job.status === "active" ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}"
                data-id="${esc(job.id)}" data-status="${esc(job.status)}">
                ${job.status === "active" ? "Deactivate" : "Activate"}
              </button>
              <!-- Edit -->
              <button class="manage-edit-btn text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 transition-all cursor-pointer flex items-center gap-1"
                data-id="${esc(job.id)}">
                <i data-lucide="edit-3" class="w-3 h-3"></i> Edit
              </button>
              <!-- Delete -->
              <button class="manage-del-btn text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-all cursor-pointer flex items-center gap-1"
                data-id="${esc(job.id)}" data-name="${esc(job.title)} @ ${esc(job.company)}">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join("");

    // Wire buttons
    body.querySelectorAll(".manage-edit-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          const res  = await fetch(`${BASE}/${id}`);
          const json = await res.json();
          if (json.success) prefillForm(json.data);
        } catch (_) { toast("Failed to load job.", "error"); }
      });
    });

    body.querySelectorAll(".manage-del-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        deleteJobId   = btn.dataset.id;
        deleteJobName = btn.dataset.name;
        setText("confirm-job-name", deleteJobName);
        show("confirm-overlay");
      });
    });

    body.querySelectorAll(".manage-toggle-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const cur = btn.dataset.status;
        const next = cur === "active" ? "draft" : "active";
        try {
          const res = await fetch(`${BASE}/${id}`, { method: "PUT", headers: adminHeaders(), body: JSON.stringify({ status: next }) });
          if (!res.ok) throw new Error("Failed");
          toast(`Job ${next === "active" ? "activated" : "deactivated"}.`, "success");
          fetchManageJobs();
          loadStats();
        } catch (_) { toast("Toggle failed.", "error"); }
      });
    });

    // Pagination
    renderManagePagination();
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  function renderManagePagination() {
    const pag = document.getElementById("manage-pagination");
    const pi  = document.getElementById("manage-page-info");
    const prev = document.getElementById("manage-prev");
    const next = document.getElementById("manage-next");
    if (!pag) return;
    if (manageState.totalPages <= 1) { pag.classList.add("hidden"); return; }
    pag.classList.remove("hidden");
    if (pi)   pi.textContent  = `Page ${manageState.page} of ${manageState.totalPages}`;
    if (prev) prev.disabled   = manageState.page <= 1;
    if (next) next.disabled   = manageState.page >= manageState.totalPages;
  }

  function hideConfirm() {
    hide("confirm-overlay");
    deleteJobId = null;
    deleteJobName = "";
  }

  async function doDelete() {
    if (!deleteJobId) return;
    try {
      const res = await fetch(`${BASE}/${deleteJobId}`, { method: "DELETE", headers: { "X-User-Role": "ADMIN" } });
      if (!res.ok) throw new Error("Delete failed");
      toast("Job deleted.", "success");
      hideConfirm();
      fetchManageJobs();
      loadStats();
    } catch (_) {
      toast("Delete failed.", "error");
      hideConfirm();
    }
  }

  /* ================================================================== */
  /* INIT                                                                 */
  /* ================================================================== */
  document.addEventListener("DOMContentLoaded", async () => {
    await loadComponent("navbar-container", "../components/navbar.html");
    await loadComponent("footer-container", "../components/footer.html");
    initNav("admin-jobs");

    // Check admin role
    if (!isAdmin()) {
      show("access-denied");
      hide("admin-main");
      if (typeof lucide !== "undefined") lucide.createIcons();
      return;
    }

    show("admin-main");
    initTabs();
    initForm();
    initBulkUpload();
    initManage();
    loadStats();

    if (typeof lucide !== "undefined") lucide.createIcons();
  });
})();
