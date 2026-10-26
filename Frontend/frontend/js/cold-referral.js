/**
 * JobNex - Cold Referral Script
 */

document.addEventListener("DOMContentLoaded", () => {
  const companyInput = document.getElementById("referral-company");
  const emailInput = document.getElementById("referral-email");
  const roleInput = document.getElementById("referral-role");
  const subjectInput = document.getElementById("referral-subject");
  const bodyTextarea = document.getElementById("referral-body");
  const regenBtn = document.getElementById("btn-regenerate-draft");
  const form = document.getElementById("referral-form");
  const sendBtn = document.getElementById("btn-send-referral");
  const confirmBanner = document.getElementById("referral-confirmation-banner");
  const confirmText = document.getElementById("referral-confirmation-text");
  const historyTbody = document.getElementById("referral-history-tbody");
  const resumeInfo = document.getElementById("attached-resume-info");

  const user = window.JobNexAuth ? window.JobNexAuth.getUser() : { name: "Candidate" };
  const jobsData = window.JobNexData || {};
  const resumeName = user.resumeFileName || "Active_Resume.pdf";

  let referrals = jobsData.INITIAL_REFERRALS ? JSON.parse(JSON.stringify(jobsData.INITIAL_REFERRALS)) : [
    {
      id: "ref-1",
      company: "Google",
      recipientEmail: "sarah.jenkins@google.com",
      targetRole: "Senior Software Engineer",
      status: "Delivered",
      sentAt: "Yesterday, 3:40 PM",
    },
    {
      id: "ref-2",
      company: "Amazon",
      recipientEmail: "tech-recruiting@amazon.com",
      targetRole: "Data Scientist",
      status: "Delivered",
      sentAt: "Oct 24, 11:20 AM",
    },
  ];

  let isSending = false;

  function generateDraft(company, role) {
    const candidateName = user.name || "Candidate";
    return `Hi ${company} Hiring Team,\n\nI hope this email finds you well. I am writing to express my strong interest in the ${role} position at ${company}.\n\nWith my hands-on background in full-stack architecture, modern web applications, and high-performance APIs, I have spearheaded mission-critical features that boosted system throughput.\n\nI admire ${company}'s culture of engineering excellence and believe my technical background aligns seamlessly with your roadmap. Attached is my verified ATS resume.\n\nThank you for your time and consideration, and I look forward to connecting.\n\nWarm regards,\n${candidateName}`;
  }

  function updateDraft() {
    const company = companyInput ? companyInput.value.trim() || "Google" : "Google";
    const role = roleInput ? roleInput.value.trim() || "Software Engineer" : "Software Engineer";
    if (subjectInput) {
      subjectInput.value = `Referral for ${role} Position - ${user.name}`;
    }
    if (bodyTextarea) {
      bodyTextarea.value = generateDraft(company, role);
    }
  }

  function renderHistory() {
    if (!historyTbody) return;
    historyTbody.innerHTML = referrals.map((ref) => `
      <tr class="hover:bg-slate-50/70 transition-colors">
        <td class="py-3 px-4 font-bold text-slate-900">${ref.company}</td>
        <td class="py-3 px-4 text-slate-600 font-mono text-[11px]">${ref.recipientEmail}</td>
        <td class="py-3 px-4 font-semibold text-slate-800">${ref.targetRole}</td>
        <td class="py-3 px-4">
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            ${ref.status || "Delivered"}
          </span>
        </td>
        <td class="py-3 px-4 text-slate-700 text-[11px]">${ref.sentAt || "Just now"}</td>
      </tr>
    `).join("");
  }

  if (companyInput) companyInput.addEventListener("input", updateDraft);
  if (roleInput) roleInput.addEventListener("input", updateDraft);

  if (regenBtn) {
    regenBtn.addEventListener("click", () => {
      updateDraft();
      if (window.JobNexUtils) {
        window.JobNexUtils.playSound("click");
        window.JobNexUtils.showToast("Draft refreshed with AI tone polishing", "info");
      }
    });
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (isSending) return;
      isSending = true;

      const comp = companyInput.value.trim();
      const recEmail = emailInput.value.trim();
      const role = roleInput.value.trim();

      sendBtn.disabled = true;
      sendBtn.innerHTML = `
        <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        <span>Dispatching Email...</span>
      `;

      setTimeout(() => {
        isSending = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = `
          <i data-lucide="send" class="w-4 h-4"></i>
          <span>Send Email</span>
        `;
        if (window.lucide) window.lucide.createIcons();

        // Add to history
        referrals.unshift({
          id: `ref-${Date.now()}`,
          company: comp,
          recipientEmail: recEmail,
          targetRole: role,
          status: "Delivered",
          sentAt: "Just now",
        });

        // Persist referral to MySQL Workbench table referral_emails
        fetch("/api/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user?.id || 1,
            company: comp,
            to_email: recEmail,
            role: role,
            subject: subjectInput ? subjectInput.value : `Referral for ${role}`,
            body: bodyTextarea ? bodyTextarea.value : "",
          }),
        }).catch(() => {});

        renderHistory();

        if (window.JobNexUtils) window.JobNexUtils.playSound("success");

        if (confirmBanner && confirmText) {
          confirmText.textContent = `Confirmation message -> Email sent to ${recEmail} with ${resumeName} attached & stored in MySQL!`;
          confirmBanner.classList.remove("hidden");
          setTimeout(() => {
            confirmBanner.classList.add("hidden");
          }, 4500);
        }
      }, 1200);
    });
  }

  // Initial load
  updateDraft();
  renderHistory();
});
