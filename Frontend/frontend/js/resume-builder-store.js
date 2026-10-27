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
    // Check if hosted directly under FastAPI or standalone http.server on 3000
    if (window.location.port === "8000") {
      return "";
    }
    return "http://127.0.0.1:8000";
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
        console.error("[ResumeBuilderStore] fetchResumes failed:", err);
        throw err;
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
        console.error("[ResumeBuilderStore] Autosave failed:", err);
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
  }

  window.JobNexResumeStore = new ResumeBuilderStore();
})(window);
