/**
 * JobNex - Dashboard Page Script
 * Fetches real application records from MySQL Workbench via /api/applications
 */

document.addEventListener("DOMContentLoaded", () => {
  const userNameEl = document.getElementById("dashboard-user-name");
  const userRoleEl = document.getElementById("dashboard-user-role");
  const statTotal = document.getElementById("stat-total");
  const statApplied = document.getElementById("stat-applied");
  const statInterview = document.getElementById("stat-interview");
  const statOffered = document.getElementById("stat-offered");
  const tabsContainer = document.getElementById("dashboard-status-tabs");
  const tbody = document.getElementById("dashboard-applications-tbody");

  // Drawer Elements
  const drawerOverlay = document.getElementById("timeline-drawer-overlay");
  const closeBtn = document.getElementById("btn-close-drawer");
  const footerCloseBtn = document.getElementById("btn-drawer-footer-close");
  const drawerLogo = document.getElementById("drawer-company-logo");
  const drawerTitle = document.getElementById("drawer-job-title");
  const drawerMeta = document.getElementById("drawer-company-meta");
  const drawerBadge = document.getElementById("drawer-stage-badge");
  const drawerResume = document.getElementById("drawer-resume-filename");
  const drawerMatch = document.getElementById("drawer-match-score");
  const drawerStageButtons = document.getElementById("drawer-stage-buttons");
  const drawerEvents = document.getElementById("drawer-timeline-events");

  const user = window.JobNexAuth ? window.JobNexAuth.getUser() : { name: "Candidate", role: "JOB_SEEKER" };
  if (userNameEl) userNameEl.textContent = user.name || "Candidate Profile";
  if (userRoleEl) userRoleEl.textContent = user.role === "RECRUITER" ? "Recruiter" : "Job Seeker";

  let applications = [];
  let activeTab = "All";
  let selectedApp = null;
  let isLoading = false;

  function getStatusBadgeClass(status) {
    switch (status) {
      case "Interview":
        return "bg-brand-100 text-brand-800 border-brand-200";
      case "Applied":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Rejected":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Offered":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  }

  function updateMetrics() {
    const total = applications.length;
    const applied = applications.filter((a) => a.status === "Applied").length;
    const interview = applications.filter((a) => a.status === "Interview").length;
    const offered = applications.filter((a) => a.status === "Offered").length;
    const rejected = applications.filter((a) => a.status === "Rejected").length;

    if (statTotal) statTotal.textContent = total;
    if (statApplied) statApplied.textContent = applied;
    if (statInterview) statInterview.textContent = interview;
    if (statOffered) statOffered.textContent = offered;

    // Render tabs
    if (tabsContainer) {
      const tabs = [
        { id: "All", label: "All", count: total },
        { id: "Applied", label: "Applied", count: applied },
        { id: "Interview", label: "Interview", count: interview },
        { id: "Rejected", label: "Rejected", count: rejected },
        { id: "Offered", label: "Offered", count: offered },
      ];

      tabsContainer.innerHTML = tabs.map((tab) => `
        <button
          type="button"
          class="dash-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === tab.id
              ? "bg-brand-600 text-white shadow-xs"
              : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
          }"
          data-tab="${tab.id}"
        >
          <span>${tab.label}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
          }">
            ${tab.count}
          </span>
        </button>
      `).join("");

      tabsContainer.querySelectorAll(".dash-tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeTab = btn.getAttribute("data-tab");
          updateMetrics();
          renderTable();
        });
      });
    }
  }

  function renderTable() {
    if (!tbody) return;

    if (isLoading) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-500">
            <div class="inline-flex items-center gap-2">
              <span class="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></span>
              <span>Loading applications from MySQL Database...</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const filtered = applications.filter((app) => {
      if (activeTab === "All") return true;
      return app.status === activeTab;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-600">
            <p class="font-bold text-slate-800 text-sm">No applications found under "${activeTab}"</p>
            <p class="text-xs text-slate-400 mt-1">Applications stored in your local MySQL database will appear here.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((app) => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-4 px-6">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              <img
                src="${app.job?.companyLogo || '../assets/favicon.svg'}"
                alt="${app.job?.company || 'Company'}"
                class="w-full h-full object-cover"
                onerror="this.src='../assets/favicon.svg'"
              />
            </div>
            <span class="font-bold text-slate-900">${app.job?.company || 'Company'}</span>
          </div>
        </td>

        <td class="py-4 px-6 font-semibold text-slate-800">${app.job?.title || 'Job Role'}</td>

        <td class="py-4 px-6">
          <span class="text-[11px] font-bold px-2.5 py-1 rounded-full border ${getStatusBadgeClass(app.status)}">
            ${app.status}
          </span>
        </td>

        <td class="py-4 px-6 text-slate-600 font-medium">${app.appliedDate || 'Recent'}</td>

        <td class="py-4 px-6 font-semibold text-brand-600">${app.matchScore || 85}%</td>

        <td class="py-4 px-6 text-right">
          <button
            type="button"
            class="btn-view-app bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-bold text-xs px-3.5 py-1.5 rounded-lg border border-slate-200 transition-all inline-flex items-center gap-1 cursor-pointer"
            data-app-id="${app.id}"
          >
            <span>View</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `).join("");

    if (window.lucide) window.lucide.createIcons();

    tbody.querySelectorAll(".btn-view-app").forEach((btn) => {
      btn.addEventListener("click", () => {
        const appId = btn.getAttribute("data-app-id");
        const found = applications.find((a) => a.id === appId);
        if (found) openDrawer(found);
      });
    });
  }

  function openDrawer(app) {
    selectedApp = app;
    if (drawerLogo) drawerLogo.src = app.job?.companyLogo || "../assets/favicon.svg";
    if (drawerTitle) drawerTitle.textContent = app.job?.title || "Job Application";
    if (drawerMeta) drawerMeta.textContent = `${app.job?.company || 'Company'} • ${app.job?.location || 'Remote'}`;

    updateDrawerStageUI();

    if (drawerResume) drawerResume.textContent = app.resumeFileName || "Active_Resume.pdf";
    if (drawerMatch) drawerMatch.textContent = `${app.matchScore || 85}% Match`;

    renderTimelineEvents();

    if (drawerOverlay) drawerOverlay.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
  }

  function updateDrawerStageUI() {
    if (!selectedApp) return;

    if (drawerBadge) {
      drawerBadge.className = `text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadgeClass(selectedApp.status)}`;
      drawerBadge.textContent = selectedApp.status;
    }

    if (drawerStageButtons) {
      const stages = ["Applied", "Interview", "Offered", "Rejected"];
      drawerStageButtons.innerHTML = stages.map((st) => `
        <button
          type="button"
          class="stage-toggle-btn px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
            selectedApp.status === st
              ? "bg-brand-600 text-white"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
          }"
          data-stage="${st}"
        >
          ${st}
        </button>
      `).join("");

      drawerStageButtons.querySelectorAll(".stage-toggle-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const newStage = btn.getAttribute("data-stage");
          selectedApp.status = newStage;

          // Sync stage update to MySQL database
          try {
            await fetch(`/api/applications/${selectedApp.id}/status`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStage, notes: `Stage updated to ${newStage}` }),
            });
          } catch (err) {
            console.warn("Failed to persist status change to MySQL:", err);
          }

          // Add timeline entry
          if (!selectedApp.timeline) selectedApp.timeline = [];
          selectedApp.timeline.unshift({
            id: `evt-${Date.now()}`,
            title: `Stage updated to ${newStage}`,
            date: "Just now",
            description: `Application candidate progression status marked as ${newStage}.`,
            actor: "Recruiting Panel / System",
          });

          updateDrawerStageUI();
          renderTimelineEvents();
          updateMetrics();
          renderTable();

          if (window.JobNexUtils) {
            window.JobNexUtils.playSound("click");
            window.JobNexUtils.showToast(`Updated status to ${newStage}`, "success");
          }
        });
      });
    }
  }

  function renderTimelineEvents() {
    if (!drawerEvents || !selectedApp) return;
    const events = selectedApp.timeline || [
      {
        id: `evt-init`,
        title: `Application ${selectedApp.status}`,
        date: selectedApp.appliedDate || "Recent",
        description: selectedApp.notes || "Application active in ATS.",
        actor: "Applicant",
      }
    ];

    drawerEvents.innerHTML = events.map((evt) => `
      <div class="relative">
        <div class="absolute -left-6 top-1 w-3 h-3 rounded-full bg-brand-600 ring-4 ring-brand-100"></div>
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-900">${evt.title}</span>
            <span class="text-[10px] text-slate-700">${evt.date}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed m-0">${evt.description}</p>
          <span class="text-[10px] text-brand-600 font-semibold block">By: ${evt.actor}</span>
        </div>
      </div>
    `).join("");
  }

  function closeDrawer() {
    if (drawerOverlay) drawerOverlay.classList.add("hidden");
    selectedApp = null;
  }

  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (footerCloseBtn) footerCloseBtn.addEventListener("click", closeDrawer);
  if (drawerOverlay) {
    drawerOverlay.addEventListener("click", (e) => {
      if (e.target === drawerOverlay) closeDrawer();
    });
  }

  // Fetch live applications from MySQL database via Express API
  async function loadApplications() {
    isLoading = true;
    renderTable();

    try {
      const response = await fetch("/api/applications");
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        applications = result.data;
      } else {
        applications = [];
      }
    } catch (err) {
      console.error("Failed to load applications from API:", err);
      // Fallback to mock data only if API fails completely
      const jobsData = window.JobNexData || {};
      applications = jobsData.INITIAL_APPLICATIONS ? JSON.parse(JSON.stringify(jobsData.INITIAL_APPLICATIONS)) : [];
      if (window.JobNexUtils) {
        window.JobNexUtils.showToast("Connected via fallback mode: " + err.message, "info");
      }
    } finally {
      isLoading = false;
      updateMetrics();
      renderTable();
    }
  }

  // Initial load
  loadApplications();
});
