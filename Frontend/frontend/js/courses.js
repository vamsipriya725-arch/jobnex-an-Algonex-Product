/**
 * Courses Page Logic (frontend/js/courses.js)
 */

document.addEventListener("DOMContentLoaded", async () => {
  await loadComponent("navbar-container", "../components/navbar.html");
  await loadComponent("footer-container", "../components/footer.html");
  initNav("courses");

  const courses = [
    {
      title: "Full-Stack Web Development",
      provider: "JobNex Academy",
      level: "Intermediate",
      duration: "12 weeks",
      modules: 42,
      topics: ["React", "Node.js", "PostgreSQL"]
    },
    {
      title: "Data Science with Python",
      provider: "JobNex Academy",
      level: "Beginner",
      duration: "10 weeks",
      modules: 36,
      topics: ["Python", "Pandas", "ML Basics"]
    },
    {
      title: "Cloud & DevOps Essentials",
      provider: "JobNex Academy",
      level: "Advanced",
      duration: "8 weeks",
      modules: 28,
      topics: ["AWS", "Docker", "CI/CD"]
    },
    {
      title: "UI/UX Design Foundations",
      provider: "JobNex Academy",
      level: "Beginner",
      duration: "6 weeks",
      modules: 20,
      topics: ["Figma", "Wireframing", "Prototyping"]
    },
    {
      title: "System Design Interview Prep",
      provider: "JobNex Academy",
      level: "Advanced",
      duration: "4 weeks",
      modules: 16,
      topics: ["Scalability", "Caching", "APIs"]
    },
    {
      title: "AI & Machine Learning Basics",
      provider: "JobNex Academy",
      level: "Intermediate",
      duration: "9 weeks",
      modules: 30,
      topics: ["Python", "Neural Networks", "LLMs"]
    }
  ];

  const container = document.getElementById("courses-grid");
  if (container) {
    container.innerHTML = courses.map(course => `
      <div class="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:border-brand-300 transition-all flex flex-col justify-between group">
        <div>
          <div class="flex items-start justify-between gap-2 mb-3">
            <h3 class="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition-colors">${course.title}</h3>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 shrink-0">
              ${course.level}
            </span>
          </div>
          <p class="text-xs text-slate-500 mb-3">${course.provider}</p>
          <div class="flex flex-wrap gap-1.5">
            ${course.topics.map(t => `
              <span class="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">${t}</span>
            `).join("")}
          </div>
        </div>

        <div class="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between">
          <div class="flex items-center gap-3 text-[11px] text-slate-500">
            <span class="flex items-center gap-1">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
              ${course.duration}
            </span>
            <span class="flex items-center gap-1">
              <i data-lucide="layers" class="w-3.5 h-3.5 text-slate-400"></i>
              ${course.modules} modules
            </span>
          </div>
          <button type="button" class="enroll-course-btn btn-polish bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer" data-title="${course.title}">
            Enroll Free
          </button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll(".enroll-course-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const title = btn.getAttribute("data-title");
        playSound("success");
        showToast(`Enrolled in "${title}"! Check your learning dashboard.`);
      });
    });
  }

  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
});
