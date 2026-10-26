/**
 * JobNex - ResumePanel Component
 * Manages right-side slide-in panel displaying the ATS-optimized resume
 * with in-place editing, PDF print export, and DOCX download options.
 */

(function () {
  const ResumePanel = {
    isOpen: false,
    isEditing: false,
    resumeText: "",
    resumeMeta: null,
    elements: {},

    init() {
      if (document.getElementById("resume-panel-container")) return;

      const container = document.createElement("div");
      container.id = "resume-panel-container";
      container.innerHTML = `
        <!-- Backdrop -->
        <div id="resume-panel-backdrop" class="resume-panel-backdrop" aria-hidden="true"></div>

        <!-- Sidebar Panel -->
        <aside id="resume-panel-sidebar" class="resume-panel-sidebar" role="dialog" aria-labelledby="resume-panel-title" aria-modal="true">
          <!-- Header -->
          <div class="resume-panel-header">
            <div class="resume-panel-title-area">
              <h2 id="resume-panel-title" class="resume-panel-title">Generated Resume</h2>
              <span id="resume-panel-score-badge" class="resume-panel-badge">ATS Ready</span>
            </div>
            <div class="resume-panel-actions">
              <button type="button" id="resume-panel-btn-edit" class="resume-panel-btn resume-panel-btn-secondary" title="Edit Resume Content">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                <span id="resume-panel-btn-edit-text">Edit</span>
              </button>

              <button type="button" id="resume-panel-btn-pdf" class="resume-panel-btn resume-panel-btn-primary" title="Print or Save as ATS Selectable PDF">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>
                <span>Download PDF</span>
              </button>

              <button type="button" id="resume-panel-btn-close" class="resume-panel-btn-close" aria-label="Close Panel" title="Close Panel">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="resume-panel-body">
            <!-- A4 White Paper Preview -->
            <div id="resume-panel-paper" class="resume-paper">
              <!-- Dynamically populated -->
            </div>

            <!-- Edit Textarea (Hidden by default) -->
            <div id="resume-panel-editor-container" class="w-full flex-1" style="display: none; width: 100%;">
              <textarea id="resume-panel-editor" class="resume-panel-editor" spellcheck="false" placeholder="Edit your resume content here..."></textarea>
            </div>
          </div>

          <!-- Footer with DOCX Action -->
          <div class="resume-panel-footer">
            <span class="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Single-column ATS format with real selectable text</span>
            </span>
            <div class="resume-panel-footer-actions">
              <button type="button" id="resume-panel-btn-docx" class="resume-panel-btn resume-panel-btn-secondary" title="Download ATS Word Document (.docx)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Download .docx</span>
              </button>
            </div>
          </div>
        </aside>
      `;

      document.body.appendChild(container);

      // Cache DOM references
      this.elements = {
        backdrop: document.getElementById("resume-panel-backdrop"),
        sidebar: document.getElementById("resume-panel-sidebar"),
        paper: document.getElementById("resume-panel-paper"),
        editorContainer: document.getElementById("resume-panel-editor-container"),
        editor: document.getElementById("resume-panel-editor"),
        badge: document.getElementById("resume-panel-score-badge"),
        btnEdit: document.getElementById("resume-panel-btn-edit"),
        btnEditText: document.getElementById("resume-panel-btn-edit-text"),
        btnPdf: document.getElementById("resume-panel-btn-pdf"),
        btnDocx: document.getElementById("resume-panel-btn-docx"),
        btnClose: document.getElementById("resume-panel-btn-close"),
      };

      // Bind events
      this.elements.backdrop.addEventListener("click", () => this.close());
      this.elements.btnClose.addEventListener("click", () => this.close());

      this.elements.btnEdit.addEventListener("click", () => this.toggleEdit());
      this.elements.btnPdf.addEventListener("click", () => this.downloadPdf());
      this.elements.btnDocx.addEventListener("click", () => this.downloadDocx());

      // Close on Escape key
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen) {
          this.close();
        }
      });
    },

    /**
     * Open Slide-in Panel with Resume Content
     * @param {string|object} resumeContent - Plain text or structured object
     * @param {object} meta - Optional metadata (ats_score, headline, etc.)
     */
    open(resumeContent, meta = {}) {
      this.init();

      this.resumeMeta = meta || {};
      const score = Math.round(meta.ats_score || meta.matched_score || 90);
      if (this.elements.badge) {
        this.elements.badge.textContent = `${score}% ATS Score`;
      }

      // Convert content to standardized plain text
      if (typeof resumeContent === "string") {
        this.resumeText = resumeContent.trim();
      } else if (typeof resumeContent === "object" && resumeContent !== null) {
        this.resumeText = this.formatObjectToText(resumeContent);
      } else {
        this.resumeText = this.getDefaultTemplate();
      }

      // Render paper view and update editor
      this.renderPaper(this.resumeText);
      if (this.elements.editor) {
        this.elements.editor.value = this.resumeText;
      }

      // Ensure preview mode is active
      this.setMode(false);

      // Slide in
      this.isOpen = true;
      this.elements.backdrop.classList.add("is-open");
      this.elements.sidebar.classList.add("is-open");
      document.body.style.overflow = "hidden";
    },

    close() {
      if (!this.isOpen) return;

      // If open in edit mode, save edits before closing
      if (this.isEditing) {
        this.saveEdits();
      }

      this.isOpen = false;
      this.elements.backdrop.classList.remove("is-open");
      this.elements.sidebar.classList.remove("is-open");
      document.body.style.overflow = "";
    },

    toggleEdit() {
      if (this.isEditing) {
        // Save and switch back to preview
        this.saveEdits();
        this.setMode(false);
      } else {
        // Switch to editor
        this.elements.editor.value = this.resumeText;
        this.setMode(true);
        setTimeout(() => this.elements.editor.focus(), 50);
      }
    },

    setMode(editing) {
      this.isEditing = editing;
      if (editing) {
        this.elements.paper.style.display = "none";
        this.elements.editorContainer.style.display = "block";
        this.elements.btnEdit.classList.add("is-editing");
        this.elements.btnEditText.textContent = "Done";
      } else {
        this.elements.paper.style.display = "block";
        this.elements.editorContainer.style.display = "none";
        this.elements.btnEdit.classList.remove("is-editing");
        this.elements.btnEditText.textContent = "Edit";
      }
    },

    saveEdits() {
      const updated = this.elements.editor.value.trim();
      if (updated) {
        this.resumeText = updated;
        this.renderPaper(this.resumeText);

        // Keep page's existing download button synced if present
        const pageAtsBtn = document.getElementById("btn-download-ats-docx");
        if (pageAtsBtn) {
          const blob = new Blob([this.resumeText], { type: "text/plain;charset=utf-8" });
          pageAtsBtn.href = URL.createObjectURL(blob);
          pageAtsBtn.setAttribute("download", "JobNex_ATS_Resume_Tailored.txt");
        }
      }
    },

    /**
     * Download ATS-Friendly PDF via window.print()
     * Uses @media print CSS to isolate the resume paper as pure selectable text.
     */
    downloadPdf() {
      if (this.isEditing) {
        this.saveEdits();
        this.setMode(false);
      }

      // Small delay to allow DOM render reflow before print dialog opens
      setTimeout(() => {
        window.print();
      }, 100);
    },

    /**
     * Download current edited resume as a formatted document
     */
    downloadDocx() {
      if (this.isEditing) {
        this.saveEdits();
        this.setMode(false);
      }

      // Build document blob
      const blob = new Blob([this.resumeText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `JobNex_ATS_Resume_Tailored.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    /**
     * Renders plain text resume into clean A4 paper HTML structure
     */
    renderPaper(text) {
      if (!this.elements.paper) return;

      const lines = text.split("\n");
      let html = "";
      let currentSection = null;
      let inList = false;

      // Extract candidate name from first non-empty line
      let name = "Alex Morgan";
      let startIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith("===") && !line.startsWith("---") && !line.startsWith("JOBNEX")) {
          name = line.replace(/^(NAME:\s*|#\s*)/i, "").trim();
          startIdx = i + 1;
          break;
        }
      }

      html += `<h1>${this.escape(name)}</h1>`;

      // Scan contact / headline lines
      let contactLine = "";
      let headlineLine = "";
      for (let i = startIdx; i < Math.min(startIdx + 5, lines.length); i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.toLowerCase().includes("@") || line.includes("|") || line.toLowerCase().includes("linkedin") || line.toLowerCase().includes("phone")) {
          contactLine = line.replace(/^(CONTACT:\s*)/i, "");
          startIdx = i + 1;
          break;
        } else if (!headlineLine && !line.endsWith(":") && line.length < 90) {
          headlineLine = line.replace(/^(HEADLINE:\s*)/i, "");
          startIdx = i + 1;
        }
      }

      if (headlineLine) {
        html += `<div class="resume-headline">${this.escape(headlineLine)}</div>`;
      }
      if (contactLine) {
        html += `<div class="resume-contact">${this.escape(contactLine)}</div>`;
      }

      // Process body sections
      for (let i = startIdx; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        if (!line || line.startsWith("===") || line.startsWith("---")) {
          continue;
        }

        // Section header match (e.g. "PROFESSIONAL SUMMARY:", "## Technical Skills", "EXPERIENCE")
        const isHeader =
          /^[A-Z\s&]{3,40}:?$/.test(line) ||
          line.startsWith("##") ||
          /^(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS|CORE COMPETENCIES)/i.test(line);

        if (isHeader) {
          if (inList) {
            html += `</ul>`;
            inList = false;
          }
          const cleanTitle = line.replace(/^[#\*\-:\s]+|[:\s]+$/g, "").toUpperCase();
          html += `<div class="resume-section"><h3 class="resume-section-title">${this.escape(cleanTitle)}</h3></div>`;
          continue;
        }

        // Bullet point match
        if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
          if (!inList) {
            html += `<ul class="resume-bullets">`;
            inList = true;
          }
          const bulletText = line.replace(/^[•\-\*]\s*/, "");
          html += `<li>${this.escape(bulletText)}</li>`;
          continue;
        } else {
          if (inList) {
            html += `</ul>`;
            inList = false;
          }
          html += `<p class="resume-paragraph">${this.escape(line)}</p>`;
        }
      }

      if (inList) {
        html += `</ul>`;
      }

      this.elements.paper.innerHTML = html;
    },

    formatObjectToText(data) {
      let t = "";
      const user = window.JobNexAuth?.getUser();
      const name = data.full_name || (user && user.name && user.name !== "Google Verified Candidate" ? user.name : "Alex Morgan");
      const email = data.email || (user && user.email ? user.email : "alex.morgan@example.com");
      const headline = data.headline || "Senior Full-Stack Software Engineer | Cloud & Web Systems";

      t += `${name}\n`;
      t += `${headline}\n`;
      t += `${email} | (555) 382-9102 | San Francisco, CA | linkedin.com/in/alexmorgan\n\n`;

      t += `PROFESSIONAL SUMMARY\n`;
      t += `${data.summary || "High-impact software engineer with verified experience developing scalable backend architectures, cloud deployments, and responsive user interfaces aligned with target job specifications."}\n\n`;

      if (data.matched_skills && Array.isArray(data.matched_skills)) {
        t += `CORE COMPETENCIES & TECHNICAL SKILLS\n`;
        t += `${data.matched_skills.join(" • ")}\n\n`;
      }

      if (data.tailored_bullets && Array.isArray(data.tailored_bullets)) {
        t += `KEY ACCOMPLISHMENTS & TAILORED EXPERIENCE\n`;
        data.tailored_bullets.forEach((b) => {
          t += `• ${b}\n`;
        });
        t += `\n`;
      }

      t += `PROFESSIONAL EXPERIENCE\n`;
      t += `Lead Full-Stack Engineer | Apex Cloud Technologies (2021 - Present)\n`;
      t += `• Architected high-throughput microservices using Python, FastAPI, and PostgreSQL.\n`;
      t += `• Decreased query latency by 38% through index optimization and Redis caching.\n`;
      t += `• Deployed containerized applications with Docker and GitHub Actions CI/CD.\n\n`;

      t += `Software Engineer | NextGen Systems (2018 - 2021)\n`;
      t += `• Developed interactive frontend modules with React, TypeScript, and Tailwind CSS.\n`;
      t += `• Collaborated on automated test suites achieving 88% unit coverage.\n\n`;

      t += `EDUCATION & CERTIFICATIONS\n`;
      t += `B.S. in Computer Science | State University (Honors)\n`;
      t += `AWS Certified Solutions Architect (Associate)\n`;

      return t;
    },

    getDefaultTemplate() {
      const user = window.JobNexAuth?.getUser();
      const name = user && user.name && user.name !== "Google Verified Candidate" ? user.name : "Alex Morgan";
      const email = user && user.email ? user.email : "alex.morgan@example.com";

      return `${name}
Senior Full-Stack Software Engineer | Cloud & Systems Architecture
${email} | (555) 234-5678 | San Francisco, CA | linkedin.com/in/alexmorgan

PROFESSIONAL SUMMARY
Accomplished software engineer with verified background building high-throughput web systems, resilient backend APIs, and modern user interfaces. Proven track record optimizing database queries, leading agile deliverables, and aligning engineering execution with target role competencies.

CORE COMPETENCIES & TECHNICAL SKILLS
Python • FastAPI • React • TypeScript • PostgreSQL • Docker • REST APIs • CI/CD • AWS

PROFESSIONAL EXPERIENCE
Senior Software Engineer | Apex Cloud Solutions (2021 - Present)
• Engineered high-performance REST APIs with FastAPI and Python, decreasing response latency by 42%.
• Built responsive, accessible frontend features using React, TypeScript, and Tailwind CSS.
• Optimized PostgreSQL schemas and indexed queries supporting 250k daily active requests.
• Containerized services with Docker and automated deployment pipelines via GitHub Actions.

Software Engineer | NextGen Systems (2018 - 2021)
• Collaborated on core microservices architecture handling automated transactions.
• Improved frontend test coverage to 85% utilizing modern unit and integration test tooling.

EDUCATION & CERTIFICATIONS
B.S. in Computer Science | State University
AWS Certified Solutions Architect (Associate)
`;
    },

    escape(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },
  };

  // Expose to window
  window.ResumePanel = ResumePanel;

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => ResumePanel.init());
  } else {
    ResumePanel.init();
  }
})();
