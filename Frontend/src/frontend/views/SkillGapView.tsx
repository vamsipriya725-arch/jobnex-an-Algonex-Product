import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useJobNex } from "@/frontend/context/JobNexContext";
import {
  BarChart3,
  Star,
  Clock,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Briefcase,
  Building,
  CheckCircle2,
  CheckCircle,
  Globe,
  Sliders,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Database,
} from "lucide-react";

export interface RecommendedCourse {
  id: string;
  skill: string;
  title: string;
  provider: string;
  domain: string;
  rating: number;
  reviewCount: number;
  duration: string;
  url: string;
  type: string;
  skillsTargeted: string[];
  badgeColor: string;
  status: "recommended" | "in_progress" | "completed" | "saved";
  aiTip?: string;
}

const JOB_SKILL_REQUIREMENTS: Record<string, { missingSkills: string[]; aiTip: { text: string } }> = {
  "job-2": {
    missingSkills: [
      "Deep Learning",
      "AWS Cloud Infrastructure",
      "Data Visualization (Plotly/Seaborn)",
      "Docker & Kubernetes",
    ],
    aiTip: {
      text: "Acquiring Deep Learning and Data Visualization will elevate your ATS resume match from 74% to 92% for Amazon Forecasting & Intelligence.",
    },
  },
  "job-1": {
    missingSkills: [
      "TypeScript",
      "Tailwind CSS",
      "Next.js App Router",
      "State Management (Zustand/Redux)",
    ],
    aiTip: {
      text: "Mastering TypeScript and Next.js will elevate your ATS resume match from 88% to 98% for TCS Enterprise Web Engineering.",
    },
  },
  "job-3": {
    missingSkills: [
      "Kubernetes Cluster Architecture",
      "AWS & Azure Cloud DevOps",
      "CI/CD with GitHub Actions",
      "Terraform Infrastructure as Code",
    ],
    aiTip: {
      text: "Acquiring Kubernetes and Terraform will elevate your ATS resume match from 65% to 91% for Microsoft Azure Cloud Operations.",
    },
  },
  "job-4": {
    missingSkills: [
      "System Design at Scale",
      "Distributed Microservices",
      "Java Enterprise & Concurrency",
      "Production Containerization",
    ],
    aiTip: {
      text: "Mastering Distributed System Design and Scalable Microservices will prepare you for Google Technical Round 1 with high confidence.",
    },
  },
  "job-5": {
    missingSkills: [
      "Tableau Visual Analytics",
      "Microsoft Power BI",
      "Advanced SQL & Window Functions",
      "Data Storytelling & Executive Reports",
    ],
    aiTip: {
      text: "Building verified dashboards in Tableau and Power BI will elevate your ATS score from 82% to 96% for Accenture Client Advisory.",
    },
  },
};

