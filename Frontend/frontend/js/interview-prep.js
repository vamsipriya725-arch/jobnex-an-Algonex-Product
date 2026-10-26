/**
 * JobNex - Interview Prep Simulator Script
 */

document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("prep-role-select");
  const typeRadios = document.querySelectorAll('input[name="interview-type"]');
  const applyBtn = document.getElementById("btn-apply-role");
  const resetBtn = document.getElementById("btn-reset-simulator");
  const activeQuestionCard = document.getElementById("active-question-card");
  const completedCard = document.getElementById("completed-scorecard-card");
  const practiceAgainBtn = document.getElementById("btn-practice-again");

  // Load questions from mock-data or fallback
  const allInitialQuestions = window.JobNexData && window.JobNexData.INITIAL_INTERVIEW_QUESTIONS
    ? JSON.parse(JSON.stringify(window.JobNexData.INITIAL_INTERVIEW_QUESTIONS))
    : [
        {
          id: "q-1",
          question: "Explain the differences between RESTful APIs and GraphQL. When would you prefer one over the other?",
          category: "System Design & Architecture",
          isAnswered: false,
          idealAnswer: "REST is resource-centric and relies on standard HTTP methods. GraphQL allows clients to request exact shapes of data in a single network roundtrip, eliminating over-fetching."
        },
        {
          id: "q-2",
          question: "How do you handle database indexing and slow query optimization in a high-traffic production application?",
          category: "Databases & Performance",
          isAnswered: false,
          idealAnswer: "Run EXPLAIN ANALYZE to identify sequential scans, create targeted B-Tree or Composite indexes, optimize join operations, and introduce Redis caching."
        },
        {
          id: "q-3",
          question: "Describe how you manage state and prevent unnecessary re-renders in a complex React/JavaScript application.",
          category: "Frontend Architecture",
          isAnswered: false,
          idealAnswer: "Keep state local, use atomic state stores or context splitting, memoize expensive calculations with useMemo/useCallback, and avoid passing inline anonymous functions."
        }
      ];

  let session = {
    role: "Software Engineer",
    type: "Technical",
    currentQuestionIndex: 0,
    isCompleted: false,
    questions: JSON.parse(JSON.stringify(allInitialQuestions)),
    overallScore: 88,
    benchmarkPercentile: 92,
  };

  let candidateAnswer = "";
  let isSubmitting = false;
  let isRecording = false;

  function initSession() {
    session.currentQuestionIndex = 0;
    session.isCompleted = false;
    session.questions = JSON.parse(JSON.stringify(allInitialQuestions)).map((q) => {
      delete q.score;
      delete q.accuracyScore;
      delete q.communicationScore;
      delete q.relevanceScore;
      delete q.actionableFeedback;
      q.isAnswered = false;
      return q;
    });
    candidateAnswer = "";
    isSubmitting = false;
    isRecording = false;
    render();
  }

  function getSelectedType() {
    let checkedVal = "Technical";
    typeRadios.forEach((r) => {
      if (r.checked) checkedVal = r.value;
    });
    return checkedVal;
  }

  function render() {
    if (session.isCompleted) {
      if (activeQuestionCard) activeQuestionCard.classList.add("hidden");
      if (completedCard) {
        completedCard.classList.remove("hidden");
        const overallEl = document.getElementById("scorecard-overall");
        const percEl = document.getElementById("scorecard-percentile");
        const summaryEl = document.getElementById("scorecard-summary");

        // Calculate average score
        const answered = session.questions.filter((q) => q.score !== undefined);
        const avg = answered.length > 0
          ? Math.round(answered.reduce((sum, q) => sum + (q.score || 85), 0) / answered.length)
          : 88;

        if (overallEl) overallEl.textContent = `${avg}/100`;
        if (percEl) percEl.textContent = `Top ${Math.min(99, avg + 4)}%`;
        if (summaryEl) {
          summaryEl.textContent = avg >= 85
            ? "Exceptional technical command and structured communication. Your explanations showed strong architectural depth and crisp problem breakdown."
            : "Good foundational knowledge with areas for polish in distributed system trade-offs and edge-case handling.";
        }
      }
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (completedCard) completedCard.classList.add("hidden");
    if (activeQuestionCard) activeQuestionCard.classList.remove("hidden");

    const currentQ = session.questions[session.currentQuestionIndex];
    if (!currentQ) return;

    let html = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold uppercase px-3 py-1 rounded-full bg-brand-100 text-brand-700">
            Question ${session.currentQuestionIndex + 1} of ${session.questions.length}
          </span>
          <span class="text-xs font-semibold text-slate-700 hidden sm:inline">
            • ${currentQ.category || session.type}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          ${session.questions.map((q, i) => `
            <div class="w-2.5 h-2.5 rounded-full transition-all ${
              i === session.currentQuestionIndex
                ? "bg-brand-600 ring-4 ring-brand-100"
                : q.isAnswered
                  ? "bg-emerald-500"
                  : "bg-slate-200"
            }"></div>
          `).join("")}
        </div>
      </div>

      <div class="p-5 rounded-lg bg-slate-50 border border-slate-200">
        <h2 class="text-base sm:text-lg font-bold text-slate-900 leading-snug m-0">
          ${currentQ.question}
        </h2>
      </div>
    `;

    if (!currentQ.isAnswered) {
      html += `
        <div class="space-y-4">
          <div class="relative">
            <textarea
              id="candidate-answer-input"
              rows="6"
              placeholder="Type your structured answer here, or click the mic button to speak your answer..."
              class="w-full p-4 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none font-medium leading-relaxed"
            >${escapeHtml(candidateAnswer)}</textarea>

            <button
              type="button"
              id="btn-toggle-mic"
              class="absolute right-3 bottom-4 p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm cursor-pointer ${
                isRecording
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }"
              title="Speech-to-text recording"
            >
              <i data-lucide="${isRecording ? "mic-off" : "mic"}" class="w-4 h-4"></i>
              <span>${isRecording ? "Listening..." : "Speak"}</span>
            </button>
          </div>

          <div class="flex items-center justify-between pt-2">
            <button
              type="button"
              id="btn-skip-q"
              class="text-xs font-bold text-slate-700 hover:text-slate-900 px-4 py-2 cursor-pointer"
            >
              Skip Question
            </button>

            <button
              type="button"
              id="btn-submit-answer"
              class="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              ${!candidateAnswer.trim() || isSubmitting ? "disabled" : ""}
            >
              ${isSubmitting ? `
                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Grading with AI...</span>
              ` : `
                <span>Submit Answer</span>
                <i data-lucide="chevron-right" class="w-4 h-4"></i>
              `}
            </button>
          </div>
        </div>
      `;
    } else {
      // Show Assessment
      html += `
        <div class="space-y-5">
          <div class="p-5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600"></i>
                <span class="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  AI Answer Assessment
                </span>
              </div>
              <div class="text-right">
                <span class="text-2xl font-semibold text-emerald-600">
                  ${currentQ.score}/100
                </span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3 pt-2 border-t border-emerald-200/60">
              <div class="bg-white p-3 rounded-xl border border-emerald-100 text-center">
                <p class="text-[10px] font-bold text-slate-700 uppercase m-0">Accuracy</p>
                <p class="text-sm font-semibold text-slate-900 mt-0.5 m-0">${currentQ.accuracyScore}%</p>
              </div>
              <div class="bg-white p-3 rounded-xl border border-emerald-100 text-center">
                <p class="text-[10px] font-bold text-slate-700 uppercase m-0">Clarity</p>
                <p class="text-sm font-semibold text-slate-900 mt-0.5 m-0">${currentQ.communicationScore}%</p>
              </div>
              <div class="bg-white p-3 rounded-xl border border-emerald-100 text-center">
                <p class="text-[10px] font-bold text-slate-700 uppercase m-0">Relevance</p>
                <p class="text-sm font-semibold text-slate-900 mt-0.5 m-0">${currentQ.relevanceScore}%</p>
              </div>
            </div>

            <div class="bg-white p-4 rounded-xl border border-emerald-100 space-y-1">
              <p class="text-xs font-bold text-slate-900 flex items-center gap-1.5 m-0">
                <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-amber-600"></i>
                <span>Actionable Improvement:</span>
              </p>
              <p class="text-xs text-slate-700 leading-relaxed m-0">
                ${currentQ.actionableFeedback}
              </p>
            </div>

            ${currentQ.idealAnswer ? `
              <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <p class="text-xs font-bold text-slate-700 uppercase tracking-wide m-0">
                  Benchmark Ideal Answer:
                </p>
                <p class="text-xs text-slate-600 leading-relaxed italic m-0">
                  ${currentQ.idealAnswer}
                </p>
              </div>
            ` : ""}
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="button"
              id="btn-next-q"
              class="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>${
                session.currentQuestionIndex === session.questions.length - 1
                  ? "Finish & View Scorecard"
                  : "Next Question"
              }</span>
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }

    activeQuestionCard.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();

    // Attach listeners
    const answerInput = document.getElementById("candidate-answer-input");
    if (answerInput) {
      answerInput.addEventListener("input", (e) => {
        candidateAnswer = e.target.value;
        const submitBtn = document.getElementById("btn-submit-answer");
        if (submitBtn) {
          submitBtn.disabled = !candidateAnswer.trim() || isSubmitting;
        }
      });
    }

    const micBtn = document.getElementById("btn-toggle-mic");
    if (micBtn) {
      micBtn.addEventListener("click", () => {
        if (!isRecording) {
          isRecording = true;
          render();
          setTimeout(() => {
            const current = candidateAnswer ? candidateAnswer + " " : "";
            candidateAnswer = current + "REST APIs communicate statelessly over HTTP verbs like GET and POST for structured resource access, whereas GraphQL provides a unified endpoint where clients query exact nested schemas.";
            isRecording = false;
            if (window.JobNexUtils) window.JobNexUtils.playSound("click");
            render();
          }, 2000);
        } else {
          isRecording = false;
          render();
        }
      });
    }

    const submitBtn = document.getElementById("btn-submit-answer");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (!candidateAnswer.trim() || isSubmitting) return;
        isSubmitting = true;
        render();

        setTimeout(() => {
          isSubmitting = false;
          const current = session.questions[session.currentQuestionIndex];
          current.isAnswered = true;
          current.score = 90;
          current.accuracyScore = 92;
          current.communicationScore = 88;
          current.relevanceScore = 94;
          current.actionableFeedback = "Structure your answer with the STAR framework (Situation, Task, Action, Result) to make architectural trade-offs immediately clear to the engineering panel.";
          if (window.JobNexUtils) window.JobNexUtils.playSound("success");
          render();
        }, 1200);
      });
    }

    const skipBtn = document.getElementById("btn-skip-q");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        advanceQuestion();
      });
    }

    const nextBtn = document.getElementById("btn-next-q");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        advanceQuestion();
      });
    }
  }

  function advanceQuestion() {
    candidateAnswer = "";
    if (session.currentQuestionIndex < session.questions.length - 1) {
      session.currentQuestionIndex += 1;
      render();
    } else {
      session.isCompleted = true;
      render();
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      session.role = roleSelect.value;
      session.type = getSelectedType();
      if (window.JobNexUtils) window.JobNexUtils.showToast(`Applied role: ${session.role} (${session.type})`, "info");
      initSession();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (window.JobNexUtils) window.JobNexUtils.showToast("Simulator reset to Question 1", "info");
      initSession();
    });
  }

  if (practiceAgainBtn) {
    practiceAgainBtn.addEventListener("click", () => {
      initSession();
    });
  }

  // Initial load
  initSession();
});
