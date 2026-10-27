/**
 * JobNex Resume Builder - Entry Flow & Dashboard Controller (Phase 2)
 * Manages:
 * - Resumes dashboard table, live search, sorting, rows-per-page, pagination
 * - Create modal (Upload Resume vs New Blank Resume cards)
 * - Drag-and-drop / Browse upload modal with 2 MB limit & client validations
 * - Real 5-stage progress tracking via polling (/api/jobs/:id)
 * - Cancel job, stage failure recovery, and blank resume fallback
 * - Rename & Delete confirmation dialogs
 */

(function (window, document) {
  "use strict";

  const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

  // Application State
  const state = {
    search: "",
    sortBy: "updated_at",
    order: "desc",
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
    activeActionMenuId: null,
    targetRenameId: null,
    targetDeleteId: null,
    currentJobId: null,
    jobPollingTimer: null,
    pendingUploadFile: null,
  };

  // DOM Elements
  const DOM = {};

  function initElements() {
    DOM.dashboardView = document.getElementById("builder-dashboard-view");
    DOM.editorView = document.getElementById("builder-editor-view");
    DOM.tableBody = document.getElementById("resumes-table-body");
    DOM.emptyState = document.getElementById("dashboard-empty-state");
    DOM.paginationSummary = document.getElementById("pagination-summary");
    DOM.paginationPages = document.getElementById("pagination-pages-container");
    DOM.btnPrev = document.getElementById("btn-pagination-prev");
    DOM.btnNext = document.getElementById("btn-pagination-next");

    DOM.searchInput = document.getElementById("dashboard-search-input");
    DOM.searchClear = document.getElementById("dashboard-search-clear");
    DOM.sortSelect = document.getElementById("dashboard-sort-select");
    DOM.rowsSelect = document.getElementById("dashboard-rows-select");

    // Modals
    DOM.modalChoice = document.getElementById("modal-create-choice");
    DOM.modalUpload = document.getElementById("modal-upload-resume");
    DOM.modalProgress = document.getElementById("modal-analysis-progress");
    DOM.modalRename = document.getElementById("modal-rename-resume");
    DOM.modalDelete = document.getElementById("modal-delete-resume");

    // Dropzone & File picker
    DOM.dropzone = document.getElementById("dropzone-area");
    DOM.filePicker = document.getElementById("resume-file-picker");
    DOM.uploadErrorBanner = document.getElementById("upload-error-banner");
    DOM.uploadErrorMessage = document.getElementById("upload-error-message");

    // Progress Elements
    DOM.progressBarFill = document.getElementById("progress-bar-fill");
    DOM.progressPercentage = document.getElementById("progress-percentage-badge");
    DOM.progressStatusLabel = document.getElementById("progress-status-label");
    DOM.progressFilename = document.getElementById("progress-filename-display");
    DOM.btnCancelJob = document.getElementById("btn-cancel-job");
    DOM.progressFailureControls = document.getElementById("progress-failure-controls");
    DOM.failedStageName = document.getElementById("failed-stage-name");
    DOM.failedErrorDetail = document.getElementById("failed-error-detail");
    DOM.btnProgressRetry = document.getElementById("btn-progress-retry");

    // Toast
    DOM.toast = document.getElementById("builder-toast");
    DOM.toastTitle = document.getElementById("builder-toast-title");
    DOM.toastMessage = document.getElementById("builder-toast-message");
  }

  // =========================================================================
  // Toast Notifications
  // =========================================================================

  function showToast(title, message, isError = false) {
    if (!DOM.toast) return;
    DOM.toastTitle.textContent = title;
    DOM.toastMessage.textContent = message;

    const iconContainer = document.getElementById("builder-toast-icon");
    if (iconContainer) {
      iconContainer.className = isError
        ? "w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"
        : "w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0";
      iconContainer.innerHTML = isError
        ? '<i data-lucide="alert-circle" class="w-4 h-4"></i>'
        : '<i data-lucide="check" class="w-4 h-4"></i>';
    }

    DOM.toast.classList.remove("hidden");
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

    setTimeout(() => {
      DOM.toast.classList.add("hidden");
    }, 4000);
  }

  // =========================================================================
  // Date & Format Helpers
  // =========================================================================

  function formatRelativeDate(isoString) {
    if (!isoString) return "Never";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;

      const now = new Date();
      const diffMs = now - d;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      if (diffDay < 7) return `${diffDay}d ago`;

      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
      return isoString;
    }
  }

  function getBadgeClass(label) {
    const l = (label || "").toLowerCase();
    if (l === "excellent") return "badge-excellent";
    if (l === "good") return "badge-good";
    if (l === "okayish") return "badge-okayish";
    return "badge-poor";
  }

  // =========================================================================
  // Dashboard Table Rendering
  // =========================================================================

  async function loadDashboard() {
    try {
      DOM.tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="py-12 text-center text-slate-400">
            <i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2"></i>
            <p class="text-xs font-medium m-0">Loading resumes...</p>
          </td>
        </tr>
      `;
      if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

      const data = await window.JobNexResumeStore.fetchResumes({
        search: state.search,
        sortBy: state.sortBy,
        order: state.order,
        page: state.page,
        perPage: state.perPage,
      });

      state.total = data.total;
      state.totalPages = data.total_pages;

      renderTable(data.resumes);
      renderPagination();
    } catch (err) {
      DOM.tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 text-center text-rose-500">
            <p class="text-xs font-bold m-0">Failed to load resumes</p>
            <p class="text-[11px] text-slate-400 m-0 mt-1">${err.message}</p>
          </td>
        </tr>
      `;
    }
  }

  function renderTable(resumes) {
    if (!resumes || resumes.length === 0) {
      DOM.tableBody.innerHTML = "";
      DOM.tableBody.closest("table").classList.add("hidden");
      DOM.emptyState.classList.remove("hidden");
      return;
    }

    DOM.tableBody.closest("table").classList.remove("hidden");
    DOM.emptyState.classList.add("hidden");

    let rowsHtml = "";
    for (const r of resumes) {
      const activeBadge = r.is_active
        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-800 border border-brand-200"><i data-lucide="check-circle" class="w-3 h-3 text-brand-600"></i>Active</span>'
        : "";

      const badgeClass = getBadgeClass(r.readiness_label);
      const scoreBadge = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}">
          <span>${r.readiness_score}%</span>
          <span>•</span>
          <span>${r.readiness_label}</span>
        </span>
      `;

      rowsHtml += `
        <tr class="resume-table-row border-b border-slate-100 relative">
          <!-- Name & Active Badge -->
          <td class="py-3.5 px-4 sm:px-6">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </div>
              <div class="space-y-0.5">
                <div class="flex items-center gap-2">
                  <button type="button" class="btn-open-editor text-xs font-bold text-slate-900 hover:text-brand-600 text-left transition-colors cursor-pointer" data-id="${r.id}">
                    ${escapeHtml(r.name)}
                  </button>
                  ${activeBadge}
                </div>
                <p class="text-[10px] text-slate-400 font-mono m-0">${r.id}</p>
              </div>
            </div>
          </td>

          <!-- Readiness Badge -->
          <td class="py-3.5 px-4">
            ${scoreBadge}
          </td>

          <!-- Updated At -->
          <td class="py-3.5 px-4 text-slate-500 font-medium">
            ${formatRelativeDate(r.updated_at)}
          </td>

          <!-- Actions -->
          <td class="py-3.5 px-4 sm:px-6 text-right">
            <div class="inline-flex items-center gap-1.5 relative">
              <button
                type="button"
                class="btn-open-editor px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                data-id="${r.id}"
              >
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                <span>Edit</span>
              </button>

              <button
                type="button"
                class="btn-quick-download p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
                title="Download"
                data-id="${r.id}"
              >
                <i data-lucide="download" class="w-4 h-4"></i>
              </button>

              <!-- More Options Menu Trigger -->
              <button
                type="button"
                class="btn-toggle-menu p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
                data-id="${r.id}"
              >
                <i data-lucide="more-vertical" class="w-4 h-4"></i>
              </button>

              <!-- Dropdown Menu -->
              <div id="action-menu-${r.id}" class="action-dropdown hidden text-left text-xs font-medium">
                ${
                  !r.is_active
                    ? `<button type="button" class="btn-menu-active w-full px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-brand-600 rounded-md flex items-center gap-2 cursor-pointer" data-id="${r.id}">
                        <i data-lucide="check" class="w-3.5 h-3.5 text-brand-600"></i>
                        <span>Make Active</span>
                      </button>`
                    : ""
                }
                <button type="button" class="btn-menu-rename w-full px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-md flex items-center gap-2 cursor-pointer" data-id="${r.id}" data-name="${escapeHtml(r.name)}">
                  <i data-lucide="edit-2" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span>Rename</span>
                </button>
                <button type="button" class="btn-menu-duplicate w-full px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-md flex items-center gap-2 cursor-pointer" data-id="${r.id}">
                  <i data-lucide="copy" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span>Duplicate</span>
                </button>
                <div class="h-px bg-slate-100 my-1"></div>
                <button type="button" class="btn-menu-delete w-full px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-md flex items-center gap-2 cursor-pointer" data-id="${r.id}" data-name="${escapeHtml(r.name)}">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5 text-rose-500"></i>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }

    DOM.tableBody.innerHTML = rowsHtml;
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

    attachTableRowListeners();
  }

  function attachTableRowListeners() {
    // Open Editor
    document.querySelectorAll(".btn-open-editor").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openEditor(id);
      });
    });

    // Toggle menu
    document.querySelectorAll(".btn-toggle-menu").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        const menu = document.getElementById(`action-menu-${id}`);
        const wasOpen = !menu.classList.contains("hidden");

        // Close any other open menus
        document.querySelectorAll(".action-dropdown").forEach((m) => m.classList.add("hidden"));

        if (!wasOpen) {
          menu.classList.remove("hidden");
          state.activeActionMenuId = id;
        } else {
          state.activeActionMenuId = null;
        }
      });
    });

    // Make Active
    document.querySelectorAll(".btn-menu-active").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        try {
          await window.JobNexResumeStore.setActiveResume(id);
          showToast("Resume Set Active", "This resume is now marked as your primary active profile.");
        } catch (e) {
          showToast("Update Failed", e.message, true);
        }
      });
    });

    // Rename
    document.querySelectorAll(".btn-menu-rename").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");
        openRenameModal(id, name);
      });
    });

    // Duplicate
    document.querySelectorAll(".btn-menu-duplicate").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        try {
          await window.JobNexResumeStore.duplicateResume(id);
          showToast("Resume Duplicated", "A copy of your resume has been created.");
        } catch (e) {
          showToast("Duplicate Failed", e.message, true);
        }
      });
    });

    // Delete
    document.querySelectorAll(".btn-menu-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");
        openDeleteModal(id, name);
      });
    });
  }

  function renderPagination() {
    const start = state.total === 0 ? 0 : (state.page - 1) * state.perPage + 1;
    const end = Math.min(state.page * state.perPage, state.total);
    DOM.paginationSummary.textContent = `Showing ${start}–${end} of ${state.total} resumes`;

    DOM.btnPrev.disabled = state.page <= 1;
    DOM.btnNext.disabled = state.page >= state.totalPages;

    let pagesHtml = "";
    for (let p = 1; p <= state.totalPages; p++) {
      if (p === state.page) {
        pagesHtml += `<button type="button" class="w-7 h-7 rounded-lg bg-brand-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">${p}</button>`;
      } else if (p === 1 || p === state.totalPages || (p >= state.page - 1 && p <= state.page + 1)) {
        pagesHtml += `<button type="button" class="btn-page-num w-7 h-7 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-xs flex items-center justify-center cursor-pointer" data-page="${p}">${p}</button>`;
      }
    }
    DOM.paginationPages.innerHTML = pagesHtml;

    document.querySelectorAll(".btn-page-num").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.page = parseInt(btn.getAttribute("data-page"), 10);
        loadDashboard();
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================================
  // Modals & User Actions
  // =========================================================================

  function openModal(el) {
    if (el) el.classList.add("is-open");
  }

  function closeModal(el) {
    if (el) el.classList.remove("is-open");
  }

  function openRenameModal(resumeId, currentName) {
    state.targetRenameId = resumeId;
    const input = document.getElementById("rename-input");
    if (input) input.value = currentName;
    openModal(DOM.modalRename);
    if (input) input.focus();
  }

  function openDeleteModal(resumeId, resumeName) {
    state.targetDeleteId = resumeId;
    const targetEl = document.getElementById("delete-resume-name-target");
    if (targetEl) targetEl.textContent = `"${resumeName}"`;
    openModal(DOM.modalDelete);
  }

  // =========================================================================
  // File Upload & 5-Stage Real Progress Tracking
  // =========================================================================

  function handleFileSelected(file) {
    if (!file) return;

    hideUploadError();

    const cleanName = file.name.toLowerCase();
    const isPdf = cleanName.endsWith(".pdf");
    const isDocx = cleanName.endsWith(".docx") || cleanName.endsWith(".doc");

    if (!isPdf && !isDocx) {
      showUploadError(
        "Unsupported File Format",
        "Only PDF (.pdf) and Word documents (.docx) are supported. Please select a valid document."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      showUploadError(
        "File Too Large",
        `Your document is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The maximum allowable file size is 2 MB.`
      );
      return;
    }

    state.pendingUploadFile = file;
    dispatchUpload(file);
  }

  function showUploadError(title, message) {
    document.getElementById("upload-error-title").textContent = title;
    DOM.uploadErrorMessage.textContent = message;
    DOM.uploadErrorBanner.classList.remove("hidden");
  }

  function hideUploadError() {
    DOM.uploadErrorBanner.classList.add("hidden");
  }

  async function dispatchUpload(file) {
    closeModal(DOM.modalUpload);

    // Setup Progress Modal
    DOM.progressFilename.textContent = file.name;
    DOM.progressBarFill.style.width = "10%";
    DOM.progressPercentage.textContent = "10%";
    DOM.progressStatusLabel.textContent = "Starting Pipeline...";
    DOM.progressFailureControls.classList.add("hidden");
    DOM.btnCancelJob.classList.remove("hidden");
    resetProgressStages();

    openModal(DOM.modalProgress);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const apiBase = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";
      const headers = {};
      const token = localStorage.getItem("jobnex_access_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const user = window.JobNexAuth?.getUser ? window.JobNexAuth.getUser() : null;
      if (user && user.id) headers["X-User-Id"] = String(user.id);

      const res = await fetch(`${apiBase}/api/resumes/upload`, {
        method: "POST",
        headers: headers,
        body: formData,
      });

      if (!res.ok) {
        let errData = {};
        try {
          errData = await res.json();
        } catch (e) {}
        throw new Error(errData.detail || `Upload failed (${res.status})`);
      }

      const jobData = await res.json();
      state.currentJobId = jobData.jobId;

      startJobPolling(jobData.jobId);
    } catch (err) {
      handleJobFailure("Structural Analysis", err.message);
    }
  }

  function resetProgressStages() {
    for (let i = 1; i <= 5; i++) {
      const item = document.getElementById(`stage-${i}`);
      if (item) {
        item.className = "stage-item pending";
        const icon = item.querySelector(".stage-icon");
        if (icon) icon.innerHTML = '<i data-lucide="circle" class="w-4 h-4 text-slate-300"></i>';
      }
    }
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }

  function updateStageUI(stageName, percent) {
    DOM.progressBarFill.style.width = `${percent}%`;
    DOM.progressPercentage.textContent = `${percent}%`;

    const stages = [
      { num: 1, name: "Structural Analysis" },
      { num: 2, name: "Entity Extraction" },
      { num: 3, name: "Career Timeline Reconstruction" },
      { num: 4, name: "Skill & Impact Profiling" },
      { num: 5, name: "ATS Scoring" },
    ];

    let currentStageIndex = stages.findIndex((s) => s.name === stageName);
    if (currentStageIndex === -1 && percent === 100) currentStageIndex = 5;

    for (let i = 0; i < stages.length; i++) {
      const el = document.getElementById(`stage-${stages[i].num}`);
      const icon = el?.querySelector(".stage-icon");
      if (!el || !icon) continue;

      if (i < currentStageIndex) {
        el.className = "stage-item completed";
        icon.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>';
      } else if (i === currentStageIndex) {
        el.className = "stage-item active";
        icon.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-brand-600"></i>';
      } else {
        el.className = "stage-item pending";
        icon.innerHTML = '<i data-lucide="circle" class="w-4 h-4 text-slate-300"></i>';
      }
    }

    DOM.progressStatusLabel.textContent = `Stage ${Math.min(currentStageIndex + 1, 5)} of 5: ${stageName}`;
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }

  function startJobPolling(jobId) {
    if (state.jobPollingTimer) clearInterval(state.jobPollingTimer);

    const apiBase = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";

    state.jobPollingTimer = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Job tracking failed");

        const statusData = await res.json();

        if (statusData.status === "processing") {
          updateStageUI(statusData.stage, statusData.percent);
        } else if (statusData.status === "completed") {
          clearInterval(state.jobPollingTimer);
          state.jobPollingTimer = null;

          // Complete all checklist stages
          for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`stage-${i}`);
            const icon = el?.querySelector(".stage-icon");
            if (el && icon) {
              el.className = "stage-item completed";
              icon.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>';
            }
          }
          DOM.progressBarFill.style.width = "100%";
          DOM.progressPercentage.textContent = "100%";
          DOM.progressStatusLabel.textContent = "Analysis Complete!";
          if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

          setTimeout(() => {
            closeModal(DOM.modalProgress);
            showToast("Resume Parsed", "Career timeline and skills extracted with zero hallucination.");
            loadDashboard();
            if (statusData.resultResumeId) {
              openEditor(statusData.resultResumeId);
            }
          }, 600);
        } else if (statusData.status === "failed") {
          clearInterval(state.jobPollingTimer);
          state.jobPollingTimer = null;
          handleJobFailure(statusData.stage, statusData.error);
        } else if (statusData.status === "cancelled") {
          clearInterval(state.jobPollingTimer);
          state.jobPollingTimer = null;
          closeModal(DOM.modalProgress);
          showToast("Job Cancelled", "Resume parsing was cancelled.", true);
        }
      } catch (err) {
        clearInterval(state.jobPollingTimer);
        state.jobPollingTimer = null;
        handleJobFailure("Network", err.message);
      }
    }, 500);
  }

  function handleJobFailure(stage, errorMsg) {
    DOM.progressBarFill.className = "bg-rose-500 h-full rounded-full transition-all";
    DOM.progressPercentage.textContent = "Failed";
    DOM.progressPercentage.className = "px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold";
    DOM.btnCancelJob.classList.add("hidden");

    DOM.failedStageName.textContent = stage || "Extraction Pipeline";
    DOM.failedErrorDetail.textContent = errorMsg || "An unexpected error occurred during document parsing.";
    DOM.progressFailureControls.classList.remove("hidden");
  }

  async function cancelCurrentJob() {
    if (!state.currentJobId) {
      closeModal(DOM.modalProgress);
      return;
    }

    try {
      const apiBase = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";
      await fetch(`${apiBase}/api/jobs/${state.currentJobId}/cancel`, { method: "POST" });
    } catch (e) {
      // Ignore
    }

    if (state.jobPollingTimer) {
      clearInterval(state.jobPollingTimer);
      state.jobPollingTimer = null;
    }

    closeModal(DOM.modalProgress);
    showToast("Cancelled", "Resume upload cancelled and temporary files removed.");
  }

  // =========================================================================
  // Phase 3: Editor Layout, Live Preview & Resizer Engine
  // =========================================================================

  function openEditor(resumeId) {
    window.JobNexResumeStore.loadResume(resumeId)
      .then((resume) => {
        // Toggle view from Dashboard to Editor
        DOM.dashboardView.classList.add("hidden");
        DOM.editorView.classList.remove("hidden");

        populateEditorInputs(resume);
        renderResumePreview(resume);
        updateUndoRedoUI();
        updateSaveStatusUI(window.JobNexResumeStore.saveStatus);

        showToast("Resume Loaded", `Ready to edit "${resume.name}"`);
      })
      .catch((err) => {
        showToast("Error", err.message, true);
      });
  }

  function closeEditor() {
    window.JobNexResumeStore.saveNow();
    DOM.editorView.classList.add("hidden");
    DOM.dashboardView.classList.remove("hidden");
    loadDashboard();
  }

  function populateEditorInputs(resume) {
    if (!resume) return;

    // Header title
    const titleInput = document.getElementById("editor-resume-title-input");
    if (titleInput) titleInput.value = resume.name || "Untitled Resume";

    // Active status button
    const activeBtn = document.getElementById("btn-toggle-active-status");
    if (activeBtn) {
      if (resume.is_active) {
        activeBtn.className = "text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-800 border border-brand-200 flex items-center gap-1 cursor-default";
        activeBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-brand-600"></i><span>Active Resume</span>';
      } else {
        activeBtn.className = "text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 border border-slate-200 transition-colors cursor-pointer";
        activeBtn.innerHTML = '<span>Make Active</span>';
      }
    }

    // Sidebar ATS badge
    const atsBadge = document.getElementById("sidebar-ats-badge");
    if (atsBadge) {
      atsBadge.textContent = `${resume.readiness_score || 0}%`;
      const label = resume.readiness_label || "Poor";
      if (label === "Excellent") atsBadge.className = "absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white";
      else if (label === "Good") atsBadge.className = "absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500 text-white";
      else if (label === "Okayish") atsBadge.className = "absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950";
      else atsBadge.className = "absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white";
    }

    // Personal info inputs
    const p = resume.personal || {};
    const nameInp = document.getElementById("inp-personal-name");
    const emailInp = document.getElementById("inp-personal-email");
    const phoneInp = document.getElementById("inp-personal-phone");
    const locInp = document.getElementById("inp-personal-location");
    const sumInp = document.getElementById("inp-personal-summary");

    if (nameInp) nameInp.value = p.name || "";
    if (emailInp) emailInp.value = p.email || "";
    if (phoneInp) phoneInp.value = p.phone || "";
    if (locInp) locInp.value = p.location || "";
    if (sumInp) sumInp.value = resume.summary || "";

    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }

  function switchEditorTab(tabKey) {
    document.querySelectorAll(".sidebar-tab-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tabKey);
    });

    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.classList.add("hidden");
    });

    const activePane = document.getElementById(`pane-${tabKey}`);
    if (activePane) activePane.classList.remove("hidden");
  }

  /**
   * High-Fidelity Live Resume Preview Renderer
   * CRITICAL ZERO-PLACEHOLDER RULE:
   * NEVER renders empty placeholders like "[Location]" or "[Employment Type]".
   * Hides empty fields and empty/hidden sections completely.
   */
  function renderResumePreview(resume) {
    const sheet = document.getElementById("resume-preview-sheet");
    if (!sheet || !resume) return;

    const t = resume.templateSettings || {
      fontFamily: "Plus Jakarta Sans",
      fontSize: 10.5,
      lineHeight: 1.45,
      sectionGap: 16,
      itemSpacing: 10,
      paddingTop: 24,
      paddingBottom: 24,
      paddingSide: 28,
      primaryColor: "#2e3049",
      headingStyle: "bold",
    };

    // Apply templateSettings styles
    sheet.style.fontFamily = `"${t.fontFamily}", Inter, sans-serif`;
    sheet.style.fontSize = `${t.fontSize}pt`;
    sheet.style.lineHeight = `${t.lineHeight}`;
    sheet.style.padding = `${t.paddingTop}px ${t.paddingSide}px ${t.paddingBottom}px ${t.paddingSide}px`;
    sheet.style.color = "#1f2937";

    const primaryColor = t.primaryColor || "#2e3049";
    const headingTransform = t.headingStyle === "uppercase" ? "uppercase" : "none";
    const headingDecoration = t.headingStyle === "underline" ? "border-b border-slate-300 pb-1" : "";

    let html = "";

    // 1. Header (Candidate Name & Contact Info)
    const p = resume.personal || {};
    const candidateName = p.name ? p.name.trim() : "";

    html += `<div class="preview-header text-center" style="margin-bottom: ${t.sectionGap}px;">`;
    if (candidateName) {
      html += `<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight m-0" style="color: ${primaryColor};">${escapeHtml(candidateName)}</h1>`;
    }

    // Build contact elements array, omitting any empty attributes
    const contactParts = [];
    if (p.email && p.email.trim()) {
      contactParts.push(`<a href="mailto:${escapeHtml(p.email.trim())}" class="hover:underline text-slate-700">${escapeHtml(p.email.trim())}</a>`);
    }
    if (p.phone && p.phone.trim()) {
      contactParts.push(`<span class="text-slate-700">${escapeHtml(p.phone.trim())}</span>`);
    }
    if (p.location && p.location.trim()) {
      contactParts.push(`<span class="text-slate-700">${escapeHtml(p.location.trim())}</span>`);
    }
    if (p.links && Array.isArray(p.links)) {
      p.links.forEach((l) => {
        if (l.url && l.url.trim()) {
          const label = l.label && l.label.trim() ? l.label.trim() : "Portfolio";
          contactParts.push(`<a href="${escapeHtml(l.url.trim())}" target="_blank" rel="noopener" class="hover:underline text-brand-700 font-medium">${escapeHtml(label)}</a>`);
        }
      });
    }

    if (contactParts.length > 0) {
      html += `<div class="text-[9.5pt] text-slate-600 mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">${contactParts.join(' <span class="text-slate-300">•</span> ')}</div>`;
    }
    html += `</div>`;

    // 2. Summary Section (Omitted entirely if empty)
    if (resume.summary && resume.summary.trim()) {
      html += `
        <div class="preview-summary-section" style="margin-bottom: ${t.sectionGap}px;">
          <h2 class="text-xs font-bold tracking-wider mb-1.5 ${headingDecoration}" style="color: ${primaryColor}; text-transform: ${headingTransform};">
            Professional Summary
          </h2>
          <p class="text-[9.5pt] text-slate-700 leading-relaxed m-0 text-justify">
            ${escapeHtml(resume.summary.trim())}
          </p>
        </div>
      `;
    }

    // 3. Sections
    const sections = resume.sections || [];
    for (const sec of sections) {
      if (sec.hidden) continue;

      const visibleItems = (sec.items || []).filter((i) => !i.hidden);
      // Zero-placeholder: If section has no visible items and no text, hide the section header
      if (visibleItems.length === 0) continue;

      html += `<div class="preview-section" style="margin-bottom: ${t.sectionGap}px;">`;
      html += `
        <h2 class="text-xs font-bold tracking-wider mb-2 ${headingDecoration} border-b border-slate-200 pb-1" style="color: ${primaryColor}; text-transform: ${headingTransform};">
          ${escapeHtml(sec.title || "Section")}
        </h2>
      `;

      html += `<div class="space-y-[${t.itemSpacing}px]" style="display: flex; flex-direction: column; gap: ${t.itemSpacing}px;">`;

      for (const itm of visibleItems) {
        html += `<div class="preview-item">`;

        // Item Header Line: Title & Organization on left, Dates & Location on right
        const hasTitle = itm.title && itm.title.trim();
        const hasOrg = itm.organization && itm.organization.trim();
        const hasDates = itm.dates && itm.dates.trim();
        const hasLoc = itm.location && itm.location.trim();

        if (hasTitle || hasOrg || hasDates || hasLoc) {
          html += `<div class="flex flex-col sm:flex-row sm:items-baseline justify-between text-[9.5pt] leading-snug">`;
          html += `<div class="font-bold text-slate-900">`;
          if (hasTitle) html += `<span>${escapeHtml(itm.title.trim())}</span>`;
          if (hasTitle && hasOrg) html += `<span class="text-slate-400 font-normal"> | </span>`;
          if (hasOrg) html += `<span class="text-slate-700 font-semibold">${escapeHtml(itm.organization.trim())}</span>`;
          html += `</div>`;

          if (hasDates || hasLoc) {
            html += `<div class="text-[9pt] text-slate-500 font-medium whitespace-nowrap">`;
            if (hasDates) html += `<span>${escapeHtml(itm.dates.trim())}</span>`;
            if (hasDates && hasLoc) html += `<span>, </span>`;
            if (hasLoc) html += `<span>${escapeHtml(itm.location.trim())}</span>`;
            html += `</div>`;
          }
          html += `</div>`;
        }

        // Item Bullets
        const validBullets = (itm.bullets || []).filter((b) => b && typeof b === "string" && b.trim());
        if (validBullets.length > 0) {
          html += `<ul class="list-disc pl-4 text-[9.5pt] text-slate-700 space-y-1 mt-1.5 leading-relaxed">`;
          for (const bullet of validBullets) {
            html += `<li>${escapeHtml(bullet.trim())}</li>`;
          }
          html += `</ul>`;
        }

        // Technologies tags / list
        const validTech = (itm.technologies || []).filter((tc) => tc && typeof tc === "string" && tc.trim());
        if (validTech.length > 0) {
          html += `<div class="text-[8.5pt] text-slate-500 mt-1.5">`;
          html += `<strong class="text-slate-700 font-semibold">Key Skills:</strong> ${validTech.map(escapeHtml).join(", ")}`;
          html += `</div>`;
        }

        html += `</div>`; // end item
      }

      html += `</div>`; // end items container
      html += `</div>`; // end section
    }

    sheet.innerHTML = html;

    // Recalculate Page Count & Breaks
    updatePageIndicatorAndBreaks();
  }

  function updatePageIndicatorAndBreaks() {
    const sheet = document.getElementById("resume-preview-sheet");
    const indicator = document.getElementById("preview-page-indicator");
    if (!sheet || !indicator) return;

    const A4_HEIGHT_PX = 1123;
    const scrollHeight = sheet.scrollHeight;

    // Remove any existing page break indicator
    sheet.querySelectorAll(".page-break-indicator").forEach((el) => el.remove());

    if (scrollHeight > A4_HEIGHT_PX + 20) {
      const pageCount = Math.ceil(scrollHeight / A4_HEIGHT_PX);
      indicator.textContent = `Page 1 of ${pageCount}`;

      // Insert visual page break indicator
      const breakEl = document.createElement("div");
      breakEl.className = "page-break-indicator";
      sheet.appendChild(breakEl);
    } else {
      indicator.textContent = "Page 1 of 1";
    }
  }

  function updateUndoRedoUI() {
    if (DOM.btnPreviewUndo) {
      DOM.btnPreviewUndo.disabled = !window.JobNexResumeStore.canUndo();
    }
    if (DOM.btnPreviewRedo) {
      DOM.btnPreviewRedo.disabled = !window.JobNexResumeStore.canRedo();
    }
  }

  function updateSaveStatusUI(statusText) {
    if (!DOM.toolbarSaveStatus) return;
    const text = statusText || "Saved";

    if (text === "Saving...") {
      DOM.toolbarSaveStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span><span>Saving...</span>';
      DOM.toolbarSaveStatus.className = "inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200";
    } else if (text === "Unsaved") {
      DOM.toolbarSaveStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span><span>Unsaved changes</span>';
      DOM.toolbarSaveStatus.className = "inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200";
    } else if (text === "Error") {
      DOM.toolbarSaveStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>Save error</span>';
      DOM.toolbarSaveStatus.className = "inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200";
    } else {
      DOM.toolbarSaveStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>Saved</span>';
      DOM.toolbarSaveStatus.className = "inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200";
    }
  }

  // =========================================================================
  // Resizer and Panel Collapse Logic
  // =========================================================================

  function initSplitResizer() {
    const resizer = document.getElementById("editor-resizer-bar");
    const middlePanel = document.getElementById("editor-middle-panel");
    if (!resizer || !middlePanel) return;

    let isDragging = false;

    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isDragging = true;
      resizer.classList.add("is-dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const sidebarWidth = 72;
      const newWidth = Math.max(360, Math.min(e.clientX - sidebarWidth, 760));
      middlePanel.style.flex = `0 0 ${newWidth}px`;
      middlePanel.style.width = `${newWidth}px`;
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        resizer.classList.remove("is-dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });

    // Collapse Middle Panel Toggle
    const btnCollapse = document.getElementById("btn-collapse-middle");
    const btnToggleEditor = document.getElementById("btn-toggle-editor-collapse");
    const labelToggle = document.getElementById("btn-toggle-collapse-label");

    function toggleMiddleCollapse() {
      const isCollapsed = middlePanel.classList.toggle("is-collapsed");
      if (labelToggle) {
        labelToggle.textContent = isCollapsed ? "Show Editor" : "Full Preview";
      }
      updatePageIndicatorAndBreaks();
    }

    if (btnCollapse) btnCollapse.addEventListener("click", toggleMiddleCollapse);
    if (btnToggleEditor) btnToggleEditor.addEventListener("click", toggleMiddleCollapse);
  }

  // =========================================================================
  // Event Bindings
  // =========================================================================

  function bindEvents() {
    // Open choice modal
    document.getElementById("btn-open-create-modal")?.addEventListener("click", () => {
      openModal(DOM.modalChoice);
    });
    document.getElementById("empty-btn-upload")?.addEventListener("click", () => {
      openModal(DOM.modalUpload);
    });
    document.getElementById("empty-btn-blank")?.addEventListener("click", async () => {
      try {
        const created = await window.JobNexResumeStore.createResume({ name: "My Professional Resume" });
        showToast("Resume Created", "Blank ATS resume created.");
        openEditor(created.id);
      } catch (e) {
        showToast("Creation Failed", e.message, true);
      }
    });

    // Close choice modal
    document.getElementById("btn-close-choice-modal")?.addEventListener("click", () => {
      closeModal(DOM.modalChoice);
    });

    // Choice card actions
    document.getElementById("choice-card-upload")?.addEventListener("click", () => {
      closeModal(DOM.modalChoice);
      hideUploadError();
      openModal(DOM.modalUpload);
    });
    document.getElementById("choice-card-blank")?.addEventListener("click", async () => {
      closeModal(DOM.modalChoice);
      try {
        const created = await window.JobNexResumeStore.createResume({ name: "My Professional Resume" });
        showToast("Resume Created", "Blank ATS resume canvas created.");
        openEditor(created.id);
      } catch (e) {
        showToast("Creation Failed", e.message, true);
      }
    });

    // Close upload modal
    document.getElementById("btn-close-upload-modal")?.addEventListener("click", () => {
      closeModal(DOM.modalUpload);
    });
    document.getElementById("btn-upload-cancel")?.addEventListener("click", () => {
      closeModal(DOM.modalUpload);
    });

    // Dropzone events
    DOM.dropzone?.addEventListener("click", () => {
      DOM.filePicker?.click();
    });
    document.getElementById("btn-browse-trigger")?.addEventListener("click", () => {
      DOM.filePicker?.click();
    });

    DOM.dropzone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      DOM.dropzone.classList.add("drag-over");
    });
    DOM.dropzone?.addEventListener("dragleave", () => {
      DOM.dropzone.classList.remove("drag-over");
    });
    DOM.dropzone?.addEventListener("drop", (e) => {
      e.preventDefault();
      DOM.dropzone.classList.remove("drag-over");
      if (e.dataTransfer?.files?.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    DOM.filePicker?.addEventListener("change", (e) => {
      if (e.target.files?.length > 0) {
        handleFileSelected(e.target.files[0]);
      }
    });

    // Upload error banner actions
    document.getElementById("btn-error-dismiss")?.addEventListener("click", hideUploadError);
    document.getElementById("btn-error-blank-fallback")?.addEventListener("click", async () => {
      closeModal(DOM.modalUpload);
      try {
        const created = await window.JobNexResumeStore.createResume({ name: "My Professional Resume" });
        showToast("Blank Resume Created", "Started with fresh layout.");
        openEditor(created.id);
      } catch (e) {
        showToast("Error", e.message, true);
      }
    });

    // Cancel Job
    DOM.btnCancelJob?.addEventListener("click", cancelCurrentJob);

    // Retry job
    DOM.btnProgressRetry?.addEventListener("click", () => {
      if (state.pendingUploadFile) {
        dispatchUpload(state.pendingUploadFile);
      } else {
        closeModal(DOM.modalProgress);
        openModal(DOM.modalUpload);
      }
    });
    document.getElementById("btn-progress-blank-fallback")?.addEventListener("click", async () => {
      closeModal(DOM.modalProgress);
      try {
        const created = await window.JobNexResumeStore.createResume({ name: "My Professional Resume" });
        showToast("Blank Resume Created", "Started with fresh layout.");
        openEditor(created.id);
      } catch (e) {
        showToast("Error", e.message, true);
      }
    });

    // Rename Modal Actions
    document.getElementById("btn-close-rename-modal")?.addEventListener("click", () => {
      closeModal(DOM.modalRename);
    });
    document.getElementById("btn-rename-cancel")?.addEventListener("click", () => {
      closeModal(DOM.modalRename);
    });
    document.getElementById("btn-rename-submit")?.addEventListener("click", async () => {
      const input = document.getElementById("rename-input");
      const newName = input?.value?.trim();
      if (!newName) return;

      try {
        await window.JobNexResumeStore.renameResume(state.targetRenameId, newName);
        closeModal(DOM.modalRename);
        showToast("Renamed", `Resume renamed to "${newName}".`);
      } catch (e) {
        showToast("Rename Failed", e.message, true);
      }
    });

    // Delete Modal Actions
    document.getElementById("btn-close-delete-modal")?.addEventListener("click", () => {
      closeModal(DOM.modalDelete);
    });
    document.getElementById("btn-delete-cancel")?.addEventListener("click", () => {
      closeModal(DOM.modalDelete);
    });
    document.getElementById("btn-delete-confirm")?.addEventListener("click", async () => {
      if (!state.targetDeleteId) return;
      try {
        await window.JobNexResumeStore.deleteResume(state.targetDeleteId);
        closeModal(DOM.modalDelete);
        showToast("Deleted", "Resume was permanently deleted.");
      } catch (e) {
        showToast("Delete Failed", e.message, true);
      }
    });

    // Toast Close
    document.getElementById("builder-toast-close")?.addEventListener("click", () => {
      DOM.toast?.classList.add("hidden");
    });

    // Search Input with Debounce
    let searchTimeout = null;
    DOM.searchInput?.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      DOM.searchClear?.classList.toggle("hidden", val.length === 0);

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.search = val;
        state.page = 1;
        loadDashboard();
      }, 300);
    });

    DOM.searchClear?.addEventListener("click", () => {
      DOM.searchInput.value = "";
      DOM.searchClear.classList.add("hidden");
      state.search = "";
      state.page = 1;
      loadDashboard();
    });

    // Sort select
    DOM.sortSelect?.addEventListener("change", (e) => {
      const [sortBy, order] = e.target.value.split(":");
      state.sortBy = sortBy;
      state.order = order;
      state.page = 1;
      loadDashboard();
    });

    // Rows per page select
    DOM.rowsSelect?.addEventListener("change", (e) => {
      state.perPage = parseInt(e.target.value, 10);
      state.page = 1;
      loadDashboard();
    });

    // Pagination Buttons
    DOM.btnPrev?.addEventListener("click", () => {
      if (state.page > 1) {
        state.page--;
        loadDashboard();
      }
    });
    DOM.btnNext?.addEventListener("click", () => {
      if (state.page < state.totalPages) {
        state.page++;
        loadDashboard();
      }
    });

    // Dismiss open dropdowns on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".action-dropdown") && !e.target.closest(".btn-toggle-menu")) {
        document.querySelectorAll(".action-dropdown").forEach((m) => m.classList.add("hidden"));
        state.activeActionMenuId = null;
      }
    });

    // -----------------------------------------------------------------------
    // Phase 3 Event Listeners
    // -----------------------------------------------------------------------

    // Back to Dashboard
    document.getElementById("btn-sidebar-back")?.addEventListener("click", () => {
      closeEditor();
    });

    // Sidebar Tab Switching
    document.querySelectorAll(".sidebar-tab-btn[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        switchEditorTab(tab);
      });
    });

    // Rename title inline in editor header
    const editorTitleInput = document.getElementById("editor-resume-title-input");
    editorTitleInput?.addEventListener("change", async (e) => {
      const cur = window.JobNexResumeStore.currentResume;
      if (!cur) return;
      const newName = e.target.value.trim() || "Untitled Resume";
      try {
        await window.JobNexResumeStore.renameResume(cur.id, newName);
        showToast("Renamed", `Resume title updated.`);
      } catch (err) {
        showToast("Rename Failed", err.message, true);
      }
    });

    // Toggle active status in editor header
    document.getElementById("btn-toggle-active-status")?.addEventListener("click", async () => {
      const cur = window.JobNexResumeStore.currentResume;
      if (!cur || cur.is_active) return;
      try {
        await window.JobNexResumeStore.setActiveResume(cur.id);
        populateEditorInputs(window.JobNexResumeStore.currentResume);
        showToast("Active Resume", `Marked "${cur.name}" as your active resume.`);
      } catch (err) {
        showToast("Update Failed", err.message, true);
      }
    });

    // Two-Way Sync for Personal Info Inputs
    document.getElementById("inp-personal-name")?.addEventListener("input", (e) => {
      window.JobNexResumeStore.updatePersonalInfo("name", e.target.value);
    });
    document.getElementById("inp-personal-email")?.addEventListener("input", (e) => {
      window.JobNexResumeStore.updatePersonalInfo("email", e.target.value);
    });
    document.getElementById("inp-personal-phone")?.addEventListener("input", (e) => {
      window.JobNexResumeStore.updatePersonalInfo("phone", e.target.value);
    });
    document.getElementById("inp-personal-location")?.addEventListener("input", (e) => {
      window.JobNexResumeStore.updatePersonalInfo("location", e.target.value);
    });
    document.getElementById("inp-personal-summary")?.addEventListener("input", (e) => {
      window.JobNexResumeStore.updateSummary(e.target.value);
    });

    // Preview Toolbar: Undo / Redo
    document.getElementById("btn-preview-undo")?.addEventListener("click", () => {
      window.JobNexResumeStore.undo();
    });
    document.getElementById("btn-preview-redo")?.addEventListener("click", () => {
      window.JobNexResumeStore.redo();
    });

    // Keyboard Shortcuts: Ctrl+Z / Ctrl+Y
    window.addEventListener("keydown", (e) => {
      // Don't intercept when focus is in textarea or standard text inputs unless Ctrl
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (window.JobNexResumeStore.canUndo()) {
          e.preventDefault();
          window.JobNexResumeStore.undo();
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        if (window.JobNexResumeStore.canRedo()) {
          e.preventDefault();
          window.JobNexResumeStore.redo();
        }
      }
    });

    // Fit to single page switch
    document.getElementById("toggle-fit-single-page")?.addEventListener("change", (e) => {
      const sheet = document.getElementById("resume-preview-sheet");
      if (sheet) {
        sheet.classList.toggle("fit-single-page", e.target.checked);
        updatePageIndicatorAndBreaks();
      }
    });

    // Export PDF
    document.getElementById("btn-export-pdf")?.addEventListener("click", () => {
      window.print();
    });

    // Initialize Split Resizer
    initSplitResizer();

    // Store Event Subscriptions
    window.JobNexResumeStore.subscribe((event) => {
      if (
        event.type === "resumes_loaded" ||
        event.type === "resume_renamed" ||
        event.type === "active_changed" ||
        event.type === "resume_deleted"
      ) {
        renderTable(window.JobNexResumeStore.resumes);
      }

      // Live re-render of resume preview and editor controls
      if (
        event.type === "state_changed" ||
        event.type === "undo" ||
        event.type === "redo" ||
        event.type === "resume_loaded"
      ) {
        if (window.JobNexResumeStore.currentResume) {
          renderResumePreview(window.JobNexResumeStore.currentResume);
          populateEditorInputs(window.JobNexResumeStore.currentResume);
        }
      }

      if (event.type === "save_status" || event.type === "saved" || event.type === "save_error" || event.type === "state_changed") {
        updateSaveStatusUI(window.JobNexResumeStore.saveStatus);
      }

      updateUndoRedoUI();
    });
  }

  // =========================================================================
  // Initialize
  // =========================================================================

  document.addEventListener("DOMContentLoaded", () => {
    initElements();
    bindEvents();
    loadDashboard();
  });

  window.JobNexResumeBuilder = {
    loadDashboard,
    openEditor,
  };
})(window, document);
