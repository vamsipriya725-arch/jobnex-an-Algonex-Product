/**
 * JobNex - Skill Gap Analysis Script
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

  const JOB_SPECIFIC_DATA = {
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
      courses: [
        {
          id: "ds-1",
          title: "Deep Learning Specialization with PyTorch & TensorFlow",
          provider: "Coursera",
          domain: "coursera.org",
          rating: 4.9,
          reviewCount: 14200,
          duration: "16 weeks",
          url: "https://www.coursera.org/specializations/deep-learning",
          skillsTargeted: ["Deep Learning", "Neural Networks"],
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        },
        {
          id: "ds-2",
          title: "Machine Learning A-Z: Python & Scikit-Learn Hands-On",
          provider: "Udemy",
          domain: "udemy.com",
          rating: 4.8,
          reviewCount: 28900,
          duration: "44h",
          url: "https://www.udemy.com/course/machinelearning/",
          skillsTargeted: ["Machine Learning", "Python"],
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
        },
        {
          id: "ds-3",
          title: "AWS Certified Machine Learning Specialty (MLS-C01)",
          provider: "Coursera",
          domain: "coursera.org",
          rating: 4.7,
          reviewCount: 5400,
          duration: "12 weeks",
          url: "https://www.coursera.org/learn/aws-machine-learning",
          skillsTargeted: ["AWS", "Cloud Computing"],
          badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
        },
        {
          id: "ds-4",
          title: "Data Visualization & Dashboards with Python & Plotly",
          provider: "edX",
          domain: "edx.org",
          rating: 4.6,
          reviewCount: 3800,
          duration: "6 weeks",
          url: "https://www.edx.org/learn/data-visualization",
          skillsTargeted: ["Data Visualization", "Python"],
          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        },
      ],
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
      courses: [
        {
          id: "fe-1",
          title: "React & Next.js: The Complete Guide (incl. App Router)",
          provider: "Udemy",
          domain: "udemy.com",
          rating: 4.9,
          reviewCount: 32000,
          duration: "38h",
          url: "https://www.udemy.com/course/react-the-complete-guide-incl-redux/",
          skillsTargeted: ["React", "Next.js"],
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
        },
        {
          id: "fe-2",
          title: "Understanding TypeScript - 2025 Edition",
          provider: "Udemy",
          domain: "udemy.com",
          rating: 4.9,
          reviewCount: 19500,
          duration: "15h",
          url: "https://www.udemy.com/course/understanding-typescript/",
          skillsTargeted: ["TypeScript", "JavaScript"],
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        },
        {
          id: "fe-3",
          title: "Meta Front-End Developer Professional Certificate",
          provider: "Coursera",
          domain: "coursera.org",
          rating: 4.8,
          reviewCount: 24000,
          duration: "7 months",
          url: "https://www.coursera.org/professional-certificates/meta-front-end-developer",
          skillsTargeted: ["HTML/CSS", "React"],
          badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
        },
        {
          id: "fe-4",
          title: "Tailwind CSS & Modern Responsive Web Layouts",
          provider: "LinkedIn Learning",
          domain: "linkedin.com/learning",
          rating: 4.7,
          reviewCount: 4100,
          duration: "8h",
          url: "https://www.linkedin.com/learning",
          skillsTargeted: ["Tailwind", "HTML/CSS"],
          badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
        },
      ],
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
      courses: [
        {
          id: "do-1",
          title: "Docker & Kubernetes: The Practical Guide to Production Containers",
          provider: "Udemy",
          domain: "udemy.com",
          rating: 4.9,
          reviewCount: 38000,
          duration: "24h",
          url: "https://www.udemy.com/course/docker-and-kubernetes-the-complete-guide/",
          skillsTargeted: ["Docker", "Kubernetes"],
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        },
        {
          id: "do-2",
          title: "AWS Certified Solutions Architect & Cloud Engineering",
          provider: "Coursera",
          domain: "coursera.org",
          rating: 4.8,
          reviewCount: 22000,
          duration: "14 weeks",
          url: "https://www.coursera.org/learn/aws-cloud-technical-essentials",
          skillsTargeted: ["AWS", "Cloud Computing"],
          badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
        },
      ],
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
      courses: [
        {
          id: "se-1",
          title: "Software Architecture & System Design for Large Scale Systems",
          provider: "Coursera",
          domain: "coursera.org",
          rating: 4.9,
          reviewCount: 16500,
          duration: "10 weeks",
          url: "https://www.coursera.org/learn/system-design",
          skillsTargeted: ["System Design", "Microservices"],
          badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
        },
      ],
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
      courses: [
        {
          id: "da-1",
          title: "Google Data Analytics Professional Certificate",
          provider: "Coursera",
          domain: "coursera.org",
          rating: 4.9,
          reviewCount: 98000,
          duration: "6 months",
          url: "https://www.coursera.org/professional-certificates/google-data-analytics",
          skillsTargeted: ["SQL", "Data Visualization"],
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        },
      ],
    },
  };

  function getCurrentData() {
    if (selectedJobId !== "ALL" && JOB_SPECIFIC_DATA[selectedJobId]) {
      return JOB_SPECIFIC_DATA[selectedJobId];
    }

    // ALL aggregate
    const allCourses = Object.values(JOB_SPECIFIC_DATA).flatMap((d) => d.courses);
    const uniqueCourses = allCourses.filter(
      (c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx
    );
    const allMissing = Array.from(
      new Set(Object.values(JOB_SPECIFIC_DATA).flatMap((d) => d.missingSkills))
    ).slice(0, 6);

    return {
      missingSkills: allMissing,
      aiTip: {
        currentScore: 78,
        projectedScore: 95,
        text: "Closing your missing skill gaps across your applied jobs will boost your interview shortlist rate by over 60%.",
      },
      courses: uniqueCourses.slice(0, 8),
    };
  }

  function getCurrentApp() {
    if (selectedJobId === "ALL") return null;
    return appliedJobs.find((app) => app.jobId === selectedJobId || app.job.id === selectedJobId) || appliedJobs[0];
  }

  function renderDropdownAndPills() {
    if (appliedJobSelect) {
      let optionsHtml = `<option value="ALL">All Applied Jobs (${appliedJobs.length})</option>`;
      appliedJobs.forEach((app) => {
        const jId = app.jobId || app.job.id;
        optionsHtml += `
          <option value="${jId}" ${selectedJobId === jId ? "selected" : ""}>
            ${app.job.title} — ${app.job.company} (${app.status})
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
        const jId = app.jobId || app.job.id;
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
            <span>${app.job.company}: ${app.job.title}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${
              isSelected
                ? "bg-white/20 text-white"
                : app.status === "Interview"
                  ? "bg-emerald-50 text-emerald-700"
                  : app.status === "Rejected"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-brand-50 text-brand-700"
            }">
              ${app.status}
            </span>
          </button>
        `;
      });

      quickFilterPills.innerHTML = pillsHtml;
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
            ${currentApp.job.company.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-bold text-sm sm:text-base text-slate-900 m-0">
                ${currentApp.job.title} at ${currentApp.job.company}
              </h2>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                ${currentApp.status}
              </span>
            </div>
            <p class="text-xs text-slate-600 mt-0.5 m-0">
              Applied on ${currentApp.appliedDate} • Location: ${currentApp.job.location} • Experience: ${currentApp.job.experienceLevel}
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
          // Recalculate average and update context ATS score if present
          const avg = Math.round(userSkills.reduce((acc, s) => acc + s.masteryPercentage, 0) / userSkills.length);
          const scoreEl = document.getElementById("header-ats-score");
          if (scoreEl) {
            scoreEl.textContent = `${Math.min(99, Math.max(60, avg))}%`;
          }
        }
      });
    });
  }

  function renderMissingAndCourses() {
    const data = getCurrentData();
    const currentApp = getCurrentApp();

    if (missingSubtitle) {
      missingSubtitle.textContent = currentApp
        ? `Identified based on requirements for ${currentApp.job.title} at ${currentApp.job.company}`
        : "Identified based on market requirements across all your applied jobs";
    }

    if (missingBadgesContainer) {
      missingBadgesContainer.innerHTML = data.missingSkills.map((s) => `
        <div class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold shadow-xs hover:bg-rose-100 transition-colors">
          <i data-lucide="alert-circle" class="w-4 h-4 text-rose-500 shrink-0"></i>
          <span>${s}</span>
        </div>
      `).join("");
    }

    if (aiTipText) {
      aiTipText.textContent = data.aiTip.text;
    }

    if (coursesBadge) {
      coursesBadge.textContent = `${data.courses.length} Available`;
    }

    if (coursesSubtitle) {
      coursesSubtitle.textContent = currentApp
        ? `Curated course websites directly targeting your missing skills for ${currentApp.job.title} (${currentApp.job.company})`
        : "Curated learning platforms mapped to close the skill gaps across all your applied roles";
    }

    if (coursesGrid) {
      coursesGrid.innerHTML = data.courses.map((course) => `
        <a
          href="${course.url}"
          target="_blank"
          rel="noopener noreferrer"
          class="bg-white rounded-xl border border-slate-200 hover:border-brand-400 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold px-2.5 py-1 rounded-md border ${course.badgeColor}">
                ${course.provider}
              </span>
              <div class="flex items-center gap-1 text-xs font-bold text-amber-700">
                <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 text-amber-400"></i>
                <span>${course.rating}</span>
                <span class="text-[10px] text-slate-600">(${course.reviewCount.toLocaleString()})</span>
              </div>
            </div>

            <h3 class="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 m-0">
              ${course.title}
            </h3>

            <div class="flex items-center justify-between text-xs text-slate-700">
              <div class="flex items-center gap-1">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                <span>${course.duration}</span>
              </div>
              <span class="text-[11px] font-medium text-slate-600 group-hover:text-brand-600 flex items-center gap-0.5">
                ${course.domain}
                <i data-lucide="external-link" class="w-3 h-3 text-slate-400 group-hover:text-brand-600"></i>
              </span>
            </div>

            <div class="flex flex-wrap gap-1 pt-1">
              ${course.skillsTargeted.map((s) => `
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                  ${s}
                </span>
              `).join("")}
            </div>
          </div>

          <div class="pt-4 mt-4 border-t border-slate-100">
            <div class="w-full bg-brand-600 group-hover:bg-brand-700 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2">
              <span>Start Learning on ${course.provider}</span>
              <i data-lucide="external-link" class="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"></i>
            </div>
          </div>
        </a>
      `).join("");
    }

    if (window.lucide) window.lucide.createIcons();
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
