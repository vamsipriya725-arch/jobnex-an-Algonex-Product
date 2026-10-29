/**
 * JobNex Authentication & User State (Plain JavaScript)
 * Manages demo login state, current role, and Supabase CDN integration.
 */

const DEFAULT_USER = {
  id: "u-1",
  name: "Candidate",
  email: "",
  phone: "",
  role: "JOB_SEEKER",
  avatar: "",
  headline: "Tech Professional & Candidate",
  currentCompany: "",
  resumeFileName: "",
  resumeText: ""
};

const Auth = {
  getUser() {
    try {
      const stored = localStorage.getItem("jobnex_user");
      if (stored) {
        const parsed = JSON.parse(stored);
      if (parsed && parsed.name) {
          // Clean legacy stock photos or dummy names
          if (parsed.avatar && parsed.avatar.includes("534528741775-53994a69daeb")) {
            parsed.avatar = parsed.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(parsed.name)}&background=2563eb&color=fff` : "";
          }
          if (parsed.name === "Google Verified Candidate" && parsed.email) {
            parsed.name = parsed.email.split("@")[0];
          }
          return parsed;
        }
      }
    } catch (e) {}
    return { ...DEFAULT_USER };
  },

  setUser(user) {
    try {
      localStorage.setItem("jobnex_user", JSON.stringify(user));
      localStorage.setItem("jobnex_is_logged_in", "true");
    } catch (e) {}
  },

  isLoggedIn() {
    try {
      return localStorage.getItem("jobnex_is_logged_in") !== "false";
    } catch (e) {
      return true;
    }
  },

  login(firstArg, role = "JOB_SEEKER") {
    let email = "";
    let name = "";
    let avatar = "";
    let id = "";
    let google_sub = "";
    let chosenRole = role;

    if (typeof firstArg === "object" && firstArg !== null) {
      email = firstArg.email || "";
      name = firstArg.name || "";
      avatar = firstArg.avatar || "";
      id = firstArg.id || "";
      google_sub = firstArg.google_sub || "";
      chosenRole = firstArg.role || chosenRole;
    } else if (typeof firstArg === "string") {
      email = firstArg;
    }

    if (!name && email && email.includes("@")) {
      const raw = email.split("@")[0];
      name = raw.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    if (!name || name === "Google Verified Candidate") {
      name = email ? email.split("@")[0] : (chosenRole === "RECRUITER" ? "Recruiter" : "Candidate");
    }

    const prev = this.getUser();
    let finalAvatar = avatar;
    if (!finalAvatar) {
      if (prev.avatar && !prev.avatar.includes("534528741775-53994a69daeb")) {
        finalAvatar = prev.avatar;
      } else {
        finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`;
      }
    }

    const user = {
      ...prev,
      id: id || prev.id || `u-${Date.now()}`,
      email: email || prev.email || "",
      name: name,
      avatar: finalAvatar,
      google_sub: google_sub || prev.google_sub || "",
      role: chosenRole
    };
    this.setUser(user);
    if (typeof updateNavbarUser === "function") {
      updateNavbarUser();
    }
  },

  logout() {
    try {
      localStorage.setItem("jobnex_is_logged_in", "false");
    } catch (e) {}
    if (typeof updateNavbarUser === "function") {
      updateNavbarUser();
    }
    if (typeof showToast === "function") {
      showToast("Signed out successfully.");
    }
  },

  // Initialize optional Supabase CDN client
  getSupabase() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabase !== "undefined" && supabase.createClient) {
      const url = "https://mock.supabase.co";
      const key = "sb_publishable_mock_local_client_key";
      window.supabaseClient = supabase.createClient(url, key);
      return window.supabaseClient;
    }
    return null;
  }
};

window.JobNexAuth = Auth;
