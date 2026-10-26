import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "@/lib/nav";
import { useJobNex } from "@/frontend/context/JobNexContext";
import { JobCard } from "@/frontend/components/shared/JobCard";
import { Region, ExperienceLevel, JobPosting } from "@/domain/types";
import { formatCurrency } from "@/lib/utils";
import {
  Search,
  MapPin,
  Briefcase,
  Bookmark,
  CheckCircle2,
  X,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

function JobsViewContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialRegion = (searchParams.get("region") as Region) || null;
  const initialExp = (searchParams.get("exp") as ExperienceLevel) || null;

  const { jobs, savedJobIds, toggleBookmark, applyToJob, uploadedResumeName } = useJobNex();

  // Search & Filter State
  const [keyword, setKeyword] = useState(initialQuery);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(
    initialRegion ? [initialRegion] : [],
  );
  const [selectedExpLevels, setSelectedExpLevels] = useState<ExperienceLevel[]>(
    initialExp ? [initialExp] : [],
  );
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"relevance" | "date" | "salary">("relevance");

  // Mobile filters panel toggle state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Apply Modal state
  const [applyingJob, setApplyingJob] = useState<JobPosting | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null);

  // Scroll Container References for independent scrolling
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const jobListScrollRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver Visibility States
  const [visibleFilterGroups, setVisibleFilterGroups] = useState<Set<string>>(() => new Set());
  const [visibleJobIds, setVisibleJobIds] = useState<Set<string>>(() => new Set());

  // Detect user prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 1. Lock the page itself so html/body never scroll
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  const handleToggleRegion = (r: Region) => {
    setSelectedRegions((prev) =>
      prev.includes(r) ? prev.filter((item) => item !== r) : [...prev, r],
    );
  };

  const handleToggleExp = (exp: ExperienceLevel) => {
    setSelectedExpLevels((prev) =>
      prev.includes(exp) ? prev.filter((item) => item !== exp) : [...prev, exp],
    );
  };

  const handleToggleCert = (cert: string) => {
    setSelectedCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert],
    );
  };

  const handleToggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  };

  const clearAllFilters = () => {
    setKeyword("");
    setSelectedRegions([]);
    setSelectedExpLevels([]);
    setSelectedCerts([]);
    setSelectedSkills([]);
  };

  const activeFilterCount =
    selectedRegions.length + selectedExpLevels.length + selectedCerts.length + selectedSkills.length;

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (keyword.trim()) {
          const q = keyword.toLowerCase();
          const matchesTitle = job.title.toLowerCase().includes(q);
          const matchesCompany = job.company.toLowerCase().includes(q);
          const matchesSkill = job.skills.some((s) => s.toLowerCase().includes(q));
          if (!matchesTitle && !matchesCompany && !matchesSkill) {
            return false;
          }
        }

        if (selectedRegions.length > 0 && !selectedRegions.includes(job.region)) {
          return false;
        }

        if (selectedExpLevels.length > 0 && !selectedExpLevels.includes(job.experienceLevel)) {
          return false;
        }

        if (selectedCerts.length > 0) {
          const hasCert = job.certifications.some((c) => selectedCerts.includes(c));
          if (!hasCert) return false;
        }

        if (selectedSkills.length > 0) {
          const hasSkill = job.skills.some((s) => selectedSkills.includes(s));
          if (!hasSkill) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "salary") return b.salaryMax - a.salaryMax;
        if (sortBy === "date")
          return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
        return (b.matchScore || 0) - (a.matchScore || 0);
      });
  }, [jobs, keyword, selectedRegions, selectedExpLevels, selectedCerts, selectedSkills, sortBy]);

  // 3 & 4: IntersectionObserver for Filters Sidebar with root = sidebarScrollRef.current
  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleFilterGroups(new Set(["region", "experience", "certifications", "skills"]));
      return;
    }

    const container = sidebarScrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const groupId = entry.target.getAttribute("data-filter-group");
            if (groupId) {
              setVisibleFilterGroups((prev) => {
                if (prev.has(groupId)) return prev;
                const next = new Set(prev);
                next.add(groupId);
                return next;
              });
              observer.unobserve(entry.target);
            }
          }
        });
      },
      {
        root: container, // scrolling container is root
        threshold: 0.1,
      },
    );

    const elements = container.querySelectorAll("[data-filter-group]");
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [prefersReducedMotion]);

  // 3 & 4: IntersectionObserver for Job Cards with root = jobListScrollRef.current
  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleJobIds(new Set(filteredJobs.map((j) => j.id)));
      return;
    }

    const container = jobListScrollRef.current;
    if (!container) return;

    const currentIds = new Set(filteredJobs.map((j) => j.id));
    setVisibleJobIds((prev) => {
      const kept = new Set<string>();
      prev.forEach((id) => {
        if (currentIds.has(id)) kept.add(id);
      });
      return kept;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const jobId = entry.target.getAttribute("data-job-id");
            if (jobId) {
              setVisibleJobIds((prev) => {
                if (prev.has(jobId)) return prev;
                const next = new Set(prev);
                next.add(jobId);
                return next;
              });
              observer.unobserve(entry.target);
            }
          }
        });
      },
      {
        root: container, // scrolling container is root
        rootMargin: "0px 0px -10px 0px",
        threshold: 0.1,
      },
    );

    const elements = container.querySelectorAll("[data-job-card]");
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [filteredJobs, prefersReducedMotion]);

  const handleConfirmApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingJob) return;

    const res = applyToJob(applyingJob.id, coverLetter, uploadedResumeName);
    setApplySuccessMessage(res.message);
    setTimeout(() => {
      setApplyingJob(null);
      setCoverLetter("");
      setApplySuccessMessage(null);
    }, 1800);
  };

  return (
    // Fixed viewport container: height is 100vh minus 72px navbar, whole page does NOT scroll
    <div className="h-[calc(100vh-72px)] flex flex-col overflow-hidden bg-slate-50/70 select-none-safe">
      {/* Fixed Search Bar & Top Filter Controls Bar */}
      <header className="shrink-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="flex-1 w-full flex items-center gap-3 px-3.5 py-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:bg-white shadow-2xs transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search jobs, skills, company..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full text-xs sm:text-sm text-slate-900 outline-none bg-transparent font-medium"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword("")}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Controls: Mobile Filters Button + Sort By Selector */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {/* Mobile Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:text-brand-600 shadow-2xs transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-600" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  mobileFiltersOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-brand-300 transition-colors"
              >
                <option value="relevance">Match Relevance</option>
                <option value="salary">Highest Salary</option>
                <option value="date">Newest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Collapsible Filters Panel */}
        {mobileFiltersOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-slate-200 max-h-[42vh] overflow-y-auto overscroll-contain custom-scrollbar scroll-smooth space-y-4 bg-white p-4 rounded-xl border shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Filter Criteria
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-bold text-brand-600 hover:underline"
              >
                Reset All
              </button>
            </div>

            {/* Region (Mobile) */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">
                Region
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "US", label: "US" },
                  { id: "GLOBAL", label: "Global" },
                  { id: "INDIA", label: "India" },
                  { id: "BANGLADESH", label: "Bangladesh" },
                ].map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRegions.includes(r.id as Region)}
                      onChange={() => handleToggleRegion(r.id as Region)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Experience (Mobile) */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">
                Experience
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(["Fresher", "1-2 yrs", "3-5 yrs", "5+ yrs"] as ExperienceLevel[]).map((exp) => (
                  <label
                    key={exp}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExpLevels.includes(exp)}
                      onChange={() => handleToggleExp(exp)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span>{exp}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Certifications (Mobile) */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">
                Certifications
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {["AWS", "Google Cloud", "PMP", "Others"].map((cert) => (
                  <label
                    key={cert}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCerts.includes(cert)}
                      onChange={() => handleToggleCert(cert)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span>{cert}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Skills (Mobile) */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">
                Skills
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {["React", "Python", "Java", "Docker", "Machine Learning", "Others"].map(
                  (skill) => (
                    <label
                      key={skill}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkills.includes(skill)}
                        onChange={() => handleToggleSkill(skill)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                      />
                      <span>{skill}</span>
                    </label>
                  ),
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-brand-700 transition-colors"
            >
              Done & View Jobs
            </button>
          </div>
        )}
      </header>

      {/* Main Split-Scroll Body: 2 Independent Vertical Scrolling Columns */}
      <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-0">
          {/* ========================================================= */}
          {/* COLUMN 1: LEFT FILTERS SIDEBAR (Independent Scroll)        */}
          {/* ========================================================= */}
          <aside className="hidden lg:flex lg:col-span-1 h-full min-h-0 flex-col">
            <div
              ref={sidebarScrollRef}
              className="h-full overflow-y-auto overscroll-contain pr-2.5 custom-scrollbar scroll-smooth space-y-5"
            >
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-brand-600" />
                    <h3 className="font-semibold text-sm text-slate-900 uppercase tracking-wide">
                      Filters
                    </h3>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Filter Group 1: Region (Animated on container scroll) */}
                <div
                  data-filter-group="region"
                  className="transition-all duration-500 ease-out will-change-transform"
                  style={{
                    opacity: visibleFilterGroups.has("region") || prefersReducedMotion ? 1 : 0,
                    transform:
                      visibleFilterGroups.has("region") || prefersReducedMotion
                        ? "translateY(0)"
                        : "translateY(16px)",
                  }}
                >
                  <h4 className="text-xs font-bold text-slate-900 mb-2.5 uppercase tracking-wider flex items-center justify-between">
                    <span>Region</span>
                    {selectedRegions.length > 0 && (
                      <span className="text-[10px] text-brand-600 font-semibold lowercase">
                        {selectedRegions.length} selected
                      </span>
                    )}
                  </h4>
                  <div className="space-y-2">
                    {[
                      { id: "US", label: "US" },
                      { id: "GLOBAL", label: "Global" },
                      { id: "INDIA", label: "India" },
                      { id: "BANGLADESH", label: "Bangladesh" },
                    ].map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-brand-600 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(r.id as Region)}
                          onChange={() => handleToggleRegion(r.id as Region)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Filter Group 2: Experience (Animated on container scroll) */}
                <div
                  data-filter-group="experience"
                  className="pt-3 border-t border-slate-100 transition-all duration-500 ease-out will-change-transform"
                  style={{
                    opacity: visibleFilterGroups.has("experience") || prefersReducedMotion ? 1 : 0,
                    transform:
                      visibleFilterGroups.has("experience") || prefersReducedMotion
                        ? "translateY(0)"
                        : "translateY(16px)",
                  }}
                >
                  <h4 className="text-xs font-bold text-slate-900 mb-2.5 uppercase tracking-wider flex items-center justify-between">
                    <span>Experience</span>
                    {selectedExpLevels.length > 0 && (
                      <span className="text-[10px] text-brand-600 font-semibold lowercase">
                        {selectedExpLevels.length} selected
                      </span>
                    )}
                  </h4>
                  <div className="space-y-2">
                    {(["Fresher", "1-2 yrs", "3-5 yrs", "5+ yrs"] as ExperienceLevel[]).map(
                      (exp) => (
                        <label
                          key={exp}
                          className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-brand-600 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedExpLevels.includes(exp)}
                            onChange={() => handleToggleExp(exp)}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span>{exp}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                {/* Filter Group 3: Certifications (Animated on container scroll) */}
                <div
                  data-filter-group="certifications"
                  className="pt-3 border-t border-slate-100 transition-all duration-500 ease-out will-change-transform"
                  style={{
                    opacity:
                      visibleFilterGroups.has("certifications") || prefersReducedMotion ? 1 : 0,
                    transform:
                      visibleFilterGroups.has("certifications") || prefersReducedMotion
                        ? "translateY(0)"
                        : "translateY(16px)",
                  }}
                >
                  <h4 className="text-xs font-bold text-slate-900 mb-2.5 uppercase tracking-wider flex items-center justify-between">
                    <span>Certifications</span>
                    {selectedCerts.length > 0 && (
                      <span className="text-[10px] text-brand-600 font-semibold lowercase">
                        {selectedCerts.length} selected
                      </span>
                    )}
                  </h4>
                  <div className="space-y-2">
                    {["AWS", "Google Cloud", "PMP", "Others"].map((cert) => (
                      <label
                        key={cert}
                        className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-brand-600 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCerts.includes(cert)}
                          onChange={() => handleToggleCert(cert)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>{cert}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Filter Group 4: Skills (Animated on container scroll) */}
                <div
                  data-filter-group="skills"
                  className="pt-3 border-t border-slate-100 transition-all duration-500 ease-out will-change-transform"
                  style={{
                    opacity: visibleFilterGroups.has("skills") || prefersReducedMotion ? 1 : 0,
                    transform:
                      visibleFilterGroups.has("skills") || prefersReducedMotion
                        ? "translateY(0)"
                        : "translateY(16px)",
                  }}
                >
                  <h4 className="text-xs font-bold text-slate-900 mb-2.5 uppercase tracking-wider flex items-center justify-between">
                    <span>Skills</span>
                    {selectedSkills.length > 0 && (
                      <span className="text-[10px] text-brand-600 font-semibold lowercase">
                        {selectedSkills.length} selected
                      </span>
                    )}
                  </h4>
                  <div className="space-y-2">
                    {["React", "Python", "Java", "Docker", "Machine Learning", "Others"].map(
                      (skill) => (
                        <label
                          key={skill}
                          className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-brand-600 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSkills.includes(skill)}
                            onChange={() => handleToggleSkill(skill)}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span>{skill}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* ========================================================= */}
          {/* COLUMN 2: RIGHT JOB RESULTS LIST (Independent Scroll)      */}
          {/* ========================================================= */}
          <div className="col-span-1 lg:col-span-3 h-full min-h-0 flex flex-col">
            {/* Header / Sub-status bar */}
            <div className="shrink-0 flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Job Results
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                  {filteredJobs.length} {filteredJobs.length === 1 ? "position" : "positions"}
                </span>
              </div>
              <span className="text-xs text-slate-600 hidden sm:inline">
                Independent scroll pane with live ATS match
              </span>
            </div>

            {/* Scrollable Container with custom thin scrollbar */}
            <main
              ref={jobListScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2.5 custom-scrollbar scroll-smooth space-y-4 pb-12"
            >
              {filteredJobs.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-slate-200 space-y-3">
                  <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800">No matching jobs found</h3>
                  <p className="text-xs text-slate-700 max-w-sm mx-auto">
                    Try loosening your filters or resetting your search keyword to view more
                    opportunities.
                  </p>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-2 text-xs font-bold text-brand-600 bg-brand-50 px-4 py-2 rounded-xl hover:bg-brand-100 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                filteredJobs.map((job, idx) => {
                  const isVisible = visibleJobIds.has(job.id) || prefersReducedMotion;
                  return (
                    <div
                      key={job.id}
                      data-job-card
                      data-job-id={job.id}
                      className="transition-all duration-500 ease-out will-change-transform"
                      style={{
                        opacity: isVisible ? 1 : 0,
                        transform: isVisible ? "translateY(0)" : "translateY(24px)",
                        transitionDelay: prefersReducedMotion ? "0ms" : `${(idx % 5) * 80}ms`,
                      }}
                    >
                      <JobCard
                        job={job}
                        index={idx}
                        variant="list"
                        disableMotion={true}
                        isBookmarked={savedJobIds.includes(job.id)}
                        onToggleBookmark={toggleBookmark}
                        onApply={setApplyingJob}
                      />
                    </div>
                  );
                })
              )}
            </main>
          </div>
        </div>
      </div>

      {/* Instant Apply Modal */}
      {applyingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 sm:p-8 shadow-sm border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider block">
                  1-Click Application
                </span>
                <h3 className="text-xl font-semibold text-slate-900">{applyingJob.title}</h3>
                <p className="text-xs font-semibold text-slate-700">
                  {applyingJob.company} • {applyingJob.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApplyingJob(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {applySuccessMessage ? (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Application submitted</p>
                  <p className="text-xs">{applySuccessMessage}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmApply} className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{uploadedResumeName}</p>
                      <p className="text-[10px] text-slate-700">
                        Attached from your JobNex profile
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>

                <div className="p-3 bg-brand-50/60 rounded-xl border border-brand-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-brand-900">Skill Match Score</p>
                    <p className="text-[10px] text-brand-700">
                      Calculated by JobNex AI Vector Engine
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-brand-600">
                    {applyingJob.matchScore || 85}%
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Short Note / Pitch to Recruiter (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Briefly highlight why you're a great fit for this role..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-brand-500 focus:bg-white transition-all resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setApplyingJob(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                  >
                    Submit Application
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function JobsView() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-700 text-sm">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          Loading Jobs Catalog...
        </div>
      }
    >
      <JobsViewContent />
    </Suspense>
  );
}
