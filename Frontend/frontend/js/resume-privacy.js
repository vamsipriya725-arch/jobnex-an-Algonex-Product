/**
 * JobNex - Resume Analysis & Privacy Script
 * Integrated with Google Gemini AI for ATS Resume Generation, Scoring, and MySQL Workbench Storage
 */

document.addEventListener("DOMContentLoaded", () => {
  const tabResumeBtn = document.getElementById("tab-btn-resume");
  const tabPrivacyBtn = document.getElementById("tab-btn-privacy");
  const sectionResume = document.getElementById("section-resume-tab");
  const sectionPrivacy = document.getElementById("section-privacy-tab");
  const toastContainer = document.getElementById("resume-toast-notification");
  const toastText = document.getElementById("resume-toast-text");

  const fileInput = document.getElementById("resume-file-input");
  const filenameDisplay = document.getElementById("display-resume-filename");
  const jdTextarea = document.getElementById("jd-textarea-input");
  const analyzeBtn = document.getElementById("btn-analyze-jd");
  const generateAtsBtn = document.getElementById("btn-generate-ats-resume");
  const sampleFrontendBtn = document.getElementById("btn-sample-frontend");
  const sampleDsBtn = document.getElementById("btn-sample-ds");

  // Analysis result elements
  const scoreValueEl = document.getElementById("scorecard-score-value");
  const matchLevelBadge = document.getElementById("match-level-badge");
  const matchedSkillsList = document.getElementById("matched-skills-list");
  const missingSkillsList = document.getElementById("missing-skills-list");

  // ATS Generation UI Card Elements
  const atsCard = document.getElementById("ats-generated-card");
  const atsScoreBadge = document.getElementById("ats-tailored-score-badge");
  const atsHeadline = document.getElementById("ats-headline-text");
  const atsSummary = document.getElementById("ats-summary-text");
  const atsDownloadBtn = document.getElementById("btn-download-ats-docx");

  // Privacy elements
  const toggleEmployer = document.getElementById("toggle-mask-employer");
  const toggleContact = document.getElementById("toggle-mask-contact");
  const toggleAnon = document.getElementById("toggle-anon-avatar");
  const savePrivacyBtn = document.getElementById("btn-save-privacy");
  const previewBtn = document.getElementById("btn-preview-recruiter-view");
  const previewModal = document.getElementById("recruiter-preview-modal");
  const closePreviewBtn = document.getElementById("btn-close-preview-modal");
  const closePreviewFooter = document.getElementById("btn-close-preview-modal-footer");

  let activeTab = "resume";
  let isAnalyzing = false;
  let isGenerating = false;

  function switchTab(tab) {
    activeTab = tab;
    if (tab === "resume") {
      tabResumeBtn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-xs cursor-pointer";
      tabPrivacyBtn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 cursor-pointer";
      sectionResume.classList.remove("hidden");
      sectionPrivacy.classList.add("hidden");
    } else {
      tabPrivacyBtn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-xs cursor-pointer";
      tabResumeBtn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 cursor-pointer";
      sectionPrivacy.classList.remove("hidden");
      sectionResume.classList.add("hidden");
    }
  }

  function showToast(msg) {
    if (!toastContainer || !toastText) return;
    toastText.textContent = msg;
    toastContainer.classList.remove("hidden");
    setTimeout(() => {
      toastContainer.classList.add("hidden");
    }, 3800);
  }

  if (tabResumeBtn) tabResumeBtn.addEventListener("click", () => switchTab("resume"));
  if (tabPrivacyBtn) tabPrivacyBtn.addEventListener("click", () => switchTab("privacy"));

  const currentUser = window.JobNexAuth ? window.JobNexAuth.getUser() : {};
  let currentResumeText = currentUser.resumeText || "";

  if (currentUser.resumeFileName && filenameDisplay) {
    filenameDisplay.textContent = currentUser.resumeFileName;
  }

  // Load latest analysis from MySQL Workbench on page load
  async function loadLatestAnalysisFromDb() {
    try {
      const res = await fetch("/api/analyses");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const latest = data.data[0];
        displayAnalysisData(latest);
      }
    } catch (err) {
      console.warn("Could not load latest analysis from MySQL:", err);
    }
  }

  function displayAnalysisData(data) {
    const rawScore = data.ats_score !== undefined ? data.ats_score : data.matched_score;
    const score = Math.round(rawScore || 0);
    if (scoreValueEl) scoreValueEl.textContent = `${score}%`;
    if (matchLevelBadge) {
      matchLevelBadge.textContent = score >= 75 ? "Strong Match" : score >= 50 ? "Moderate Match" : "Low Match";
      matchLevelBadge.className = score >= 75
        ? "text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800"
        : score >= 50
        ? "text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800"
        : "text-xs font-bold px-3 py-1 rounded-full bg-rose-100 text-rose-800";
    }

    const summaryEl = document.getElementById("scorecard-summary-text");
    if (summaryEl && data.summary) {
      summaryEl.textContent = data.summary;
    }

    let matched = data.matched_keywords || data.matched_skills || [];
    let missing = data.missing_keywords || data.missing_skills || [];

    if (typeof matched === "string") {
      try { matched = JSON.parse(matched); } catch { matched = matched.split(",").map(s => s.trim()); }
    }
    if (typeof missing === "string") {
      try { missing = JSON.parse(missing); } catch { missing = missing.split(",").map(s => s.trim()); }
    }

    if (matchedSkillsList) {
      matchedSkillsList.innerHTML = Array.isArray(matched) && matched.length
        ? matched.map((s) => `
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">✓ ${s}</span>
          `).join("")
        : `<span class="text-xs text-slate-500 italic">No specific skill matches detected</span>`;
    }

    if (missingSkillsList) {
      missingSkillsList.innerHTML = Array.isArray(missing) && missing.length
        ? missing.map((s) => `
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">! ${s}</span>
          `).join("")
        : `<span class="text-xs text-slate-500 italic">No missing requirements</span>`;
    }

    // Dynamic AI recommendations tailored to candidate
    const recsList = document.getElementById("ai-recommendations-list");
    if (recsList) {
      let suggestions = data.suggestions || [];
      if (typeof suggestions === "string") {
        try { suggestions = JSON.parse(suggestions); } catch { suggestions = [suggestions]; }
      }
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        recsList.innerHTML = suggestions.map(s => `<li>${s}</li>`).join("");
      } else {
        recsList.innerHTML = `<li class="text-xs text-slate-500 italic">Resume aligns with key job criteria.</li>`;
      }
    }
  }

  function displayAtsGeneratedResult(atsResult) {
    if (!atsCard) return;

    if (atsScoreBadge) {
      const score = Math.round(atsResult.ats_score || 0);
      atsScoreBadge.textContent = `${score}% ATS Score`;
    }

    if (atsHeadline && atsResult.resume_data?.headline) {
      atsHeadline.textContent = atsResult.resume_data.headline;
    }

    if (atsSummary && atsResult.resume_data?.summary) {
      atsSummary.textContent = atsResult.resume_data.summary;
    }

    if (atsDownloadBtn && atsResult.download_url) {
      atsDownloadBtn.href = atsResult.download_url;
      atsDownloadBtn.setAttribute("download", `ATS_Resume_${atsResult.file_id || "tailored"}.docx`);
    }

    atsCard.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
  }

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (filenameDisplay) filenameDisplay.textContent = file.name;
        showToast(`Uploading and extracting text from ${file.name}...`);
        
        try {
          const formData = new FormData();
          formData.append("file", file);
          const uploadRes = await fetch("/api/upload-resume", {
            method: "POST",
            body: formData,
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            currentResumeText = uploadData.text || "";
            const u = window.JobNexAuth ? window.JobNexAuth.getUser() : {};
            u.resumeFileName = file.name;
            u.resumeText = currentResumeText;
            u.coreSkills = uploadData.core_skills || [];
            if (window.JobNexAuth) window.JobNexAuth.setUser(u);

            // Update Parsed Technical Core dynamically
            const coreContainer = document.getElementById("parsed-technical-core");
            if (coreContainer && Array.isArray(uploadData.core_skills) && uploadData.core_skills.length > 0) {
              coreContainer.innerHTML = uploadData.core_skills.map(s => `
                <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">${s}</span>
              `).join("");
            }

            showToast(`Uploaded and extracted ${uploadData.char_count || currentResumeText.length} characters from ${file.name}!`);
          } else {
            const errData = await uploadRes.json().catch(() => ({}));
            showToast(`Upload notice: ${errData.detail || "File parsed"}`);
          }
        } catch (err) {
          console.warn("Upload error: ", err);
          showToast(`Upload note: ${err.message}`);
        }
        if (window.JobNexUtils) window.JobNexUtils.playSound("success");
      }
    });
  }

  // Fetch JD from URL
  const jdUrlInput = document.getElementById("jd-url-input");
  const fetchJdUrlBtn = document.getElementById("btn-fetch-jd-url");

  if (fetchJdUrlBtn && jdUrlInput) {
    fetchJdUrlBtn.addEventListener("click", async () => {
      const url = jdUrlInput.value.trim();
      if (!url) {
        showToast("Please enter a job posting URL (e.g. https://...)");
        return;
      }
      fetchJdUrlBtn.disabled = true;
      fetchJdUrlBtn.innerHTML = `
        <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        <span>Fetching...</span>
      `;

      try {
        const res = await fetch("/api/fetch-jd-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.detail || data.error || "Couldn't read this page automatically. Please paste the job description manually.";
          throw new Error(errMsg);
        }

        if (jdTextarea && data.jd_text) {
          jdTextarea.value = data.jd_text;
          showToast(`Extracted ${data.char_count || data.jd_text.length} characters of Job Description from URL!`);
          if (window.JobNexUtils) window.JobNexUtils.playSound("success");
        }
      } catch (err) {
        console.warn("URL fetch notice:", err.message);
        if (jdTextarea) {
          jdTextarea.readOnly = false;
          jdTextarea.disabled = false;
          jdTextarea.focus();
        }
        showToast(err.message || "Couldn't read this page automatically. Please paste the job description manually.");
      } finally {
        fetchJdUrlBtn.disabled = false;
        fetchJdUrlBtn.innerHTML = `
          <i data-lucide="globe" class="w-3.5 h-3.5"></i>
          <span>Fetch JD from URL</span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  if (sampleFrontendBtn) {
    sampleFrontendBtn.addEventListener("click", () => {
      if (jdTextarea) {
        jdTextarea.value = "Senior Frontend Engineer (React / TypeScript)\n\nKey Requirements:\n- 3+ years experience with React, Next.js, and modern TypeScript\n- Deep knowledge of Tailwind CSS, CSS Modules, and accessible UI components\n- Experience with GraphQL or REST APIs, state management (Zustand/Redux)\n- Strong understanding of Core Web Vitals, testing with Jest/Vitest, and CI/CD pipelines";
      }
      showToast("Loaded Senior Frontend Engineer sample JD");
    });
  }

  if (sampleDsBtn) {
    sampleDsBtn.addEventListener("click", () => {
      if (jdTextarea) {
        jdTextarea.value = "Data Scientist / ML Engineer (Forecasting)\n\nKey Requirements:\n- Strong foundation in Python, SQL, Pandas, and Scikit-Learn\n- Experience designing and training Machine Learning & Deep Learning models\n- Knowledge of Data Visualization tools (Plotly, Tableau) and AWS Cloud deployments\n- Excellent problem-solving skills and predictive modeling experience";
      }
      showToast("Loaded Data Scientist sample JD");
    });
  }

  // 1. Instant Resume Match Analysis (computes ATS score & saves to MySQL Workbench)
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", async () => {
      if (isAnalyzing) return;

      const jd = jdTextarea ? jdTextarea.value.trim() : "";
      if (!currentResumeText) {
        const userInput = prompt("Enter or paste your resume text (or click 'Replace File' to upload a PDF):");
        if (userInput && userInput.trim()) {
          currentResumeText = userInput.trim();
          const u = window.JobNexAuth ? window.JobNexAuth.getUser() : {};
          u.resumeText = currentResumeText;
          if (window.JobNexAuth) window.JobNexAuth.setUser(u);
          if (filenameDisplay) filenameDisplay.textContent = "Custom_Resume_Input.txt";
        } else {
          showToast("Please upload your resume file or paste resume text first.");
          return;
        }
      }

      isAnalyzing = true;
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = `
        <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        <span>Analyzing & Saving to MySQL...</span>
      `;

      const resume = currentResumeText || "Software developer skilled in React, Python, and SQL.";

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume_text: resume,
            jd_text: jd || "Software Engineer with React, Python, SQL",
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const dbData = await response.json();
        displayAnalysisData(dbData);

        if (window.JobNexUtils) window.JobNexUtils.playSound("success");
        showToast(`ATS match analysis calculated & saved to MySQL Workbench! (ID: #${dbData.Analysis_Id || "new"})`);

      } catch (err) {
        console.error("Backend analyze failed: ", err);
        showToast(`Error analyzing resume: ${err.message}`);
      } finally {
        isAnalyzing = false;
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = `
          <i data-lucide="sparkles" class="w-4 h-4"></i>
          <span>Analyze Resume against Job Description</span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // 2. Generate Tailored ATS Resume (.docx) with Gemini AI
  if (generateAtsBtn) {
    generateAtsBtn.addEventListener("click", async () => {
      if (isGenerating) return;

      const jd = jdTextarea ? jdTextarea.value.trim() : "";
      if (!currentResumeText) {
        const userInput = prompt("Enter or paste your resume text to tailor for this JD:");
        if (userInput && userInput.trim()) {
          currentResumeText = userInput.trim();
          const u = window.JobNexAuth ? window.JobNexAuth.getUser() : {};
          u.resumeText = currentResumeText;
          if (window.JobNexAuth) window.JobNexAuth.setUser(u);
          if (filenameDisplay) filenameDisplay.textContent = "Custom_Resume_Input.txt";
        } else {
          showToast("Please upload your resume file or paste resume text first.");
          return;
        }
      }

      isGenerating = true;
      generateAtsBtn.disabled = true;
      generateAtsBtn.innerHTML = `
        <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        <span>Gemini AI is tailoring your ATS Resume (.docx)...</span>
      `;

      const resume = currentResumeText;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      try {
        const response = await fetch("/ats-resume/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            resume_text: resume,
            jd_text: jd || "Software Engineer with React, Python, SQL",
          }),
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // Update Scorecard & Skills
        displayAnalysisData(data);

        // Update and Display the ATS Resume Card with Download link
        displayAtsGeneratedResult(data);

        // Also save analysis record to MySQL Workbench
        try {
          await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resume_text: resume,
              jd_text: jd,
            }),
          });
        } catch (e) {
          console.warn("DB record sync note:", e);
        }

        if (window.JobNexUtils) window.JobNexUtils.playSound("success");
        showToast(data.from_cache 
          ? "Instant ATS Resume loaded from cache!" 
          : "Tailored ATS Word Resume (.docx) created with Gemini AI!"
        );

      } catch (err) {
        clearTimeout(timeoutId);
        console.error("ATS Resume generation failed: ", err);
        if (err.name === "AbortError") {
          showToast("Request timed out. Please try again or verify your connection.");
        } else {
          showToast(`ATS generation notice: ${err.message}`);
        }
      } finally {
        isGenerating = false;
        generateAtsBtn.disabled = false;
        generateAtsBtn.innerHTML = `
          <i data-lucide="file-check" class="w-4 h-4"></i>
          <span>Generate Tailored ATS Resume (.docx) with Gemini AI</span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  if (savePrivacyBtn) {
    savePrivacyBtn.addEventListener("click", () => {
      if (window.JobNexUtils) {
        window.JobNexUtils.playSound("success");
        window.JobNexUtils.showToast("Privacy settings saved successfully!", "success");
      }
      showToast("Privacy settings saved successfully!");
    });
  }

  function openPreview() {
    if (previewModal) previewModal.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
  }

  function closePreview() {
    if (previewModal) previewModal.classList.add("hidden");
  }

  if (previewBtn) previewBtn.addEventListener("click", openPreview);
  if (closePreviewBtn) closePreviewBtn.addEventListener("click", closePreview);
  if (closePreviewFooter) closePreviewFooter.addEventListener("click", closePreview);
  if (previewModal) {
    previewModal.addEventListener("click", (e) => {
      if (e.target === previewModal) closePreview();
    });
  }

  // Load latest analysis on page open from MySQL Workbench
  loadLatestAnalysisFromDb();
});