export function SkillGapView() {
  const { userSkills, applications: contextApps } = useJobNex();

  const appliedJobs = useMemo(() => {
    return contextApps && contextApps.length > 0 ? contextApps : [];
  }, [contextApps]);

  const [selectedJobId, setSelectedJobId] = useState<string>("job-2");
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dynamicAiTip, setDynamicAiTip] = useState<string>("");

  const currentApp = useMemo(() => {
    if (selectedJobId === "ALL") return null;
    return appliedJobs.find((app) => app.jobId === selectedJobId || app.job?.id === selectedJobId) || appliedJobs[0];
  }, [appliedJobs, selectedJobId]);

  const currentMissingSkills = useMemo(() => {
    if (selectedJobId !== "ALL" && JOB_SKILL_REQUIREMENTS[selectedJobId]) {
      return JOB_SKILL_REQUIREMENTS[selectedJobId].missingSkills;
    }
    const all = Array.from(
      new Set(Object.values(JOB_SKILL_REQUIREMENTS).flatMap((d) => d.missingSkills))
    );
    return all.slice(0, 6);
  }, [selectedJobId]);

  const fallbackAiTip = useMemo(() => {
    if (selectedJobId !== "ALL" && JOB_SKILL_REQUIREMENTS[selectedJobId]) {
      return JOB_SKILL_REQUIREMENTS[selectedJobId].aiTip.text;
    }
    return "Closing your missing skill gaps across your applied jobs will boost your interview shortlist rate by over 60%.";
  }, [selectedJobId]);

  // Fetch dynamic courses directly from backend API with database persistence
  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/resources/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "u-1",
          missing_skills: currentMissingSkills,
          job_id: selectedJobId,
          use_ai: true,
          persist: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error (${response.status}: ${response.statusText})`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.courses)) {
        setCourses(data.courses);
        if (data.ai_tip?.text) {
          setDynamicAiTip(data.ai_tip.text);
        }
      } else {
        setCourses([]);
      }
    } catch (err: any) {
      console.warn("Dynamic recommendation API error:", err);
      // Fallback: Attempt fetching already saved user courses from database
      try {
        const dbRes = await fetch("/api/resources/user/u-1");
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData && Array.isArray(dbData.courses) && dbData.courses.length > 0) {
            setCourses(dbData.courses);
            setIsLoading(false);
            return;
          }
        }
      } catch (dbErr) {
        // ignore
      }
      setError(err?.message || "Failed to load course recommendations from backend.");
    } finally {
      setIsLoading(false);
    }
  }, [currentMissingSkills, selectedJobId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Update status in backend and database
  const handleStatusChange = async (courseId: string, nextStatus: "recommended" | "in_progress" | "completed") => {
    try {
      const res = await fetch(`/api/resources/courses/${courseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "u-1", status: nextStatus }),
      });
      if (res.ok) {
        setCourses((prev) =>
          prev.map((c) => (c.id === courseId ? { ...c, status: nextStatus } : c))
        );
      }
    } catch (e) {
      console.error("Failed to update course status:", e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center text-white shadow-md shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Skill Gap Analysis
            </h1>
            <p className="text-xs text-slate-700">
              Compare your skills with the requirements of your applied jobs and explore recommended courses
            </p>
          </div>
        </div>

        {/* Applied Job Dropdown Filter */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <label htmlFor="applied-job-select" className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-brand-600" />
            <span>Applied Job:</span>
          </label>
          <select
            id="applied-job-select"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full md:w-auto bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-xs"
          >
            <option value="ALL">All Applied Jobs ({appliedJobs.length})</option>
            {appliedJobs.map((app) => (
              <option key={app.id} value={app.jobId || app.job?.id}>
                {app.job?.title} — {app.job?.company} ({app.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interactive Quick-Filter Pill Bar */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
          <Sliders className="w-3.5 h-3.5 text-brand-600" />
          <span>Filter by:</span>
        </span>
        <button
          type="button"
          onClick={() => setSelectedJobId("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
            selectedJobId === "ALL"
              ? "bg-brand-600 text-white border-brand-600 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
          }`}
        >
          All Applied Jobs ({appliedJobs.length})
        </button>
        {appliedJobs.map((app) => {
          const jId = app.jobId || app.job?.id;
          const isSelected = selectedJobId === jId;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => setSelectedJobId(jId)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                isSelected
                  ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Building className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-400"}`} />
              <span>{app.job?.company}: {app.job?.title}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : app.status === "Interview"
                      ? "bg-emerald-50 text-emerald-700"
                      : app.status === "Rejected"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-brand-50 text-brand-700"
                }`}
              >
                {app.status}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Job Context Card */}
      {currentApp && (
        <div className="bg-gradient-to-r from-brand-50/70 to-accent-violet/10 border border-brand-200/80 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-white border border-brand-200 flex items-center justify-center font-bold text-base text-brand-700 shadow-xs shrink-0">
              {currentApp.job?.company?.slice(0, 2).toUpperCase() || "JB"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-slate-900 m-0">
                  {currentApp.job?.title} at {currentApp.job?.company}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                  {currentApp.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 m-0">
                Applied on {currentApp.appliedDate} • Location: {currentApp.job?.location} • Experience: {currentApp.job?.experienceLevel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-500 block">ATS Match Score</span>
              <span className="text-lg font-bold text-brand-600">{currentApp.matchScore}%</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-brand-600" />
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Your Skills Card */}
        <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900 m-0">Your Skills</h2>
              <p className="text-xs text-slate-700 m-0">
                Adjust percentages to recalculate matching scores
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700">
              {userSkills?.length || 5} Verified
            </span>
          </div>

          <div className="space-y-5">
            {userSkills?.map((skill) => (
              <div key={skill.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800">{skill.name}</span>
                  <span className="text-brand-600">{skill.masteryPercentage}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-accent-violet rounded-full transition-all duration-300"
                    style={{ width: `${skill.masteryPercentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Missing Skills Card */}
        <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900 m-0">Missing Skills</h2>
                <p className="text-xs text-slate-700 m-0">
                  {currentApp
                    ? `Identified based on requirements for ${currentApp.job?.title} at ${currentApp.job?.company}`
                    : "Identified based on market requirements across all your applied jobs"}
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">
                Action Required
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {currentMissingSkills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold shadow-2xs hover:bg-rose-100 transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{skill}</span>
                </div>
              ))}
            </div>

            {/* AI Career Tip */}
            <div className="mt-8 p-4 bg-brand-50/60 rounded-lg border border-brand-100 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-brand-900 block mb-0.5">AI Career Tip:</span>
                {dynamicAiTip || fallbackAiTip}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
            <span>Powered by JobNex Vector Differential Diagnostics</span>
            <span className="font-bold text-brand-600">Updated Daily</span>
          </div>
        </div>
      </div>

      {/* Recommended Courses Section (Dynamic Backend Integration) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Recommended Courses & Platforms</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                {isLoading ? "Loading..." : `${courses.length} Available`}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>MySQL Persisted</span>
              </span>
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {currentApp
                ? `Dynamic course recommendations persisted in database for ${currentApp.job?.title} (${currentApp.job?.company})`
                : "Dynamic course recommendations persisted in database to bridge competencies across all applications"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchRecommendations}
              disabled={isLoading}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Sync & Re-fetch</span>
            </button>
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-brand-600" />
              <span>Click card to open</span>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between animate-pulse space-y-4 min-h-[260px]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-20 bg-slate-200 rounded-md"></div>
                    <div className="h-4 w-12 bg-slate-200 rounded-md"></div>
                  </div>
                  <div className="h-5 w-full bg-slate-200 rounded-md"></div>
                  <div className="h-5 w-3/4 bg-slate-200 rounded-md"></div>
                  <div className="h-4 w-1/2 bg-slate-100 rounded-md"></div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <div className="h-9 w-full bg-slate-200 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-rose-900 m-0">Failed to Load Recommendations</h3>
            <p className="text-xs text-rose-700 max-w-lg m-0">{error}</p>
            <button
              type="button"
              onClick={fetchRecommendations}
              className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Fetch</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && courses.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 m-0">No Skill Gaps Detected!</h3>
            <p className="text-xs text-slate-600 max-w-md m-0">
              Your profile satisfies all target qualifications for this selection.
            </p>
          </div>
        )}

        {/* Dynamic Course Cards Grid */}
        {!isLoading && !error && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {courses.map((course) => {
              const status = course.status || "recommended";
              const statusBadge =
                status === "completed"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : status === "in_progress"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-50 text-slate-700 border-slate-200";

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-brand-400 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                          course.badgeColor || "bg-brand-50 text-brand-700 border-brand-200"
                        }`}
                      >
                        {course.provider}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${statusBadge}`}>
                          {status.replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-0.5 text-xs font-bold text-amber-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{course.rating || 4.8}</span>
                        </div>
                      </div>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 m-0">
                      {course.title}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{course.duration || "Self-paced"}</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-600 group-hover:text-brand-600 flex items-center gap-0.5">
                        {course.domain || "online"}
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-brand-600" />
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {(course.skillsTargeted || [course.skill]).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    {course.aiTip && (
                      <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 leading-relaxed">
                        <span className="font-bold text-brand-900">Focus: </span>
                        {course.aiTip}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                    <a
                      href={course.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Start Learning on {course.provider}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(course.id, "in_progress")}
                        className={`flex-1 text-[10px] font-semibold py-1 px-2 rounded-lg border transition-all text-center cursor-pointer ${
                          status === "in_progress"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(course.id, "completed")}
                        className={`flex-1 text-[10px] font-semibold py-1 px-2 rounded-lg border transition-all text-center cursor-pointer ${
                          status === "completed"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        Completed
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
