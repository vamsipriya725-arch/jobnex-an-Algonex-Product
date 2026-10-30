/**
 * JobNex - Auto Apply Page Script
 */

document.addEventListener("DOMContentLoaded", () => {
  const notifContainer = document.getElementById("auto-apply-notification");
  const notifText = document.getElementById("auto-apply-notif-text");
  const toggleBtn = document.getElementById("btn-toggle-autoapply");
  const statusText = document.getElementById("auto-apply-status-text");
  const roleSelect = document.getElementById("auto-role-select");
  const regionSelect = document.getElementById("auto-region-select");
  const expSelect = document.getElementById("auto-exp-select");
  const matchSlider = document.getElementById("auto-match-slider");
  const matchDisplay = document.getElementById("match-threshold-display");
  const hintText = document.getElementById("threshold-hint-text");
  const runBatchBtn = document.getElementById("btn-run-batch-now");
  const quotaDisplay = document.getElementById("quota-count-display");
  const quotaProgressBar = document.getElementById("quota-progress-bar");
  const lastScanDisplay = document.getElementById("last-scan-display");
  const logsTbody = document.getElementById("auto-apply-logs-tbody");
  const eventsBadge = document.getElementById("events-count-badge");

  const jobsData = window.JobNexData || {};
  const user = window.JobNexAuth ? window.JobNexAuth.getUser() : {};
  const attachedResumeNameEl = document.getElementById("attached-resume-name");
  if (attachedResumeNameEl && user.resumeFileName) {
    attachedResumeNameEl.textContent = user.resumeFileName;
  }
  let isEnabled = true;
  let appliedTodayCount = 8;
  const maxDaily = 15;
  let minMatch = 80;
  let isRunning = false;

  let logs = jobsData.INITIAL_AUTO_APPLY_LOGS ? JSON.parse(JSON.stringify(jobsData.INITIAL_AUTO_APPLY_LOGS)) : [
    {
      id: "log-1",
      jobTitle: "Frontend Engineer (React/TypeScript)",
      company: "TCS",
      matchScore: 88,
      status: "APPLIED",
      timestamp: "10:14 AM",
      reason: "Met target criteria & threshold (88% > 80%)",
    },
    {
      id: "log-2",
      jobTitle: "Full-Stack Web Developer",
      company: "RemoteBase",
      matchScore: 86,
      status: "APPLIED",
      timestamp: "09:30 AM",
      reason: "Met target criteria & threshold (86% > 80%)",
    },
    {
      id: "log-3",
      jobTitle: "Cloud DevOps Engineer",
      company: "Microsoft",
      matchScore: 65,
      status: "SKIPPED",
      timestamp: "08:15 AM",
      reason: "Score 65% below minimum 80% threshold",
    },
  ];

  function updateToggleUI() {
    if (!toggleBtn || !statusText) return;
    if (isEnabled) {
      statusText.textContent = "Auto-Apply Active";
      toggleBtn.className = "w-12 h-6 rounded-full transition-colors p-1 flex items-center bg-emerald-500 justify-end cursor-pointer";
      if (runBatchBtn) runBatchBtn.disabled = isRunning;
    } else {
      statusText.textContent = "Auto-Apply Paused";
      toggleBtn.className = "w-12 h-6 rounded-full transition-colors p-1 flex items-center bg-slate-300 justify-start cursor-pointer";
      if (runBatchBtn) runBatchBtn.disabled = true;
    }
  }

  function updateQuotaUI() {
    if (quotaDisplay) quotaDisplay.textContent = `${appliedTodayCount} / ${maxDaily}`;
    if (quotaProgressBar) {
      const perc = Math.min(100, Math.round((appliedTodayCount / maxDaily) * 100));
      quotaProgressBar.style.width = `${perc}%`;
    }
  }

  function renderLogs() {
    if (!logsTbody) return;
    if (eventsBadge) eventsBadge.textContent = `${logs.length} events logged`;

    logsTbody.innerHTML = logs.map((log) => `
      <tr class="hover:bg-slate-50/70 transition-colors">
        <td class="py-3 px-4 font-mono text-[11px] text-slate-700">${log.timestamp}</td>
        <td class="py-3 px-4 font-bold text-slate-900">
          ${log.jobTitle} • <span class="font-semibold text-slate-600">${log.company}</span>
        </td>
        <td class="py-3 px-4 font-semibold text-brand-600">${log.matchScore}%</td>
        <td class="py-3 px-4">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
            log.status === "APPLIED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }">
            ${log.status === "APPLIED" ? "Auto-Applied" : "Skipped"}
          </span>
        </td>
        <td class="py-3 px-4 text-slate-700 text-[11px]">${log.reason || "Met target criteria & threshold"}</td>
      </tr>
    `).join("");
  }

  function showNotification(msg) {
    if (!notifContainer || !notifText) return;
    notifText.textContent = msg;
    notifContainer.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      notifContainer.classList.add("hidden");
    }, 4500);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isEnabled = !isEnabled;
      updateToggleUI();
      if (window.JobNexUtils) {
        window.JobNexUtils.playSound("click");
        window.JobNexUtils.showToast(isEnabled ? "Auto-Apply resumed" : "Auto-Apply paused", "info");
      }
    });
  }

  if (matchSlider) {
    matchSlider.addEventListener("input", (e) => {
      minMatch = parseInt(e.target.value);
      if (matchDisplay) matchDisplay.textContent = `Min ${minMatch}%`;
      if (hintText) hintText.textContent = `System evaluates listings against minimum ${minMatch}% match threshold.`;
    });
  }

  if (runBatchBtn) {
    runBatchBtn.addEventListener("click", () => {
      if (isRunning || !isEnabled) return;
      isRunning = true;
      runBatchBtn.disabled = true;
      runBatchBtn.innerHTML = `
        <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        <span>Scanning & Auto-Applying...</span>
      `;

      setTimeout(() => {
        isRunning = false;
        runBatchBtn.disabled = false;
        runBatchBtn.innerHTML = `
          <i data-lucide="play" class="w-4 h-4 fill-white"></i>
          <span>Review & Run Auto-Apply Batch Now</span>
        `;
        if (window.lucide) window.lucide.createIcons();

        // Increment count
        appliedTodayCount = Math.min(maxDaily, appliedTodayCount + 2);
        updateQuotaUI();
        if (lastScanDisplay) lastScanDisplay.textContent = "Last Scan: Just now";

        // Prepend new mock logs
        logs.unshift({
          id: `log-${Date.now()}`,
          jobTitle: `${roleSelect ? roleSelect.value : "Software Engineer"}`,
          company: "Accenture",
          matchScore: 92,
          status: "APPLIED",
          timestamp: "Just now",
          reason: `Matched ${regionSelect ? regionSelect.value : "Global"} criteria (${minMatch}% threshold)`,
        });

        // Persist application
        const appPayload = {
          user_id: user?.email || user?.id || "1",
          user_email: user?.email || "",
          user_name: user?.name || "",
          job_title: roleSelect ? roleSelect.value : "Software Engineer",
          company: "Accenture",
          job_url: "https://accenture.com/careers/jobnex-auto-apply",
          source: "auto_apply",
          status: "Applied",
          notes: `Auto-applied with ${minMatch}% match threshold (${user.name || "Candidate"} - ${user.email || ""}).`,
        };
        fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appPayload),
        }).catch(() => {});

        renderLogs();
        if (window.JobNexUtils) window.JobNexUtils.playSound("success");
        showNotification(
          `Auto-apply queue processed! Applications saved successfully!`
        );
      }, 1400);
    });
  }

  // Initial load
  updateToggleUI();
  updateQuotaUI();
  renderLogs();
});
