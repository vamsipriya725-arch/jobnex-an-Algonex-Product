/**
 * JobNex Supabase Client (Frontend Static Pages)
 * Exposes window.JobNexSupabase client for authentication, jobs, applications, and storage.
 */
(function () {
  let SUPABASE_URL = window.JOBNEX_SUPABASE_URL || localStorage.getItem("jobnex_supabase_url") || "https://swqebafkntjlgjglylcr.supabase.co";
  let SUPABASE_ANON_KEY = window.JOBNEX_SUPABASE_ANON_KEY || localStorage.getItem("jobnex_supabase_anon_key") || "sb_publishable_ax9iQjGlK5pP34biLoMcag_0egUp2qE";

  let client = null;

  function initClient(url, key) {
    if (typeof window.supabase !== "undefined" && window.supabase.createClient) {
      try {
        client = window.supabase.createClient(url || SUPABASE_URL, key || SUPABASE_ANON_KEY);

        // Listen to auth state changes to keep navbar / session in sync
        client.auth.onAuthStateChange((event, session) => {
          if (session && session.user) {
            const u = session.user;
            const meta = u.user_metadata || {};
            const displayName = meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : "Candidate");
            const avatarUrl = meta.avatar_url || meta.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff&bold=true`;
            if (window.JobNexAuth) {
              window.JobNexAuth.login({
                id: u.id,
                name: displayName,
                email: u.email || "",
                avatar: avatarUrl,
                role: (meta.role || "seeker").toUpperCase() === "RECRUITER" ? "RECRUITER" : "JOB_SEEKER",
              });
            }
          } else if (event === "SIGNED_OUT") {
            if (window.JobNexAuth) {
              window.JobNexAuth.logout();
            }
          }
        });
        return client;
      } catch (e) {
        console.warn("[Supabase] Init notice:", e);
      }
    }
    return null;
  }

  // Attempt auto-config from backend API
  fetch("/api/config/supabase")
    .then((r) => r.json())
    .then((cfg) => {
      if (cfg && cfg.supabase_url && cfg.supabase_url !== "https://your-project-id.supabase.co") {
        SUPABASE_URL = cfg.supabase_url;
        SUPABASE_ANON_KEY = cfg.supabase_anon_key;
        localStorage.setItem("jobnex_supabase_url", SUPABASE_URL);
        localStorage.setItem("jobnex_supabase_anon_key", SUPABASE_ANON_KEY);
        initClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      }
    })
    .catch(() => {});

  function getClient() {
    if (client) return client;
    return initClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // Try immediate init
  initClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.JobNexSupabase = {
    getClient,
    initClient,
    get url() { return SUPABASE_URL; },
    get anonKey() { return SUPABASE_ANON_KEY; },
    /**
     * Create a temporary signed URL for viewing/downloading private resumes
     * Uses the Supabase active URL signing key on the server
     */
    async getResumeSignedUrl(filePath, expiresIn = 3600) {
      const c = getClient();
      if (!c) return { error: "Supabase client not initialized" };
      return await c.storage.from("resumes").createSignedUrl(filePath, expiresIn);
    },
    /**
     * Upload a resume PDF to the user's private folder in the resumes bucket
     */
    async uploadResume(userId, file) {
      const c = getClient();
      if (!c) return { error: "Supabase client not initialized" };
      const filePath = `${userId}/${Date.now()}_${file.name}`;
      return await c.storage.from("resumes").upload(filePath, file, {
        cacheControl: "3600",
        upsert: true
      });
    }
  };
})();
