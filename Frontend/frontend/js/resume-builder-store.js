/**
 * JobNex Resume Builder - Central Store & State Manager
 * Features:
 * - Undo / Redo history stack (up to 30 snapshots)
 * - Debounced backend autosave with status indicator (Saved, Saving..., Unsaved)
 * - Multi-resume management with "Active" resume flag
 * - Per-user authentication headers (JWT Bearer & X-User-Id)
 * - Fine-grained immutable update helpers for sections, items, and bullets
 * - Event subscriber pattern for live UI & preview updates
 */

(function (window) {
  "use strict";

  function deepClone(obj) {
    if (obj === undefined || obj === null) return obj;
    return JSON.parse(JSON.stringify(obj));
  }

  function getApiBaseUrl() {
    if (window.JOBNEX_API_BASE) return window.JOBNEX_API_BASE;
    try {
      const stored = localStorage.getItem("jobnex_api_base");
      if (stored) return stored;
    } catch (e) {}

    if (window.location.port === "8000") return "";
    if (window.location.protocol === "https:") return "";
    const host = window.location.hostname || "localhost";
    return `${window.location.protocol}//${host}:8000`;
  }

  function getAuthHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    const token = localStorage.getItem("jobnex_access_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const user = window.JobNexAuth?.getUser ? window.JobNexAuth.getUser() : null;
      if (user && user.id) {
        headers["X-User-Id"] = String(user.id);
      }
    } catch (e) {
      // Ignore
    }

    return headers;
  }

  class ResumeBuilderStore {
    constructor() {
      this.resumes = [];
      this.currentResume = null;
      this.activeResumeId = null;

      // History stacks
      this.past = [];
      this.future = [];
      this.maxHistory = 30;

      // Autosave state
      this.saveStatus = "Saved"; // "Saved" | "Saving..." | "Unsaved" | "Error"
      this.isDirty = false;
      this.lastSavedAt = null;
      this.autosaveTimeout = null;
      this.debounceMs = 1200;

      // Event listeners
      this.listeners = new Set();
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    notify(eventType = "change", payload = null) {
      for (const listener of this.listeners) {
        try {
          listener({
            type: eventType,
            payload: payload,
            state: {
              currentResume: this.currentResume,
              saveStatus: this.saveStatus,
              canUndo: this.canUndo(),
              canRedo: this.canRedo(),
              resumes: this.resumes,
            },
          });
        } catch (err) {
          console.error("[ResumeBuilderStore] Listener error:", err);
        }
      }
    }

    canUndo() {
      return this.past.length > 0;
    }

    canRedo() {
      return this.future.length > 0;
    }

    // =========================================================================
    // Backend API Calls
    // =========================================================================

    async fetchResumes({ search = "", sortBy = "updated_at", order = "desc", page = 1, perPage = 10 } = {}) {
      try {
        const query = new URLSearchParams({
          sort_by: sortBy,
          order: order,
          page: String(page),
          per_page: String(perPage),
        });
        if (search) query.append("search", search);

        const res = await fetch(`${getApiBaseUrl()}/api/resumes?${query.toString()}`, {
          method: "GET",
          headers: getAuthHeaders(),
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch resumes: ${res.statusText}`);
        }

        const data = await res.json();
        this.resumes = data.resumes || [];
        const active = this.resumes.find((r) => r.is_active);
        this.activeResumeId = active ? active.id : null;
        this.notify("resumes_loaded", data);
        return data;
      } catch (err) {
        console.warn("[ResumeBuilderStore] Remote fetchResumes failed, checking local cache:", err.message);
        try {
          const cached = localStorage.getItem("jobnex_resumes_cache");
          if (cached) {
            this.resumes = JSON.parse(cached);
            const active = this.resumes.find((r) => r.is_active);
            this.activeResumeId = active ? active.id : null;
            const data = { resumes: this.resumes, total: this.resumes.length, page: 1, total_pages: 1 };
            this.notify("resumes_loaded", data);
            return data;
          }
        } catch (e) {}
        this.resumes = [];
        this.notify("resumes_loaded", { resumes: [], total: 0 });
        return { resumes: [], total: 0 };
      }
    }

    async loadResume(resumeId) {
      try {
        this.saveStatus = "Loading...";
        this.notify("loading");

        const res = await fetch(`${getApiBaseUrl()}/api/resumes/${resumeId}`, {
          method: "GET",
          headers: getAuthHeaders(),
        });

        if (!res.ok) {
          throw new Error(`Failed to load resume ${resumeId}`);
        }

        const data = await res.json();
        this.currentResume = data;
        this.activeResumeId = data.is_active ? data.id : this.activeResumeId;

        // Reset history stack for newly loaded resume
        this.past = [];
        this.future = [];
        this.isDirty = false;
        this.saveStatus = "Saved";
        this.lastSavedAt = data.updated_at;

        this.notify("resume_loaded", this.currentResume);
        return this.currentResume;
      } catch (err) {
        console.warn(`[ResumeBuilderStore] Remote loadResume for ${resumeId} failed, checking local storage:`, err.message);
        try {
          const localStr = localStorage.getItem("jobnex_resume_" + resumeId);
          if (localStr) {
            const data = JSON.parse(localStr);
            this.currentResume = data;
            this.activeResumeId = data.is_active ? data.id : this.activeResumeId;
            this.past = [];
            this.future = [];
            this.isDirty = false;
            this.saveStatus = "Saved";
            this.lastSavedAt = data.updated_at || new Date().toISOString();
            this.notify("resume_loaded", this.currentResume);
            return this.currentResume;
          }
        } catch (e) {}
        this.saveStatus = "Error";
        this.notify("error", err.message);
        throw err;
      }
    }

    async createResume({ name = "Untitled Resume", isActive = false, cloneFromId = null } = {}) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name,
            is_active: isActive,
            clone_from_id: cloneFromId,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to create resume");
        }

        const newResume = await res.json();
        await this.fetchResumes();
        return newResume;
      } catch (err) {
        console.error("[ResumeBuilderStore] createResume failed:", err);
        throw err;
      }
    }

    async duplicateResume(resumeId) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes/${resumeId}/duplicate`, {
          method: "POST",
          headers: getAuthHeaders(),
        });

        if (!res.ok) throw new Error("Failed to duplicate resume");
        const duplicated = await res.json();
        await this.fetchResumes();
        return duplicated;
      } catch (err) {
        console.error("[ResumeBuilderStore] duplicateResume failed:", err);
        throw err;
      }
    }

    async renameResume(resumeId, newName) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes/${resumeId}/rename`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ name: newName }),
        });

        if (!res.ok) throw new Error("Failed to rename resume");
        const updated = await res.json();

        if (this.currentResume && this.currentResume.id === resumeId) {
          this.currentResume.name = updated.name;
        }

        await this.fetchResumes();
        this.notify("resume_renamed", updated);
        return updated;
      } catch (err) {
        console.error("[ResumeBuilderStore] renameResume failed:", err);
        throw err;
      }
    }

    async setActiveResume(resumeId) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes/${resumeId}/active`, {
          method: "PATCH",
          headers: getAuthHeaders(),
        });

        if (!res.ok) throw new Error("Failed to set active resume");
        const updated = await res.json();
        this.activeResumeId = resumeId;

        if (this.currentResume && this.currentResume.id === resumeId) {
          this.currentResume.is_active = true;
        }

        await this.fetchResumes();
        this.notify("active_changed", resumeId);
        return updated;
      } catch (err) {
        console.error("[ResumeBuilderStore] setActiveResume failed:", err);
        throw err;
      }
    }

    async deleteResume(resumeId) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes/${resumeId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });

        if (!res.ok) throw new Error("Failed to delete resume");
        if (this.currentResume && this.currentResume.id === resumeId) {
          this.currentResume = null;
        }

        await this.fetchResumes();
        this.notify("resume_deleted", resumeId);
        return true;
      } catch (err) {
        console.error("[ResumeBuilderStore] deleteResume failed:", err);
        throw err;
      }
    }

    // =========================================================================
    // Autosave & Mutation with Undo/Redo History
    // =========================================================================

    updateCurrentResume(mutatorFn, recordHistory = true) {
      if (!this.currentResume) return;

      if (recordHistory) {
        // Push snapshot of current state to past
        const snapshot = deepClone(this.currentResume);
        this.past.push(snapshot);
        if (this.past.length > this.maxHistory) {
          this.past.shift();
        }
        // Clearing redo stack on new branch edit
        this.future = [];
      }

      // Apply update
      mutatorFn(this.currentResume);

      this.isDirty = true;
      this.saveStatus = "Unsaved";
      this.notify("state_changed");

      this.scheduleAutosave();
    }

    scheduleAutosave() {
      if (this.autosaveTimeout) {
        clearTimeout(this.autosaveTimeout);
      }

      this.autosaveTimeout = setTimeout(() => {
        this.saveNow();
      }, this.debounceMs);
    }

    async saveNow() {
      if (!this.currentResume || !this.isDirty) return;

      if (this.autosaveTimeout) {
        clearTimeout(this.autosaveTimeout);
        this.autosaveTimeout = null;
      }

      this.saveStatus = "Saving...";
      this.notify("save_status", "Saving...");

      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes/${this.currentResume.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: this.currentResume.name,
            is_active: this.currentResume.is_active,
            readiness_score: this.currentResume.readiness_score,
            readiness_label: this.currentResume.readiness_label,
            content: this.currentResume,
          }),
        });

        if (!res.ok) throw new Error("Autosave request rejected by server");

        const saved = await res.json();
        this.isDirty = false;
        this.saveStatus = "Saved";
        this.lastSavedAt = saved.updated_at || new Date().toISOString();
        this.notify("saved", this.lastSavedAt);
      } catch (err) {
        console.warn("[ResumeBuilderStore] Remote autosave failed, persisting to local cache:", err.message);
        try {
          localStorage.setItem("jobnex_resume_" + this.currentResume.id, JSON.stringify(this.currentResume));
          const idx = this.resumes.findIndex(r => r.id === this.currentResume.id);
          if (idx !== -1) {
            this.resumes[idx] = { ...this.resumes[idx], ...this.currentResume, updated_at: new Date().toISOString() };
          } else {
            this.resumes.unshift(this.currentResume);
          }
          localStorage.setItem("jobnex_resumes_cache", JSON.stringify(this.resumes));
          this.isDirty = false;
          this.saveStatus = "Saved (Offline)";
          this.lastSavedAt = new Date().toISOString();
          this.notify("saved", this.lastSavedAt);
          return;
        } catch (e) {}
        this.saveStatus = "Error";
        this.notify("save_error", err.message);
      }
    }

    undo() {
      if (!this.canUndo() || !this.currentResume) return;

      // Push current into future
      const currentSnapshot = deepClone(this.currentResume);
      this.future.push(currentSnapshot);

      // Restore last state from past
      const previousState = this.past.pop();
      this.currentResume = previousState;
      this.isDirty = true;
      this.saveStatus = "Unsaved";

      this.notify("undo");
      this.scheduleAutosave();
    }

    redo() {
      if (!this.canRedo() || !this.currentResume) return;

      // Push current into past
      const currentSnapshot = deepClone(this.currentResume);
      this.past.push(currentSnapshot);

      // Restore next state from future
      const nextState = this.future.pop();
      this.currentResume = nextState;
      this.isDirty = true;
      this.saveStatus = "Unsaved";

      this.notify("redo");
      this.scheduleAutosave();
    }

    // =========================================================================
    // Fine-Grained Section & Item Mutation Helpers
    // =========================================================================

    updatePersonalInfo(field, value) {
      this.updateCurrentResume((resume) => {
        if (!resume.personal) resume.personal = {};
        resume.personal[field] = value;
      });
    }

    updateSummary(summaryText) {
      this.updateCurrentResume((resume) => {
        resume.summary = summaryText;
      });
    }

    updateTemplateSettings(newSettings) {
      this.updateCurrentResume((resume) => {
        resume.templateSettings = {
          ...resume.templateSettings,
          ...newSettings,
        };
      });
    }

    addPersonalLink(url = "", label = "Portfolio") {
      this.updateCurrentResume((resume) => {
        if (!resume.personal) resume.personal = {};
        if (!resume.personal.links) resume.personal.links = [];
        resume.personal.links.push({ url, label });
      });
    }

    updatePersonalLink(index, linkData) {
      this.updateCurrentResume((resume) => {
        if (resume.personal && resume.personal.links && resume.personal.links[index]) {
          Object.assign(resume.personal.links[index], linkData);
        }
      });
    }

    removePersonalLink(index) {
      this.updateCurrentResume((resume) => {
        if (resume.personal && resume.personal.links) {
          resume.personal.links.splice(index, 1);
        }
      });
    }

    addSection(type = "custom", title = "New Section") {
      const sectionId = `sec-${type}-${Date.now().toString(36)}`;
      this.updateCurrentResume((resume) => {
        if (!resume.sections) resume.sections = [];
        resume.sections.push({
          id: sectionId,
          type: type,
          title: title,
          hidden: false,
          items: [],
        });
      });
      return sectionId;
    }

    updateSectionTitle(sectionId, title) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec) sec.title = title;
      });
    }

    removeSection(sectionId) {
      this.updateCurrentResume((resume) => {
        resume.sections = (resume.sections || []).filter((s) => s.id !== sectionId);
      });
    }

    toggleSectionVisibility(sectionId) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec) sec.hidden = !sec.hidden;
      });
    }

    reorderSections(fromIndex, toIndex) {
      this.updateCurrentResume((resume) => {
        const sections = resume.sections || [];
        if (fromIndex < 0 || fromIndex >= sections.length || toIndex < 0 || toIndex >= sections.length) return;
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
      });
    }

    addItem(sectionId, itemData = {}) {
      const itemId = `item-${Date.now().toString(36)}`;
      const newItem = {
        id: itemId,
        title: itemData.title || "",
        organization: itemData.organization || "",
        dates: itemData.dates || "",
        location: itemData.location || "",
        bullets: itemData.bullets || [],
        technologies: itemData.technologies || [],
        hidden: false,
      };

      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec) {
          if (!sec.items) sec.items = [];
          sec.items.push(newItem);
        }
      });
      return itemId;
    }

    updateItem(sectionId, itemId, itemData) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          const item = sec.items.find((i) => i.id === itemId);
          if (item) {
            Object.assign(item, itemData);
          }
        }
      });
    }

    updateItemTechnologies(sectionId, itemId, technologies) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          const item = sec.items.find((i) => i.id === itemId);
          if (item) {
            item.technologies = Array.isArray(technologies) ? technologies : [];
          }
        }
      });
    }

    removeItem(sectionId, itemId) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          sec.items = sec.items.filter((i) => i.id !== itemId);
        }
      });
    }

    toggleItemVisibility(sectionId, itemId) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          const item = sec.items.find((i) => i.id === itemId);
          if (item) item.hidden = !item.hidden;
        }
      });
    }

    reorderItems(sectionId, fromIndex, toIndex) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          if (fromIndex < 0 || fromIndex >= sec.items.length || toIndex < 0 || toIndex >= sec.items.length) return;
          const [moved] = sec.items.splice(fromIndex, 1);
          sec.items.splice(toIndex, 0, moved);
        }
      });
    }

    addBullet(sectionId, itemId, bulletText = "") {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          const item = sec.items.find((i) => i.id === itemId);
          if (item) {
            if (!item.bullets) item.bullets = [];
            item.bullets.push(bulletText);
          }
        }
      });
    }

    updateBullet(sectionId, itemId, bulletIndex, bulletText) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          const item = sec.items.find((i) => i.id === itemId);
          if (item && item.bullets && item.bullets[bulletIndex] !== undefined) {
            item.bullets[bulletIndex] = bulletText;
          }
        }
      });
    }

    removeBullet(sectionId, itemId, bulletIndex) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          const item = sec.items.find((i) => i.id === itemId);
          if (item && item.bullets) {
            item.bullets.splice(bulletIndex, 1);
          }
        }
      });
    }

    reorderBullets(sectionId, itemId, fromIndex, toIndex) {
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === sectionId);
        if (sec && sec.items) {
          const item = sec.items.find((i) => i.id === itemId);
          if (item && item.bullets) {
            if (fromIndex < 0 || fromIndex >= item.bullets.length || toIndex < 0 || toIndex >= item.bullets.length) return;
            const [moved] = item.bullets.splice(fromIndex, 1);
            item.bullets.splice(toIndex, 0, moved);
          }
        }
      });
    }

    // =========================================================================
    // Phase 6: ATS Evaluation & Surgical Fix Store Helpers
    // =========================================================================

    async evaluateATS(resumeId = null) {
      const targetId = resumeId || (this.currentResume ? this.currentResume.id : null);
      if (!targetId) return null;

      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes/${targetId}/evaluate-ats`, {
          method: "POST",
          headers: getAuthHeaders(),
        });

        if (!res.ok) {
          throw new Error("Failed to evaluate ATS score.");
        }

        const data = await res.json();
        if (this.currentResume && this.currentResume.id === targetId) {
          this.currentResume.readiness_score = data.readiness_score;
          this.currentResume.readiness_label = data.readiness_label;
          this.currentResume.atsSuggestions = data.suggestions || [];
          this.notify("ats_evaluated", data);
        }
        return data;
      } catch (err) {
        console.error("[ResumeBuilderStore] evaluateATS error:", err);
        throw err;
      }
    }

    updateATSSuggestionStatus(suggestionId, newStatus) {
      this.updateCurrentResume((resume) => {
        const sugs = resume.atsSuggestions || [];
        const found = sugs.find((s) => s.id === suggestionId);
        if (found) {
          found.status = newStatus;
        }
      });
    }

    applyATSChange({ targetSectionId, targetItemId, bulletIndex, newText, suggestionId = null }) {
      this.updateCurrentResume((resume) => {
        // 1. Update text content
        if (targetSectionId === "summary") {
          resume.summary = newText;
        } else if (targetSectionId === "personal") {
          if (targetItemId === "name") resume.personal.name = newText;
          else if (targetItemId === "email") resume.personal.email = newText;
          else if (targetItemId === "phone") resume.personal.phone = newText;
          else if (targetItemId === "location") resume.personal.location = newText;
        } else if (targetSectionId && targetItemId) {
          const sec = (resume.sections || []).find((s) => s.id === targetSectionId);
          if (sec && sec.items) {
            const itm = sec.items.find((i) => i.id === targetItemId);
            if (itm && itm.bullets && bulletIndex !== null && bulletIndex !== undefined) {
              if (itm.bullets[bulletIndex] !== undefined) {
                itm.bullets[bulletIndex] = newText;
              }
            }
          }
        }

        // 2. Mark suggestion Completed if provided
        if (suggestionId && resume.atsSuggestions) {
          const sug = resume.atsSuggestions.find((s) => s.id === suggestionId);
          if (sug) {
            sug.status = "Completed";
            sug.suggestedText = newText;
          }
        }
      });
    }

    // =========================================================================
    // Phase 7: Optimize for Job Methods
    // =========================================================================

    async saveTargetJob({ title, company, description }) {
      if (!this.currentResume) return null;
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes/${this.currentResume.id}/target-jobs`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, company: company || "", description }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to analyze and save target job.");
        }
        const targetJob = await res.json();
        this.updateCurrentResume((resume) => {
          if (!resume.targetJobs) resume.targetJobs = [];
          resume.targetJobs.forEach((tj) => { tj.is_active = false; });
          targetJob.is_active = true;
          const existingIdx = resume.targetJobs.findIndex((tj) => tj.id === targetJob.id);
          if (existingIdx >= 0) {
            resume.targetJobs[existingIdx] = targetJob;
          } else {
            resume.targetJobs.unshift(targetJob);
          }
        });
        this.notify("target_job_saved", targetJob);
        return targetJob;
      } catch (err) {
        console.error("[ResumeBuilderStore] saveTargetJob error:", err);
        throw err;
      }
    }

    async setActiveTargetJob(jobId) {
      if (!this.currentResume) return;
      try {
        await fetch(`${getApiBaseUrl()}/api/resumes/${this.currentResume.id}/target-jobs/${jobId}/active`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        this.updateCurrentResume((resume) => {
          (resume.targetJobs || []).forEach((tj) => {
            tj.is_active = (tj.id === jobId);
          });
        });
        this.notify("active_target_job_changed", jobId);
      } catch (err) {
        console.error("[ResumeBuilderStore] setActiveTargetJob error:", err);
      }
    }

    async deleteTargetJob(jobId) {
      if (!this.currentResume) return;
      try {
        await fetch(`${getApiBaseUrl()}/api/resumes/${this.currentResume.id}/target-jobs/${jobId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        this.updateCurrentResume((resume) => {
          resume.targetJobs = (resume.targetJobs || []).filter((tj) => tj.id !== jobId);
          if (resume.targetJobs.length > 0 && !resume.targetJobs.some((tj) => tj.is_active)) {
            resume.targetJobs[0].is_active = true;
          }
        });
        this.notify("target_job_deleted", jobId);
      } catch (err) {
        console.error("[ResumeBuilderStore] deleteTargetJob error:", err);
        throw err;
      }
    }

    addMissingSkillToResume(skillName) {
      if (!skillName || !this.currentResume) return;
      const cleanSkill = skillName.trim();
      this.updateCurrentResume((resume) => {
        if (!resume.sections) resume.sections = [];
        let skillsSec = resume.sections.find((s) => s.type === "skills" || s.title.toLowerCase().includes("skill"));
        if (!skillsSec) {
          skillsSec = {
            id: `sec-${Math.random().toString(36).substr(2, 8)}`,
            type: "skills",
            title: "Technical Skills",
            hidden: false,
            items: [
              {
                id: `item-${Math.random().toString(36).substr(2, 8)}`,
                title: "Technologies",
                organization: "",
                dates: "",
                location: "",
                bullets: [],
                technologies: [cleanSkill],
                hidden: false,
              },
            ],
          };
          resume.sections.push(skillsSec);
        } else {
          if (!skillsSec.items || skillsSec.items.length === 0) {
            skillsSec.items = [
              {
                id: `item-${Math.random().toString(36).substr(2, 8)}`,
                title: "Core Technologies",
                organization: "",
                dates: "",
                location: "",
                bullets: [],
                technologies: [cleanSkill],
                hidden: false,
              },
            ];
          } else {
            const firstItem = skillsSec.items[0];
            if (!firstItem.technologies) firstItem.technologies = [];
            if (!firstItem.technologies.some((t) => t.toLowerCase() === cleanSkill.toLowerCase())) {
              firstItem.technologies.push(cleanSkill);
            }
          }
        }
      });
      this.notify("skill_added", cleanSkill);
    }

    applyTailoredBullet({ targetSectionId, targetItemId, bulletIndex, newText }) {
      if (!this.currentResume || !newText) return;
      this.updateCurrentResume((resume) => {
        const sec = (resume.sections || []).find((s) => s.id === targetSectionId);
        if (sec && sec.items) {
          const itm = sec.items.find((i) => i.id === targetItemId);
          if (itm && itm.bullets && bulletIndex !== null && bulletIndex !== undefined) {
            if (itm.bullets[bulletIndex] !== undefined) {
              itm.bullets[bulletIndex] = newText;
            }
          }
        }
      });
      this.notify("bullet_tailored", { targetSectionId, targetItemId, bulletIndex, newText });
    }

    async fetchImportableJobs() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/resumes/import-jobs`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.jobs || [];
      } catch (err) {
        console.warn("[ResumeBuilderStore] fetchImportableJobs error:", err);
        return [];
      }
    }

    // =========================================================================
    // Phase 8: Document Export Helpers (DOCX, Plain Text & Custom Filenames)
    // =========================================================================

    getStandardFilename(customName = "", ext = ".pdf") {
      ext = ext.startsWith(".") ? ext : `.${ext}`;
      if (customName && customName.trim()) {
        const clean = customName.trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "_");
        if (clean) return `${clean}${ext}`;
      }
      const p = this.currentResume?.personal?.name || "";
      const raw = (p.trim() || this.currentResume?.name || "Resume").trim();
      let clean = raw.replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "_");
      if (!clean || clean.toLowerCase() === "untitled_resume" || clean.toLowerCase() === "resume") {
        clean = "JobNex_Resume";
      } else if (!clean.toLowerCase().endsWith("resume")) {
        clean = `${clean}_Resume`;
      }
      return `${clean}${ext}`;
    }

    generatePlainText() {
      if (!this.currentResume) return "";
      const r = this.currentResume;
      const lines = [];
      const p = r.personal || {};
      const name = (p.name || r.name || "Candidate").trim();
      lines.push(name.toUpperCase());

      const contact = [];
      if (p.email) contact.push(p.email);
      if (p.phone) contact.push(p.phone);
      if (p.location) contact.push(p.location);
      if (p.links && p.links.length) {
        p.links.forEach((l) => { if (l.url) contact.push(l.url); });
      }
      if (contact.length) lines.push(contact.join(" | "));
      lines.push("=".repeat(72));
      lines.push("");

      if (r.summary && r.summary.trim()) {
        lines.push("PROFESSIONAL SUMMARY");
        lines.push("-".repeat(40));
        lines.push(r.summary.trim());
        lines.push("");
      }

      (r.sections || []).forEach((sec) => {
        if (sec.hidden) return;
        const visibleItems = (sec.items || []).filter((i) => !i.hidden);
        if (!visibleItems.length) return;

        lines.push(sec.title.toUpperCase());
        lines.push("-".repeat(40));

        if (sec.type === "skills") {
          visibleItems.forEach((it) => {
            const list = it.technologies && it.technologies.length ? it.technologies : it.bullets;
            if (it.title && list && list.length) {
              lines.push(`${it.title}: ${list.join(", ")}`);
            } else if (it.title) {
              lines.push(`* ${it.title}`);
            }
          });
          lines.push("");
        } else {
          visibleItems.forEach((it) => {
            const parts = [];
            if (it.title) parts.push(it.title);
            if (it.organization) parts.push(it.organization);
            if (it.location) parts.push(it.location);
            if (it.dates) parts.push(it.dates);
            if (parts.length) lines.push(parts.join(" | "));

            (it.bullets || []).forEach((b) => {
              const clean = b.trim().replace(/^[•\-*]\s*/, "").trim();
              if (clean) lines.push(`  * ${clean}`);
            });

            if (it.technologies && it.technologies.length) {
              lines.push(`    Technologies: ${it.technologies.join(", ")}`);
            }
            lines.push("");
          });
        }
      });

      return lines.join("\n").trim() + "\n";
    }

    async exportDocx(customFilename = "") {
      if (!this.currentResume) throw new Error("No active resume to export.");
      await this.saveNow();

      const finalName = this.getStandardFilename(customFilename, ".docx");
      const url = `${getApiBaseUrl()}/api/resumes/${this.currentResume.id}/export-docx?filename=${encodeURIComponent(finalName)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resume: this.currentResume, filename: finalName }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to generate Word document.");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      return finalName;
    }

    async exportTxt(customFilename = "") {
      if (!this.currentResume) throw new Error("No active resume to export.");
      await this.saveNow();

      const finalName = this.getStandardFilename(customFilename, ".txt");
      const url = `${getApiBaseUrl()}/api/resumes/${this.currentResume.id}/export-txt?filename=${encodeURIComponent(finalName)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resume: this.currentResume, filename: finalName }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to generate plain text resume.");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      return finalName;
    }
  }

  window.JobNexResumeStore = new ResumeBuilderStore();
})(window);
