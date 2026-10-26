import React, { useState, useMemo } from "react";
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
  Globe,
  Sliders,
} from "lucide-react";
import { INITIAL_APPLICATIONS } from "@/lib/mockData";

interface JobSpecificData {
  missingSkills: string[];
  aiTip: {
    highlightedSkills: string[];
    currentScore: number;
    projectedScore: number;
    text: string;
  };
  courses: {
    id: string;
    title: string;
    provider: "Coursera" | "Udemy" | "edX" | "LinkedIn Learning";
    domain: string;
    rating: number;
    reviewCount: number;
    duration: string;
    url: string;
    skillsTargeted: string[];
    badgeColor: string;
  }[];
}

const JOB_SPECIFIC_DATA: Record<string, JobSpecificData> = {
  "job-2": {
    missingSkills: [
      "Deep Learning",
      "AWS Cloud Infrastructure",
      "Data Visualization (Plotly/Seaborn)",
      "Docker & Kubernetes",
    ],
    aiTip: {
      highlightedSkills: ["Deep Learning", "Data Visualization"],
      currentScore: 74,
      projectedScore: 92,
      text: "Acquiring Deep Learning and Data Visualization will elevate your ATS resume match from 74% to 92% for Amazon Forecasting & Intelligence.",
    },
    courses: [
      {
        id: "ds-1",
        title: "Deep Learning Specialization with PyTorch & TensorFlow",
        provider: "Coursera",
        domain: "coursera.org",
        rating: 4.9,
        reviewCount: 14200,
        duration: "16 weeks",
        url: "https://www.coursera.org/specializations/deep-learning",
        skillsTargeted: ["Deep Learning", "Neural Networks"],
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      },
      {
        id: "ds-2",
        title: "Machine Learning A-Z: Python & Scikit-Learn Hands-On",
        provider: "Udemy",
        domain: "udemy.com",
        rating: 4.8,
        reviewCount: 28900,
        duration: "44h",
        url: "https://www.udemy.com/course/machinelearning/",
        skillsTargeted: ["Machine Learning", "Python"],
        badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      },
      {
        id: "ds-3",
        title: "AWS Certified Machine Learning Specialty (MLS-C01)",
        provider: "Coursera",
        domain: "coursera.org",
        rating: 4.7,
        reviewCount: 5400,
        duration: "12 weeks",
        url: "https://www.coursera.org/learn/aws-machine-learning",
        skillsTargeted: ["AWS", "Cloud Computing"],
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      },
      {
        id: "ds-4",
        title: "Data Visualization & Dashboards with Python & Plotly",
        provider: "edX",
        domain: "edx.org",
        rating: 4.6,
        reviewCount: 3800,
        duration: "6 weeks",
        url: "https://www.edx.org/learn/data-visualization",
        skillsTargeted: ["Data Visualization", "Python"],
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
    ],
  },
  "job-1": {
    missingSkills: [
      "TypeScript",
      "Tailwind CSS",
      "Next.js App Router",
      "State Management (Zustand/Redux)",
    ],
    aiTip: {
      highlightedSkills: ["TypeScript", "Next.js App Router"],
      currentScore: 88,
      projectedScore: 98,
      text: "Mastering TypeScript and Next.js will elevate your ATS resume match from 88% to 98% for TCS Enterprise Web Engineering.",
    },
    courses: [
      {
        id: "fe-1",
        title: "React & Next.js: The Complete Guide (incl. App Router)",
        provider: "Udemy",
        domain: "udemy.com",
        rating: 4.9,
        reviewCount: 32000,
        duration: "38h",
        url: "https://www.udemy.com/course/react-the-complete-guide-incl-redux/",
        skillsTargeted: ["React", "Next.js"],
        badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      },
      {
        id: "fe-2",
        title: "Understanding TypeScript - 2025 Edition",
        provider: "Udemy",
        domain: "udemy.com",
        rating: 4.9,
        reviewCount: 19500,
        duration: "15h",
        url: "https://www.udemy.com/course/understanding-typescript/",
        skillsTargeted: ["TypeScript", "JavaScript"],
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      },
      {
        id: "fe-3",
        title: "Meta Front-End Developer Professional Certificate",
        provider: "Coursera",
        domain: "coursera.org",
        rating: 4.8,
        reviewCount: 24000,
        duration: "7 months",
        url: "https://www.coursera.org/professional-certificates/meta-front-end-developer",
        skillsTargeted: ["HTML/CSS", "React"],
        badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
      },
      {
        id: "fe-4",
        title: "Tailwind CSS & Modern Responsive Web Layouts",
        provider: "LinkedIn Learning",
        domain: "linkedin.com/learning",
        rating: 4.7,
        reviewCount: 4100,
        duration: "8h",
        url: "https://www.linkedin.com/learning",
        skillsTargeted: ["Tailwind", "HTML/CSS"],
        badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
      },
    ],
  },
  "job-3": {
    missingSkills: [
      "Kubernetes Cluster Architecture",
      "AWS & Azure Cloud DevOps",
      "CI/CD with GitHub Actions",
      "Terraform Infrastructure as Code",
    ],
    aiTip: {
      highlightedSkills: ["Kubernetes", "AWS & Azure Cloud DevOps"],
      currentScore: 65,
      projectedScore: 91,
      text: "Acquiring Kubernetes and Terraform will elevate your ATS resume match from 65% to 91% for Microsoft Azure Cloud Operations.",
    },
    courses: [
      {
        id: "do-1",
        title: "Docker & Kubernetes: The Practical Guide to Production Containers",
        provider: "Udemy",
        domain: "udemy.com",
        rating: 4.9,
        reviewCount: 38000,
        duration: "24h",
        url: "https://www.udemy.com/course/docker-and-kubernetes-the-complete-guide/",
        skillsTargeted: ["Docker", "Kubernetes"],
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      },
      {
        id: "do-2",
        title: "AWS Certified Solutions Architect & Cloud Engineering",
        provider: "Coursera",
        domain: "coursera.org",
        rating: 4.8,
        reviewCount: 22000,
        duration: "14 weeks",
        url: "https://www.coursera.org/learn/aws-cloud-technical-essentials",
        skillsTargeted: ["AWS", "Cloud Computing"],
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      },
      {
        id: "do-3",
        title: "Automating CI/CD Pipelines with GitHub Actions & Azure",
        provider: "LinkedIn Learning",
        domain: "linkedin.com/learning",
        rating: 4.7,
        reviewCount: 6500,
        duration: "10h",
        url: "https://www.linkedin.com/learning",
        skillsTargeted: ["CI/CD", "Linux"],
        badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      },
      {
        id: "do-4",
        title: "Terraform on AWS & Azure: Infrastructure as Code (IaC)",
        provider: "edX",
        domain: "edx.org",
        rating: 4.7,
        reviewCount: 5200,
        duration: "8 weeks",
        url: "https://www.edx.org",
        skillsTargeted: ["AWS", "Cloud Computing"],
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
    ],
  },
  "job-4": {
    missingSkills: [
      "System Design at Scale",
      "Distributed Microservices",
      "Java Enterprise & Concurrency",
      "Production Containerization",
    ],
    aiTip: {
      highlightedSkills: ["System Design at Scale", "Distributed Microservices"],
      currentScore: 92,
      projectedScore: 99,
      text: "Mastering Distributed System Design and Scalable Microservices will prepare you for Google Technical Round 1 with high confidence.",
    },
    courses: [
      {
        id: "se-1",
        title: "Software Architecture & System Design for Large Scale Systems",
        provider: "Coursera",
        domain: "coursera.org",
        rating: 4.9,
        reviewCount: 16500,
        duration: "10 weeks",
        url: "https://www.coursera.org/learn/system-design",
        skillsTargeted: ["System Design", "Microservices"],
        badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      },
      {
        id: "se-2",
        title: "Data Structures & Algorithms Masterclass in Java & Python",
        provider: "Udemy",
        domain: "udemy.com",
        rating: 4.8,
        reviewCount: 42000,
        duration: "52h",
        url: "https://www.udemy.com/course/java-the-complete-java-developer-course/",
        skillsTargeted: ["Java", "Python"],
        badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      },
      {
        id: "se-3",
        title: "Google Cloud Professional Cloud Architect Certification",
        provider: "Coursera",
        domain: "coursera.org",
        rating: 4.8,
        reviewCount: 29000,
        duration: "3 months",
        url: "https://www.coursera.org/professional-certificates/gcp-cloud-architect",
        skillsTargeted: ["Google Cloud", "Docker"],
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      },
      {
        id: "se-4",
        title: "Distributed Systems & Scalable Microservices Architecture",
        provider: "edX",
        domain: "edx.org",
        rating: 4.7,
        reviewCount: 8100,
        duration: "12 weeks",
        url: "https://www.edx.org",
        skillsTargeted: ["System Design", "Docker"],
        badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
      },
    ],
  },
  "job-5": {
    missingSkills: [
      "Tableau Visual Analytics",
      "Microsoft Power BI",
      "Advanced SQL & Window Functions",
      "Data Storytelling & Executive Reports",
    ],
    aiTip: {
      highlightedSkills: ["Tableau Visual Analytics", "Microsoft Power BI"],
      currentScore: 82,
      projectedScore: 96,
      text: "Building verified dashboards in Tableau and Power BI will elevate your ATS score from 82% to 96% for Accenture Client Advisory.",
    },
    courses: [
      {
        id: "da-1",
        title: "Google Data Analytics Professional Certificate",
        provider: "Coursera",
        domain: "coursera.org",
        rating: 4.9,
        reviewCount: 98000,
        duration: "6 months",
        url: "https://www.coursera.org/professional-certificates/google-data-analytics",
        skillsTargeted: ["SQL", "Data Visualization"],
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      },
      {
        id: "da-2",
        title: "Tableau for Business Intelligence & Visual Analytics",
        provider: "Udemy",
        domain: "udemy.com",
        rating: 4.8,
        reviewCount: 21000,
        duration: "18h",
        url: "https://www.udemy.com/course/tableau10/",
        skillsTargeted: ["Data Visualization", "Tableau"],
        badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      },
      {
        id: "da-3",
        title: "Advanced SQL for Data Analysts & BI Reporting",
        provider: "Coursera",
        domain: "coursera.org",
        rating: 4.7,
        reviewCount: 15400,
        duration: "8 weeks",
        url: "https://www.coursera.org",
        skillsTargeted: ["SQL", "Databases"],
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      {
        id: "da-4",
        title: "Microsoft Power BI Desktop from Scratch",
        provider: "Udemy",
        domain: "udemy.com",
        rating: 4.8,
        reviewCount: 31000,
        duration: "16h",
        url: "https://www.udemy.com/course/microsoft-power-bi-up-running-with-power-bi/",
        skillsTargeted: ["Data Visualization", "Excel"],
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      },
    ],
  },
};

export function SkillGapView() {
  const { userSkills, updateSkillMastery, applications: contextApps } = useJobNex();

  // Ensure there are applications available, fallback to mock if empty
  const appliedJobs = useMemo(() => {
    return contextApps && contextApps.length > 0 ? contextApps : INITIAL_APPLICATIONS;
  }, [contextApps]);

  // Default to Amazon Data Scientist (job-2) which matches the user's screenshot
  const [selectedJobId, setSelectedJobId] = useState<string>("job-2");

  // Selected application object
  const currentApp = useMemo(() => {
    if (selectedJobId === "ALL") return null;
    return appliedJobs.find((app) => app.jobId === selectedJobId || app.job.id === selectedJobId) || appliedJobs[0];
  }, [appliedJobs, selectedJobId]);

  // Active data for selected job or ALL
  const currentData = useMemo(() => {
    if (selectedJobId !== "ALL" && JOB_SPECIFIC_DATA[selectedJobId]) {
      return JOB_SPECIFIC_DATA[selectedJobId];
    }
    // Aggregate for ALL
    const allCourses = Object.values(JOB_SPECIFIC_DATA).flatMap((d) => d.courses);
    // Deduplicate
    const uniqueCourses = allCourses.filter(
      (c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx
    );
    const allMissing = Array.from(
      new Set(Object.values(JOB_SPECIFIC_DATA).flatMap((d) => d.missingSkills))
    ).slice(0, 6);

    return {
      missingSkills: allMissing,
      aiTip: {
        highlightedSkills: ["System Design", "Cloud Infrastructure", "Deep Learning"],
        currentScore: 78,
        projectedScore: 95,
        text: "Closing your missing skill gaps across your applied jobs will boost your interview shortlist rate by over 60%.",
      },
      courses: uniqueCourses.slice(0, 8),
    };
  }, [selectedJobId]);

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
              <option key={app.id} value={app.jobId || app.job.id}>
                {app.job.title} — {app.job.company} ({app.status})
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
          onClick={() => setSelectedJobId("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
            selectedJobId === "ALL"
              ? "bg-brand-600 text-white border-brand-600 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
          }`}
        >
          All Applied Jobs ({appliedJobs.length})
        </button>

        {appliedJobs.map((app) => {
          const isSelected = selectedJobId === (app.jobId || app.job.id);
          return (
            <button
              key={app.id}
              onClick={() => setSelectedJobId(app.jobId || app.job.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                isSelected
                  ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Building className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-400"}`} />
              <span>
                {app.job.company}: {app.job.title}
              </span>
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
            <div className="w-11 h-11 rounded-lg bg-white border border-brand-200 flex items-center justify-center font-bold text-base text-brand-700 shadow-2xs shrink-0">
              {currentApp.job.company.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-slate-900">
                  {currentApp.job.title} at {currentApp.job.company}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                  {currentApp.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Applied on {currentApp.appliedDate} • Location: {currentApp.job.location} • Experience: {currentApp.job.experienceLevel}
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
              <h2 className="text-base font-semibold text-slate-900">Your Skills</h2>
              <p className="text-xs text-slate-700">
                Adjust percentages to recalculate matching scores
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700">
              {userSkills.length} Verified
            </span>
          </div>

          <div className="space-y-5">
            {userSkills.map((skill) => (
              <div key={skill.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800">{skill.name}</span>
                  <span className="text-brand-600">{skill.masteryPercentage}%</span>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-accent-violet rounded-full transition-all duration-500"
                    style={{ width: `${skill.masteryPercentage}%` }}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={skill.masteryPercentage}
                    onChange={(e) => updateSkillMastery(skill.id, parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                  />
                  <span className="text-[10px] text-slate-700 shrink-0 font-medium">
                    Drag to tune
                  </span>
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
                <h2 className="text-base font-semibold text-slate-900">Missing Skills</h2>
                <p className="text-xs text-slate-700">
                  {currentApp
                    ? `Identified based on requirements for ${currentApp.job.title} at ${currentApp.job.company}`
                    : "Identified based on market requirements across all your applied jobs"}
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">
                Action Required
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {currentData.missingSkills.map((skill) => (
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
                {currentData.aiTip.text}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
            <span>Powered by JobNex Vector Differential Diagnostics</span>
            <span className="font-bold text-brand-600">Updated Daily</span>
          </div>
        </div>
      </div>

      {/* Recommended Courses Section (Filtered by Applied Job) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Recommended Courses & Platforms</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                {currentData.courses.length} Available
              </span>
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {currentApp
                ? `Curated course websites directly targeting your missing skills for ${currentApp.job.title} (${currentApp.job.company})`
                : "Curated learning platforms mapped to close the skill gaps across all your applied roles"}
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 self-start sm:self-auto">
            <Globe className="w-3.5 h-3.5 text-brand-600" />
            <span>Click any card to open in new tab</span>
          </div>
        </div>

        {/* Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {currentData.courses.map((course) => (
            <a
              key={course.id}
              href={course.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl border border-slate-200 hover:border-brand-400 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="space-y-3">
                {/* Provider Badge & Rating */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${course.badgeColor}`}
                  >
                    {course.provider}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-700">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{course.rating}</span>
                    <span className="text-[10px] text-slate-600">({course.reviewCount.toLocaleString()})</span>
                  </div>
                </div>

                {/* Course Title */}
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                  {course.title}
                </h3>

                {/* Duration & Website Domain */}
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{course.duration}</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 group-hover:text-brand-600 flex items-center gap-0.5">
                    {course.domain}
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-brand-600" />
                  </span>
                </div>

                {/* Targeted Skills */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {course.skillsTargeted.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-4 border-t border-slate-100">
                <div className="w-full bg-brand-600 group-hover:bg-brand-700 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2">
                  <span>Start Learning on {course.provider}</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

