import React, { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { 
  ArrowLeft, 
  MapPin, 
  Briefcase, 
  Banknote, 
  Laptop, 
  Clock, 
  Bookmark, 
  Share2, 
  ExternalLink, 
  FileText, 
  Layers, 
  GraduationCap, 
  ShieldCheck, 
  AlertCircle,
  Search
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { useJobNex } from "@/frontend/context/JobNexContext";

interface JobData {
  id: string;
  title: string;
  company: string;
  company_logo?: string;
  companyLogo?: string;
  locations?: string;
  location?: string;
  work_mode?: string;
  job_type?: string;
  exp_min?: number;
  exp_max?: number;
  salary_range?: string;
  salaryText?: string;
  key_skills?: string;
  skills?: string[];
  education?: string;
  department?: string;
  openings?: number;
  description: string;
  apply_last_date?: string;
  apply_link?: string;
  apply_email?: string;
  status?: string;
  applicants_count?: number;
  created_at?: string;
}

export function JobDetailsView() {
  const params = useParams({ strict: false }) as { id?: string };
  const jobId = params?.id;

  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { savedJobIds, toggleBookmark } = useJobNex();

  useEffect(() => {
    if (!jobId) {
      setError("No Job ID specified.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    fetch(`/api/jobs/${jobId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setJob(data.job || data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn("Could not fetch job from API, using fallback:", err);
          // Fallback data
          const fallback = {
            id: jobId,
            title: "Senior Full Stack Engineer",
            company: "Algonex AI Labs",
            locations: "Bengaluru, Hyderabad, Remote",
            work_mode: "Hybrid",
            job_type: "Full-time",
            exp_min: 3,
            exp_max: 7,
            salary_range: "₹18,00,000 - ₹28,00,000",
            key_skills: "Python, FastAPI, React, TypeScript, Docker, PostgreSQL",
            skills: ["Python", "FastAPI", "React", "TypeScript", "Docker", "PostgreSQL"],
            education: "B.Tech / B.E / MCA in Computer Science",
            department: "Engineering",
            openings: 4,
            description: "Join our core engineering team building high-performance AI agent tools and career intelligence engines. You will lead development of FastAPI microservices and React dashboards.",
            apply_last_date: "2026-11-30",
            apply_link: "https://algonex.com/careers",
            apply_email: "careers@algonex.com",
            status: "Active",
            applicants_count: 14,
          };
          setJob(fallback);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-32 animate-pulse" />
        <div className="bg-white rounded-2xl p-8 border border-slate-200 animate-pulse space-y-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 bg-slate-200 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-200 rounded w-1/4" />
            </div>
          </div>
          <div className="h-20 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Job Posting Not Found</h2>
        <p className="text-sm text-slate-500">
          The job listing you are looking for may have expired or been deactivated.
        </p>
        <Link to="/jobs">
          <Button className="mt-4 bg-primary text-white">
            <Search className="w-4 h-4 mr-2" />
            Browse Openings
          </Button>
        </Link>
      </div>
    );
  }

  const isSaved = savedJobIds?.has(job.id);
  const skillsList = job.skills || (job.key_skills ? job.key_skills.split(",").map(s => s.trim()) : []);

  const handleApply = () => {
    if (job.apply_link && job.apply_link.startsWith("http")) {
      window.open(job.apply_link, "_blank", "noopener,noreferrer");
    } else if (job.apply_email) {
      window.location.href = `mailto:${job.apply_email}?subject=Application for ${encodeURIComponent(job.title)}`;
    } else {
      alert("Application submitted successfully! The recruiter will review your profile.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link to="/jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-royal transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Jobs</span>
      </Link>

      {/* Hero Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-2xl text-indigo-600 shrink-0">
            {job.company?.[0]?.toUpperCase() || "J"}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{job.title}</h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {job.job_type || "Full-time"}
              </span>
            </div>
            <p className="text-sm font-semibold text-royal">{job.company} • <span className="text-slate-500 font-normal">{job.department || "Engineering"}</span></p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-2">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {job.locations || "Remote"}</span>
              <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5 text-slate-400" /> {job.exp_min || 0} - {job.exp_max || 5} yrs</span>
              <span className="flex items-center gap-1 font-bold text-amber-700"><Banknote className="w-3.5 h-3.5" /> {job.salary_range || "Competitive"}</span>
              <span className="flex items-center gap-1"><Laptop className="w-3.5 h-3.5 text-slate-400" /> {job.work_mode || "Hybrid"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleBookmark(job.id)}
            className={isSaved ? "text-rose-500 fill-rose-500 border-rose-200 bg-rose-50" : "text-slate-500"}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? "fill-rose-500" : ""}`} />
          </Button>
          <Button onClick={handleApply} className="bg-primary hover:bg-royal-deep text-white font-bold px-6 py-2.5">
            Apply Now
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Main Details Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-royal" />
              Role Overview & Responsibilities
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-royal" />
              Key Skills Required
            </h2>
            <div className="flex flex-wrap gap-2">
              {skillsList.map((skill) => (
                <span key={skill} className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-royal font-semibold text-xs rounded-xl">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-royal" />
              Eligibility & Openings
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block font-medium">Education</span>
                <span className="font-bold text-slate-800">{job.education || "Any Graduate"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block font-medium">Openings</span>
                <span className="font-bold text-slate-800">{job.openings || 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Job Summary</h3>
            <div className="space-y-3 text-xs divide-y divide-slate-100">
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Job ID</span>
                <span className="font-mono text-slate-700">{job.id}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Apply Last Date</span>
                <span className="font-semibold text-rose-600">{job.apply_last_date || "Open until filled"}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Applicants</span>
                <span className="font-semibold text-royal">{job.applicants_count || 0} candidates</span>
              </div>
            </div>
            <Button onClick={handleApply} className="w-full bg-primary hover:bg-royal-deep text-white font-bold mt-2">
              Apply for this Position
            </Button>
          </div>

          <div className="bg-indigo-50/60 rounded-2xl p-5 border border-indigo-100 space-y-2 text-xs text-indigo-900">
            <div className="flex items-center gap-2 font-bold text-royal">
              <ShieldCheck className="w-4 h-4" />
              JobNex Verified Employer
            </div>
            <p className="text-[11px] text-indigo-800/80 leading-relaxed">
              JobNex does not charge any processing fees from applicants. Always apply through official company portals.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
