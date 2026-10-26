import React, { useState } from "react";
import { useJobNex } from "@/frontend/context/JobNexContext";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Trophy,
  Mic,
  MicOff,
  Lightbulb,
} from "lucide-react";

export function InterviewPrepView() {
  const { interviewSession, startInterview, submitAnswer, nextQuestion, resetInterview } =
    useJobNex();

  const [selectedRole, setSelectedRole] = useState(interviewSession.role);
  const [selectedType, setSelectedType] = useState<"Technical" | "HR">(interviewSession.type);
  const [candidateAnswerText, setCandidateAnswerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const currentQIndex = interviewSession.currentQuestionIndex;
  const currentQ = interviewSession.questions[currentQIndex];
  const isCompleted = interviewSession.isCompleted;

  const handleStartOrChange = () => {
    startInterview(selectedRole, selectedType);
    setCandidateAnswerText("");
  };

  const handleAnswerSubmit = async () => {
    if (!candidateAnswerText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await submitAnswer(candidateAnswerText.trim());
    setIsSubmitting(false);
  };

  const handleNext = () => {
    nextQuestion();
    setCandidateAnswerText("");
  };

  const handleSkip = () => {
    nextQuestion();
    setCandidateAnswerText("");
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setCandidateAnswerText((prev) =>
          prev
            ? `${prev} In addition, REST APIs ensure statelessness by making sure each client request contains all necessary auth and context parameters.`
            : "REST APIs use standard HTTP verbs like GET, POST, PUT, and DELETE to perform CRUD operations over resources identified by URIs. They maintain stateless communication where each request contains all required authentication context.",
        );
        setIsRecording(false);
      }, 2500);
    } else {
      setIsRecording(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center text-white shadow-md ">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                Interview Prep
              </h1>
              <p className="text-xs text-slate-700">
                Practice technical and HR interviews with structured feedback
              </p>
            </div>
          </div>

          <button
            onClick={resetInterview}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-brand-300 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Simulator</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Job Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-brand-500"
            >
              <option value="Software Engineer">Software Engineer</option>
              <option value="Data Scientist">Data Scientist</option>
              <option value="DevOps Engineer">DevOps Engineer</option>
              <option value="Full-Stack Developer">Full-Stack Developer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Interview Type</label>
            <div className="flex items-center gap-4 py-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="radio"
                  name="type"
                  value="Technical"
                  checked={selectedType === "Technical"}
                  onChange={() => setSelectedType("Technical")}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <span>Technical</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="radio"
                  name="type"
                  value="HR"
                  checked={selectedType === "HR"}
                  onChange={() => setSelectedType("HR")}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <span>HR</span>
              </label>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleStartOrChange}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <span>Apply Role / Refresh</span>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {!isCompleted ? (
        <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase px-3 py-1 rounded-full bg-brand-100 text-brand-700">
                Question {currentQIndex + 1} of {interviewSession.questions.length}
              </span>
              <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
                • {currentQ?.category}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {interviewSession.questions.map((q, i) => (
                <div
                  key={q.id}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === currentQIndex
                      ? "bg-brand-600 ring-4 ring-brand-100"
                      : q.isAnswered
                        ? "bg-emerald-500"
                        : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-5 rounded-lg bg-slate-50 border border-slate-200">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {currentQ?.question}
            </h3>
          </div>

          {!currentQ?.isAnswered ? (
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  rows={6}
                  value={candidateAnswerText}
                  onChange={(e) => setCandidateAnswerText(e.target.value)}
                  placeholder="Type your structured answer here, or click the mic button to speak your answer..."
                  className="w-full p-4 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none font-medium leading-relaxed"
                />

                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`absolute right-3 bottom-4 p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs ${
                    isRecording
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                  title="Speech-to-text recording"
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isRecording ? "Listening..." : "Speak"}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-xs font-bold text-slate-700 hover:text-slate-700 px-4 py-2"
                >
                  Skip Question
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAnswerSubmit}
                    disabled={!candidateAnswerText.trim() || isSubmitting}
                    className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-md  transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Grading with AI...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Answer</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-in zoom-in-95">
              <div className="p-5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      AI Answer Assessment
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-semibold text-emerald-600">
                      {currentQ.score}/100
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-emerald-200/60">
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Accuracy</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {currentQ.accuracyScore}%
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Clarity</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {currentQ.communicationScore}%
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-bold text-slate-700 uppercase">Relevance</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {currentQ.relevanceScore}%
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-1">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    Actionable Improvement:
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {currentQ.actionableFeedback}
                  </p>
                </div>

                {currentQ.idealAnswer && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Benchmark Ideal Answer:
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      {currentQ.idealAnswer}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>
                    {currentQIndex === interviewSession.questions.length - 1
                      ? "Finish & View Scorecard"
                      : "Next Question"}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
            <Trophy className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-slate-900">Interview complete</h2>
            <p className="text-xs text-slate-700">
              Here is your comprehensive LLM performance breakdown
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="p-4 rounded-lg bg-brand-50 border border-brand-200">
              <span className="text-[10px] font-bold text-brand-700 uppercase">
                Overall Rubric Score
              </span>
              <p className="text-3xl font-semibold text-brand-600 mt-1">
                {interviewSession.overallScore || 85}/100
              </p>
            </div>
            <div className="p-4 rounded-lg bg-brand-50 border border-brand-200">
              <span className="text-[10px] font-bold text-brand-700 uppercase">
                Benchmark Percentile
              </span>
              <p className="text-3xl font-semibold text-brand-600 mt-1">
                Top {interviewSession.benchmarkPercentile || 88}%
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            {interviewSession.summaryFeedback}
          </p>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={resetInterview}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition-all"
            >
              Practice Another Set
            </button>
            <a
              href="/skill-gap"
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
            >
              Analyze Skill Gaps
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
