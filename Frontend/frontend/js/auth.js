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
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&auto=format&fit=crop&q=80",
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
        if (parsed && parsed.name && !parsed.name.toLowerCase().includes("sandeep")) {
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
    let chosenRole = role;

    if (typeof firstArg === "object" && firstArg !== null) {
      email = firstArg.email || "";
      name = firstArg.name || "";
      chosenRole = firstArg.role || chosenRole;
    } else if (typeof firstArg === "string") {
      email = firstArg;
    }

    if (!name && email && email.includes("@")) {
      const raw = email.split("@")[0];
      name = raw.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    if (!name) {
      name = chosenRole === "RECRUITER" ? "Recruiter" : "Candidate";
    }

    const prev = this.getUser();
    const user = {
      ...prev,
      email: email || prev.email || "",
      name: name,
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
    showToast("Signed out successfully.");
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
