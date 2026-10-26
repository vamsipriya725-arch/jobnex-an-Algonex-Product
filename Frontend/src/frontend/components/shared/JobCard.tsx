import { motion, useReducedMotion } from "framer-motion";
import { Bookmark, Briefcase, MapPin } from "lucide-react";
import type { JobPosting } from "@/domain/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";

/**
 * Reusable job card used by every screen that lists jobs.
 * variant="grid" -> vertical card (Home featured jobs)
 * variant="list" -> horizontal row (Jobs search results)
 * Cards fade in with a stagger based on their index and lift on hover.
 */
interface JobCardProps {
  job: JobPosting;
  index?: number;
  variant?: "grid" | "list";
  isBookmarked: boolean;
  onToggleBookmark: (jobId: string) => void;
  onApply: (job: JobPosting) => void;
  disableMotion?: boolean;
}

export function JobCard({
  job,
  index = 0,
  variant = "grid",
  isBookmarked,
  onToggleBookmark,
  onApply,
  disableMotion = false,
}: JobCardProps) {
  const reduceMotion = useReducedMotion();

  // Shared entrance animation: fade-in + slide-up, staggered by position (disabled if container observer controls it)
  const motionProps = disableMotion
    ? {}
    : {
        initial: reduceMotion ? false : { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.15 },
        transition: { duration: 0.5, delay: reduceMotion ? 0 : index * 0.12 },
      };

  if (variant === "list") {
    return (
      <motion.div
        {...motionProps}
        className="bg-white rounded-lg border border-slate-200/90 hover:border-brand-300 p-5 shadow-xs hover:shadow-sm transition-all group"
      >
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              <img
                src={job.companyLogo}
                alt={job.company}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                  {job.title}
                </h3>
                {job.matchScore && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {job.matchScore}% Match
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-700">{job.company}</p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {job.experienceLevel}
                </span>
                <span className="font-semibold text-amber-700">
                  {formatCurrency(job.salaryMin, job.currency)} -{" "}
                  {formatCurrency(job.salaryMax, job.currency)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2">
                {job.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pt-2 sm:pt-0 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleBookmark(job.id)}
              className="rounded-lg text-muted-foreground hover:text-primary hover:bg-accent"
              title={isBookmarked ? "Remove from bookmarks" : "Bookmark job"}
              aria-label={isBookmarked ? "Remove from bookmarks" : "Bookmark job"}
              aria-pressed={isBookmarked}
            >
              <Bookmark
                className={`w-5 h-5 ${isBookmarked ? "fill-rose-500 text-rose-500" : ""}`}
              />
            </Button>

            <Button
              onClick={() => onApply(job)}
              className="btn-polish h-auto bg-primary hover:bg-royal-deep text-primary-foreground font-semibold text-xs px-5 py-2.5"
            >
              Apply
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid variant: vertical card with salary footer (Home page)
  return (
    <motion.div
      {...motionProps}
      {...(reduceMotion ? {} : { whileHover: { y: -6 } })}
      className="glass-card border border-glass-edge hover:border-brand-300 rounded-lg p-5 hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between group"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              <img
                src={job.companyLogo}
                alt={job.company}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 group-hover:text-royal transition-colors">
                {job.title}
              </h3>
              <p className="text-xs font-semibold text-slate-700">{job.company}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleBookmark(job.id)}
            className="rounded-lg text-muted-foreground hover:text-primary hover:bg-accent shrink-0"
            title={isBookmarked ? "Remove bookmark" : "Save job"}
            aria-label={isBookmarked ? "Remove bookmark" : "Save job"}
            aria-pressed={isBookmarked}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-rose-500 text-rose-500" : ""}`} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-700 mb-3">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {job.location}
          </span>
          <span className="flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            {job.experienceLevel}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {job.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
            >
              {skill}
            </span>
          ))}
          {job.skills.length > 3 && (
            <span className="text-[11px] text-slate-700 font-medium self-center">
              +{job.skills.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-700 block">Package</span>
          <span className="font-semibold text-sm text-amber-700">
            {formatCurrency(job.salaryMin, job.currency)} -{" "}
            {formatCurrency(job.salaryMax, job.currency)}
          </span>
        </div>

        <Button
          onClick={() => onApply(job)}
          className="btn-polish h-auto bg-primary hover:bg-royal-deep text-primary-foreground text-xs font-semibold px-4 py-2 shrink-0"
        >
          Apply Now
        </Button>
      </div>
    </motion.div>
  );
}
