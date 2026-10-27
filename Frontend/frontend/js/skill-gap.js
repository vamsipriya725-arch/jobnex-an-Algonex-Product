/**
 * JobNex - Skill Gap Analysis Script
 * Dynamic Backend Integration with Database Persistence and Real-Time State Management
 */

document.addEventListener("DOMContentLoaded", () => {
  const appliedJobSelect = document.getElementById("applied-job-select");
  const quickFilterPills = document.getElementById("quick-filter-pills");
  const contextContainer = document.getElementById("selected-job-context-container");
  const userSkillsContainer = document.getElementById("user-skills-sliders");
  const missingBadgesContainer = document.getElementById("missing-skills-badges");
  const missingSubtitle = document.getElementById("missing-skills-subtitle");
  const aiTipText = document.getElementById("ai-career-tip-text");
  const coursesGrid = document.getElementById("recommended-courses-grid");
  const coursesBadge = document.getElementById("courses-count-badge");
  const coursesSubtitle = document.getElementById("courses-subtitle");
  const verifiedSkillsCount = document.getElementById("verified-skills-count");

  const jobsData = window.JobNexData || {};
  const appliedJobs = jobsData.INITIAL_APPLICATIONS || [];
  const initialSkills = jobsData.INITIAL_USER_SKILLS || [
    { id: "s-1", name: "React & Next.js", masteryPercentage: 90 },
    { id: "s-2", name: "TypeScript", masteryPercentage: 85 },
    { id: "s-3", name: "Python & Pandas", masteryPercentage: 80 },
    { id: "s-4", name: "SQL & Relational DBs", masteryPercentage: 85 },
    { id: "s-5", name: "Docker Containerization", masteryPercentage: 75 },
  ];

  let userSkills = JSON.parse(JSON.stringify(initialSkills));
  let selectedJobId = "job-2"; // default Amazon Data Scientist
  let activeStatusFilter = "ALL"; // "ALL" | "recommended" | "in_progress" | "completed"

  // Skill definitions mapped per job (without hardcoded course data)
  const JOB_SKILL_REQUIREMENTS = {
    "job-2": {
      missingSkills: [
        "Deep Learning",
        "AWS Cloud Infrastructure",
        "Data Visualization (Plotly/Seaborn)",
        "Docker & Kubernetes",
      ],
      aiTip: {
        currentScore: 74,
        projectedScore: 92,
        text: "Acquiring Deep Learning and Data Visualization will elevate your ATS resume match from 74% to 92% for Amazon Forecasting & Intelligence.",
      },
    },
    "job-1": {
      missingSkills: [
        "TypeScript",
        "Tailwind CSS",
        "Next.js App Router",
        "State Management (Zustand/Redux)",
      ],
      aiTip: {
        currentScore: 88,
        projectedScore: 98,
        text: "Mastering TypeScript and Next.js will elevate your ATS resume match from 88% to 98% for TCS Enterprise Web Engineering.",
      },
    },
    "job-3": {
      missingSkills: [
        "Kubernetes Cluster Architecture",
        "AWS & Azure Cloud DevOps",
        "CI/CD with GitHub Actions",
        "Terraform Infrastructure as Code",
      ],
      aiTip: {
        currentScore: 65,
        projectedScore: 91,
        text: "Acquiring Kubernetes and Terraform will elevate your ATS resume match from 65% to 91% for Microsoft Azure Cloud Operations.",
      },
    },
    "job-4": {
      missingSkills: [
        "System Design at Scale",
        "Distributed Microservices",
        "Java Enterprise & Concurrency",
        "Production Containerization",
      ],
      aiTip: {
        currentScore: 92,
        projectedScore: 99,
        text: "Mastering Distributed System Design and Scalable Microservices will prepare you for Google Technical Round 1 with high confidence.",
      },
    },
    "job-5": {
      missingSkills: [
        "Tableau Visual Analytics",
        "Microsoft Power BI",
        "Advanced SQL & Window Functions",
        "Data Storytelling & Executive Reports",
      ],
      aiTip: {
        currentScore: 82,
        projectedScore: 96,
        text: "Building verified dashboards in Tableau and Power BI will elevate your ATS score from 82% to 96% for Accenture Client Advisory.",
      },
    },
  };

  // State cache for dynamic backend recommendations
  const dynamicRecommendationsCache = {};
  let currentCourses = [];
  let isFetchingCourses = false;

  function getCurrentUser() {
    if (window.JobNexAuth && typeof window.JobNexAuth.getUser === "function") {
      const u = window.JobNexAuth.getUser();
      if (u && u.id) return u;
    }
    try {
      const stored = localStorage.getItem("jobnex_user");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { id: "u-1", name: "Candidate", email: "candidate@jobnex.ai" };
  }

  function getMissingSkillsForSelection() {
    // Check if user has an analysis stored in localStorage with real missing skills
    try {
      const lastAnalysis = localStorage.getItem("jobnex_last_analysis");
      if (lastAnalysis) {
        const parsed = JSON.parse(lastAnalysis);
        if (parsed && Array.isArray(parsed.missing_skills) && parsed.missing_skills.length > 0 && selectedJobId === "ANALYSIS") {
          return parsed.missing_skills;
        }
      }
    } catch (e) {}

    if (selectedJobId !== "ALL" && JOB_SKILL_REQUIREMENTS[selectedJobId]) {
      return JOB_SKILL_REQUIREMENTS[selectedJobId].missingSkills;
    }

    // ALL aggregate
    const all = Array.from(
      new Set(Object.values(JOB_SKILL_REQUIREMENTS).flatMap((d) => d.missingSkills))
    );
    return all.slice(0, 6);
  }

  function getAiTipForSelection() {
    if (selectedJobId !== "ALL" && JOB_SKILL_REQUIREMENTS[selectedJobId]) {
      return JOB_SKILL_REQUIREMENTS[selectedJobId].aiTip;
    }
    return {
      currentScore: 78,
      projectedScore: 95,
      text: "Closing missing skill gaps across your target positions will increase your interview shortlist conversion rate by over 60%.",
    };
  }

  function getCurrentApp() {
    if (selectedJobId === "ALL") return null;
    return appliedJobs.find((app) => (app.jobId === selectedJobId || app.job?.id === selectedJobId)) || appliedJobs[0];
  }

  function renderDropdownAndPills() {
    if (appliedJobSelect) {
      let optionsHtml = `<option value="ALL">All Applied Jobs (${appliedJobs.length})</option>`;
      appliedJobs.forEach((app) => {
        const jId = app.jobId || app.job?.id || app.id;
        optionsHtml += `
          <option value="${jId}" ${selectedJobId === jId ? "selected" : ""}>
            ${app.job?.title || "Role"} — ${app.job?.company || "Company"} (${app.status || "Applied"})
          </option>
        `;
      });
      appliedJobSelect.innerHTML = optionsHtml;
    }

    if (quickFilterPills) {
      let pillsHtml = `
        <span class="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
          <i data-lucide="sliders" class="w-3.5 h-3.5 text-brand-600"></i>
          <span>Filter by:</span>
        </span>
        <button
          type="button"
          class="pill-btn px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
            selectedJobId === "ALL"
              ? "bg-brand-600 text-white border-brand-600 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
          }"
          data-job-id="ALL"
        >
          All Applied Jobs (${appliedJobs.length})
        </button>
      `;

      appliedJobs.forEach((app) => {
        const jId = app.jobId || app.job?.id || app.id;
        const isSelected = selectedJobId === jId;
        pillsHtml += `
          <button
            type="button"
            class="pill-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
              isSelected
                ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }"
            data-job-id="${jId}"
          >
            <i data-lucide="building" class="w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-400"}"></i>
            <span>${app.job?.company || "Company"}: ${app.job?.title || "Role"}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${
              isSelected
                ? "bg-white/20 text-white"
                : app.status === "Interview"
                  ? "bg-emerald-50 text-emerald-700"
                  : app.status === "Rejected"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-brand-50 text-brand-700"
            }">
              ${app.status || "Applied"}
            </span>
          </button>
        `;
      });

      quickFilterPills.innerHTML = pillsHtml;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  function renderContextCard() {
    if (!contextContainer) return;
    const currentApp = getCurrentApp();

    if (!currentApp) {
      contextContainer.innerHTML = "";
      return;
    }

    contextContainer.innerHTML = `
      <div class="bg-gradient-to-r from-brand-50/70 to-accent-violet/10 border border-brand-200/80 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-lg bg-white border border-brand-200 flex items-center justify-center font-bold text-base text-brand-700 shadow-xs shrink-0">
            ${(currentApp.job?.company || "JB").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-bold text-sm sm:text-base text-slate-900 m-0">
                ${currentApp.job?.title || "Role"} at ${currentApp.job?.company || "Company"}
              </h2>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                ${currentApp.status || "Applied"}
              </span>
            </div>
            <p class="text-xs text-slate-600 mt-0.5 m-0">
              Applied on ${currentApp.appliedDate || "Recent"} • Location: ${currentApp.job?.location || "Remote"} • Experience: ${currentApp.job?.experienceLevel || "Relevant"}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <div class="text-right">
            <span class="text-[11px] font-semibold text-slate-500 block">ATS Match Score</span>
            <span id="header-ats-score" class="text-lg font-bold text-brand-600">${currentApp.matchScore}%</span>
          </div>
          <div class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
            <i data-lucide="check-circle-2" class="w-5 h-5 text-brand-600"></i>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderSliders() {
    if (!userSkillsContainer) return;
    if (verifiedSkillsCount) {
      verifiedSkillsCount.textContent = `${userSkills.length} Verified`;
    }

    let html = "";
    userSkills.forEach((skill) => {
      html += `
        <div class="space-y-2" data-skill-id="${skill.id}">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-slate-800">${skill.name}</span>
            <span class="text-brand-600 skill-percent-label">${skill.masteryPercentage}%</span>
          </div>

          <div class="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
            <div
              class="h-full bg-gradient-to-r from-brand-500 to-accent-violet rounded-full transition-all duration-300 skill-progress-bar"
              style="width: ${skill.masteryPercentage}%"
            ></div>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input
              type="range"
              min="0"
              max="100"
              value="${skill.masteryPercentage}"
              class="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 skill-range-input"
              data-skill-id="${skill.id}"
            />
            <span class="text-[10px] text-slate-700 shrink-0 font-medium">
              Drag to tune
            </span>
          </div>
        </div>
      `;
    });

    userSkillsContainer.innerHTML = html;

    // Attach listeners
    userSkillsContainer.querySelectorAll(".skill-range-input").forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const id = e.target.getAttribute("data-skill-id");
        const val = parseInt(e.target.value);
        const item = userSkills.find((s) => s.id === id);
        if (item) {
          item.masteryPercentage = val;
          const parent = slider.closest("[data-skill-id]");
          if (parent) {
            const label = parent.querySelector(".skill-percent-label");
            const bar = parent.querySelector(".skill-progress-bar");
            if (label) label.textContent = `${val}%`;
            if (bar) bar.style.width = `${val}%`;
          }
          const avg = Math.round(userSkills.reduce((acc, s) => acc + s.masteryPercentage, 0) / userSkills.length);
          const scoreEl = document.getElementById("header-ats-score");
          if (scoreEl) {
            scoreEl.textContent = `${Math.min(99, Math.max(60, avg))}%`;
          }
        }
      });
    });
  }

  // Loading skeleton state
  function renderLoadingState() {
    if (coursesBadge) {
      coursesBadge.textContent = "Loading...";
      coursesBadge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse";
    }

    if (!coursesGrid) return;

    coursesGrid.innerHTML = `
      <div class="col-span-full bg-brand-50/50 border border-brand-200/60 rounded-2xl p-6 text-center space-y-4">
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-brand-200 text-brand-700 text-xs font-bold shadow-xs">
          <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-brand-600"></i>
          <span>Connecting to AI Recommendation Engine & Database...</span>
        </div>
        <p class="text-xs text-slate-600 m-0">
          Synthesizing verified learning resources and persisting targeted recommendations for your profile.
        </p>
      </div>
      ${[1, 2, 3, 4].map(() => `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between animate-pulse space-y-4 min-h-[260px]">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="h-5 w-20 bg-slate-200 rounded-md"></div>
              <div class="h-4 w-12 bg-slate-200 rounded-md"></div>
            </div>
            <div class="h-5 w-full bg-slate-200 rounded-md"></div>
            <div class="h-5 w-3/4 bg-slate-200 rounded-md"></div>
            <div class="h-4 w-1/2 bg-slate-100 rounded-md"></div>
            <div class="flex gap-1.5 pt-2">
              <div class="h-4 w-16 bg-slate-100 rounded"></div>
              <div class="h-4 w-16 bg-slate-100 rounded"></div>
            </div>
          </div>
          <div class="pt-4 border-t border-slate-100">
            <div class="h-9 w-full bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      `).join("")}
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // Empty state
  function renderEmptyState(message = "No missing skill gaps detected for this selection.") {
    if (coursesBadge) {
      coursesBadge.textContent = "0 Available";
      coursesBadge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200";
    }

    if (!coursesGrid) return;

    coursesGrid.innerHTML = `
      <div class="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
        <div class="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
          <i data-lucide="check-circle" class="w-6 h-6"></i>
        </div>
        <h3 class="text-base font-bold text-slate-900 m-0">No Skill Gaps Detected!</h3>
        <p class="text-xs text-slate-600 max-w-md m-0">
          ${message} Your current competencies meet or exceed the target role qualifications.
        </p>
        <button
          id="btn-recheck-courses"
          class="mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>Re-analyze All Applied Roles</span>
        </button>
      </div>
    `;

    document.getElementById("btn-recheck-courses")?.addEventListener("click", () => {
      handleJobSelection("ALL");
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // Error state
  function renderErrorState(errorMessage = "Failed to load course recommendations.") {
    if (coursesBadge) {
      coursesBadge.textContent = "Error";
      coursesBadge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200";
    }

    if (!coursesGrid) return;

    coursesGrid.innerHTML = `
      <div class="col-span-full bg-rose-50/60 border border-rose-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
        <div class="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
          <i data-lucide="alert-triangle" class="w-6 h-6"></i>
        </div>
        <h3 class="text-base font-bold text-rose-900 m-0">Recommendation Service Unavailable</h3>
        <p class="text-xs text-rose-700 max-w-lg m-0">
          ${errorMessage}
        </p>
        <button
          id="btn-retry-courses"
          class="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>Retry Fetch & DB Sync</span>
        </button>
      </div>
    `;

    document.getElementById("btn-retry-courses")?.addEventListener("click", () => {
      fetchDynamicCourses(getMissingSkillsForSelection(), true);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // Update course progress status in backend & database
  async function updateStatus(courseId, newStatus) {
    const user = getCurrentUser();
    try {
      if (window.JobNexUtils && typeof window.JobNexUtils.showToast === "function") {
        window.JobNexUtils.showToast(`Updating course status to ${newStatus.replace("_", " ")}...`, "info");
      }

      const res = await fetch(`/api/resources/courses/${courseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id || "u-1", status: newStatus }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update status (${res.status})`);
      }

      // Update local item
      const item = currentCourses.find((c) => c.id === String(courseId));
      if (item) {
        item.status = newStatus;
      }

      if (window.JobNexUtils && typeof window.JobNexUtils.showToast === "function") {
        window.JobNexUtils.showToast(`Course marked as ${newStatus.replace("_", " ")}!`, "success");
      }
      renderCoursesGrid();
    } catch (err) {
      console.error("Error updating course status:", err);
      if (window.JobNexUtils && typeof window.JobNexUtils.showToast === "function") {
        window.JobNexUtils.showToast("Could not update course status in database.", "error");
      }
    }
  }

  // Render course cards grid from current dynamic courses
  function renderCoursesGrid() {
    if (!coursesGrid) return;

    let filtered = currentCourses;
    if (activeStatusFilter !== "ALL") {
      filtered = currentCourses.filter((c) => (c.status || "recommended").toLowerCase() === activeStatusFilter.toLowerCase());
    }

    if (coursesBadge) {
      coursesBadge.textContent = `${filtered.length} Available`;
      coursesBadge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200";
    }

    if (filtered.length === 0) {
      renderEmptyState(
        activeStatusFilter !== "ALL"
          ? `No courses found under status filter "${activeStatusFilter}".`
          : "No dynamic course recommendations found for these specific skills."
      );
      return;
    }

    coursesGrid.innerHTML = filtered.map((course) => {
      const status = (course.status || "recommended").toLowerCase();
      const statusBadge =
        status === "completed"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : status === "in_progress"
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-slate-50 text-slate-700 border-slate-200";

      const statusLabel =
        status === "completed" ? "Completed" : status === "in_progress" ? "In Progress" : "Recommended";

      return `
        <div
          class="bg-white rounded-xl border border-slate-200 hover:border-brand-400 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
          data-course-id="${course.id}"
        >
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-bold px-2.5 py-1 rounded-md border ${course.badgeColor || 'bg-brand-50 text-brand-700 border-brand-200'}">
                ${course.provider}
              </span>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge}">
                  ${statusLabel}
                </span>
                <div class="flex items-center gap-0.5 text-xs font-bold text-amber-700">
                  <i data-lucide="star" class="w-3 h-3 fill-amber-400 text-amber-400"></i>
                  <span>${course.rating || 4.8}</span>
                </div>
              </div>
            </div>

            <h3 class="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 m-0">
              ${course.title}
            </h3>

            <div class="flex items-center justify-between text-xs text-slate-700">
              <div class="flex items-center gap-1">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                <span>${course.duration || 'Self-paced'}</span>
              </div>
              <span class="text-[11px] font-medium text-slate-600 group-hover:text-brand-600 flex items-center gap-0.5">
                ${course.domain || 'online'}
                <i data-lucide="external-link" class="w-3 h-3 text-slate-400 group-hover:text-brand-600"></i>
              </span>
            </div>

            <div class="flex flex-wrap gap-1 pt-1">
              ${(course.skillsTargeted || [course.skill || "Skills"]).map((s) => `
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                  ${s}
                </span>
              `).join("")}
            </div>

            ${course.aiTip ? `
              <div class="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 leading-relaxed">
                <span class="font-bold text-brand-900">Focus:</span> ${course.aiTip}
              </div>
            ` : ""}
          </div>

          <div class="pt-4 mt-4 border-t border-slate-100 space-y-2">
            <a
              href="${course.url}"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start Learning on ${course.provider}</span>
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>

            <!-- Progress status updater buttons -->
            <div class="flex items-center justify-between gap-1.5 pt-1">
              <button
                type="button"
                class="btn-status-toggle flex-1 text-[10px] font-semibold py-1 px-2 rounded-lg border transition-all text-center cursor-pointer ${
                  status === 'in_progress' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }"
                data-course-id="${course.id}"
                data-new-status="in_progress"
              >
                In Progress
              </button>
              <button
                type="button"
                class="btn-status-toggle flex-1 text-[10px] font-semibold py-1 px-2 rounded-lg border transition-all text-center cursor-pointer ${
                  status === 'completed' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }"
                data-course-id="${course.id}"
                data-new-status="completed"
              >
                Completed
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Attach status toggle listeners
    coursesGrid.querySelectorAll(".btn-status-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cId = btn.getAttribute("data-course-id");
        const nextStatus = btn.getAttribute("data-new-status");
        if (cId && nextStatus) {
          updateStatus(cId, nextStatus);
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // Fetch dynamic courses directly from backend API with database persistence
  async function fetchDynamicCourses(missingSkills, forceRefresh = false) {
    if (!missingSkills || missingSkills.length === 0) {
      currentCourses = [];
      renderEmptyState("All target requirements are satisfied by your profile.");
      return;
    }

    const cacheKey = selectedJobId + "_" + missingSkills.slice().sort().join(",");
    if (!forceRefresh && dynamicRecommendationsCache[cacheKey]) {
      currentCourses = dynamicRecommendationsCache[cacheKey];
      renderCoursesGrid();
      return;
    }

    isFetchingCourses = true;
    renderLoadingState();

    const user = getCurrentUser();

    try {
      // 1. Call Backend API to compute dynamic course recommendations & persist to MySQL
      const response = await fetch("/api/resources/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id || "u-1",
          missing_skills: missingSkills,
          job_id: selectedJobId,
          use_ai: true,
          persist: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status} (${response.statusText})`);
      }

      const data = await response.json();

      if (data && Array.isArray(data.courses)) {
        currentCourses = data.courses;
        dynamicRecommendationsCache[cacheKey] = data.courses;

        // If backend returned custom AI tip
        if (data.ai_tip && data.ai_tip.text && aiTipText) {
          aiTipText.textContent = data.ai_tip.text;
        }

        renderCoursesGrid();
      } else {
        renderEmptyState("Recommendation engine returned 0 courses for these competencies.");
      }
    } catch (err) {
      console.warn("Backend dynamic fetch note:", err.message, "- Trying cached DB courses...");

      // 2. Fallback: Query saved user courses from database
      try {
        const dbRes = await fetch(`/api/resources/user/${user.id || 'u-1'}`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData && Array.isArray(dbData.courses) && dbData.courses.length > 0) {
            currentCourses = dbData.courses;
            renderCoursesGrid();
            return;
          }
        }
      } catch (dbErr) {
        console.error("DB query fallback failed:", dbErr);
      }

      renderErrorState(`Failed to fetch dynamic courses from backend: ${err.message}. Please verify the backend server is running.`);
    } finally {
      isFetchingCourses = false;
    }
  }

  function renderMissingAndCourses() {
    const missingSkills = getMissingSkillsForSelection();
    const aiTip = getAiTipForSelection();
    const currentApp = getCurrentApp();

    if (missingSubtitle) {
      missingSubtitle.textContent = currentApp
        ? `Identified based on requirements for ${currentApp.job.title} at ${currentApp.job.company}`
        : "Identified based on market requirements across all your applied jobs";
    }

    if (missingBadgesContainer) {
      missingBadgesContainer.innerHTML = missingSkills.map((s) => `
        <div class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold shadow-xs hover:bg-rose-100 transition-colors">
          <i data-lucide="alert-circle" class="w-4 h-4 text-rose-500 shrink-0"></i>
          <span>${s}</span>
        </div>
      `).join("");
    }

    if (aiTipText && aiTip) {
      aiTipText.textContent = aiTip.text;
    }

    if (coursesSubtitle) {
      coursesSubtitle.textContent = currentApp
        ? `Dynamic course recommendations persisted in database for ${currentApp.job.title} (${currentApp.job.company})`
        : "Dynamic course recommendations persisted in database to bridge competencies across all applications";
    }

    // Trigger dynamic backend computation and database save
    fetchDynamicCourses(missingSkills);
  }

  function handleJobSelection(jobId) {
    selectedJobId = jobId;
    renderDropdownAndPills();
    renderContextCard();
    renderMissingAndCourses();
    attachPillListeners();
  }

  function attachPillListeners() {
    document.querySelectorAll(".pill-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-job-id");
        if (id) handleJobSelection(id);
      });
    });
  }

  if (appliedJobSelect) {
    appliedJobSelect.addEventListener("change", (e) => {
      handleJobSelection(e.target.value);
    });
  }

  // Initial Full Render
  renderDropdownAndPills();
  renderContextCard();
  renderSliders();
  renderMissingAndCourses();
  attachPillListeners();
});
