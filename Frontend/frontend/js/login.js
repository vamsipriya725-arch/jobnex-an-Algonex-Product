/**
 * JobNex - Login & Sign-up Script
 */

document.addEventListener("DOMContentLoaded", () => {
  // Init starfield backdrop
  if (window.JobNexUtils && window.JobNexUtils.initStarfield) {
    window.JobNexUtils.initStarfield("starfield-canvas");
  }

  const authCard = document.getElementById("auth-card");
  const tabSignin = document.getElementById("btn-tab-signin");
  const tabSignup = document.getElementById("btn-tab-signup");
  const roleBtnSeeker = document.getElementById("role-btn-seeker");
  const roleBtnRecruiter = document.getElementById("role-btn-recruiter");
  const errorBanner = document.getElementById("auth-error-banner");
  const errorText = document.getElementById("auth-error-text");

  const fieldFullname = document.getElementById("field-fullname");
  const fieldPhone = document.getElementById("field-phone");
  const fieldConfirmPass = document.getElementById("field-confirm-password");
  const inputFullname = document.getElementById("input-fullname");
  const inputPhone = document.getElementById("input-phone");
  const inputEmail = document.getElementById("input-email");
  const inputPassword = document.getElementById("input-password");
  const inputConfirmPass = document.getElementById("input-confirm-pass");
  const btnTogglePass = document.getElementById("btn-toggle-pass");
  const btnSubmitAuth = document.getElementById("btn-submit-auth");
  const btnSubmitText = document.getElementById("btn-submit-text");
  const authForm = document.getElementById("auth-form");

  // Demos
  const demoSandeep = document.getElementById("btn-demo-sandeep");
  const demoSarah = document.getElementById("btn-demo-sarah");
  const demoShake = document.getElementById("btn-demo-shake");

  // Accessibility
  const soundBtn = document.getElementById("btn-toggle-sound");
  const soundLabel = document.getElementById("sound-toggle-label");
  const motionBtn = document.getElementById("btn-toggle-motion");
  const motionLabel = document.getElementById("motion-toggle-label");

  let mode = "login"; // "login" | "signup"
  let role = "JOB_SEEKER"; // "JOB_SEEKER" | "RECRUITER"
  let showPassword = false;
  let soundEnabled = true;
  let reducedMotion = false;

  function switchMode(newMode) {
    mode = newMode;
    hideError();

    if (mode === "login") {
      tabSignin.className = "py-2 rounded-lg text-xs font-bold transition-all bg-brand-600 text-white shadow-md cursor-pointer";
      tabSignup.className = "py-2 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white cursor-pointer";
      fieldFullname.classList.add("hidden");
      fieldPhone.classList.add("hidden");
      fieldConfirmPass.classList.add("hidden");
      btnSubmitText.textContent = "Sign In to JobNex";
    } else {
      tabSignup.className = "py-2 rounded-lg text-xs font-bold transition-all bg-brand-600 text-white shadow-md cursor-pointer";
      tabSignin.className = "py-2 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white cursor-pointer";
      fieldFullname.classList.remove("hidden");
      fieldPhone.classList.remove("hidden");
      fieldConfirmPass.classList.remove("hidden");
      btnSubmitText.textContent = "Create Free Account";
    }

    if (soundEnabled && window.JobNexUtils) window.JobNexUtils.playSound("click");
  }

  function setRole(newRole) {
    role = newRole;
    if (role === "JOB_SEEKER") {
      roleBtnSeeker.className = "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all bg-brand-500/20 border-brand-400 text-white cursor-pointer";
      roleBtnRecruiter.className = "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all bg-white/5 border-white/10 text-slate-400 hover:text-white cursor-pointer";
    } else {
      roleBtnRecruiter.className = "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all bg-brand-500/20 border-brand-400 text-white cursor-pointer";
      roleBtnSeeker.className = "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all bg-white/5 border-white/10 text-slate-400 hover:text-white cursor-pointer";
    }
    if (soundEnabled && window.JobNexUtils) window.JobNexUtils.playSound("click");
  }

  function showError(msg) {
    if (errorBanner && errorText) {
      errorText.textContent = msg;
      errorBanner.classList.remove("hidden");
    }

    if (soundEnabled && window.JobNexUtils) {
      window.JobNexUtils.playSound("error");
    }

    if (authCard && !reducedMotion) {
      authCard.classList.remove("card-shake");
      void authCard.offsetWidth; // force reflow
      authCard.classList.add("card-shake");
      setTimeout(() => {
        authCard.classList.remove("card-shake");
      }, 600);
    }
  }

  function hideError() {
    if (errorBanner) errorBanner.classList.add("hidden");
  }

  function loginAndRedirect(name, email, chosenRole) {
    hideError();
    if (window.JobNexAuth) {
      window.JobNexAuth.login({
        name: name,
        email: email,
        role: chosenRole,
      });
    }

    if (soundEnabled && window.JobNexUtils) window.JobNexUtils.playSound("success");
    if (window.JobNexUtils) window.JobNexUtils.showToast(`Welcome, ${name}! Redirecting...`, "success");

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 600);
  }

  if (tabSignin) tabSignin.addEventListener("click", () => switchMode("login"));
  if (tabSignup) tabSignup.addEventListener("click", () => switchMode("signup"));

  if (roleBtnSeeker) roleBtnSeeker.addEventListener("click", () => setRole("JOB_SEEKER"));
  if (roleBtnRecruiter) roleBtnRecruiter.addEventListener("click", () => setRole("RECRUITER"));

  if (btnTogglePass) {
    btnTogglePass.addEventListener("click", () => {
      showPassword = !showPassword;
      inputPassword.type = showPassword ? "text" : "password";
      btnTogglePass.innerHTML = `<i data-lucide="${showPassword ? "eye-off" : "eye"}" class="w-4 h-4"></i>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Demos
  if (demoSandeep) {
    demoSandeep.addEventListener("click", () => {
      inputEmail.value = "candidate@jobnex.ai";
      inputPassword.value = "password123";
      setRole("JOB_SEEKER");
      loginAndRedirect("Candidate", "candidate@jobnex.ai", "JOB_SEEKER");
    });
  }

  if (demoSarah) {
    demoSarah.addEventListener("click", () => {
      inputEmail.value = "sarah.recruiting@google.com";
      inputPassword.value = "password123";
      setRole("RECRUITER");
      loginAndRedirect("Sarah Jenkins", "sarah.recruiting@google.com", "RECRUITER");
    });
  }

  if (demoShake) {
    demoShake.addEventListener("click", () => {
      showError("Demo Error: Invalid email credentials or network timeout. Please verify.");
    });
  }

  // Sound and motion toggles
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      soundLabel.textContent = `Sound FX: ${soundEnabled ? "On" : "Off"}`;
      soundBtn.innerHTML = `
        <i data-lucide="${soundEnabled ? "volume-2" : "volume-x"}" class="w-4 h-4"></i>
        <span>Sound FX: ${soundEnabled ? "On" : "Off"}</span>
      `;
      if (window.lucide) window.lucide.createIcons();
    });
  }

  if (motionBtn) {
    motionBtn.addEventListener("click", () => {
      reducedMotion = !reducedMotion;
      motionLabel.textContent = `Motion: ${reducedMotion ? "Reduced" : "Normal"}`;
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = inputEmail.value.trim();
      const pass = inputPassword.value;

      if (!email || !email.includes("@")) {
        showError("Please enter a valid work or personal email address.");
        return;
      }

      if (!pass || pass.length < 6) {
        showError("Password must be at least 6 characters.");
        return;
      }

      if (mode === "signup") {
        const name = inputFullname.value.trim();
        const confPass = inputConfirmPass.value;

        if (!name) {
          showError("Please enter your full name.");
          return;
        }

        if (pass !== confPass) {
          showError("Passwords do not match. Please verify.");
          return;
        }

        loginAndRedirect(name, email, role);
      } else {
        const candidateName = email.split("@")[0].replace(".", " ");
        const formattedName = candidateName.charAt(0).toUpperCase() + candidateName.slice(1);
        loginAndRedirect(formattedName || "Candidate", email, role);
      }
    });
  }

  if (window.lucide) window.lucide.createIcons();
});
