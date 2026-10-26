import React, { useState } from "react";
import HeroBackdrop from "@/frontend/components/hero/HeroBackdrop";
import { motion } from "framer-motion";
import { Link, useRouter } from "@/lib/nav";
import { Button } from "@/frontend/components/ui/button";
import { Region, ExperienceLevel } from "@/domain/types";
import {
  Search,
  Briefcase,
  ArrowRight,
  Globe2,
  BookOpen,
  FileText,
  BrainCircuit,
  BarChart3,
  Building,
  Compass,
  Sparkles,
  Zap,
} from "lucide-react";

// Shared scroll-reveal settings for page sections
const sectionReveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5 },
} as const;

const resources = [
  {
    title: "Resume Templates",
    description:
      "Download-ready resume formats tailored for tech roles, freshers and experienced professionals.",
    icon: FileText,
    href: "/resume-privacy",
  },
  {
    title: "Interview Question Bank",
    description: "Company-specific technical and HR questions with structured answer guidance.",
    icon: BrainCircuit,
    href: "/interview-prep",
  },
  {
    title: "Salary Insights",
    description: "Benchmark compensation ranges by role, region and experience level.",
    icon: BarChart3,
    href: "/dashboard",
  },
  {
    title: "Career Guides",
    description:
      "Step-by-step roadmaps for switching roles, negotiating offers and growing faster.",
    icon: BookOpen,
    href: "/resources",
  },
  {
    title: "Company Research",
    description: "Funding, culture and hiring trends for the companies you are targeting.",
    icon: Building,
    href: "/jobs",
  },
  {
    title: "Learning Paths",
    description: "Curated course sequences that close the skill gaps for your target role.",
    icon: Compass,
    href: "/skill-gap",
  },
];

export function HomeView() {
  const router = useRouter();

  // Hero Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<Region | "ALL">("ALL");
  const [selectedExp, setSelectedExp] = useState<ExperienceLevel | "ALL">("ALL");

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (selectedRegion !== "ALL") params.set("region", selectedRegion);
    if (selectedExp !== "ALL") params.set("exp", selectedExp);
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section - Significantly increased height, spaciousness, and 3D cinematic depth */}
      <section className="relative overflow-hidden min-h-[580px] sm:min-h-[640px] lg:min-h-[720px] flex items-center justify-center pt-20 pb-24 sm:pt-28 sm:pb-32 lg:pt-36 lg:pb-40 bg-hero-gradient border-b border-white/10">
        <HeroBackdrop />

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-7"
        >
          {/* AI Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-inner tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span className="tracking-wide">Next-Gen AI Career Platform • 50,000+ Verified Roles</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.12]">
            Find Your{" "}
            <span className="bg-gradient-to-r from-white via-brand-200 to-amber-200 bg-clip-text text-transparent drop-shadow-sm">
              Dream Job
            </span>
          </h1>

          <p className="text-base sm:text-xl text-white/90 max-w-2xl mx-auto font-normal leading-relaxed">
            AI powered. Personalized. Faster. Match your skills with high-growth tech opportunities worldwide.
          </p>

          {/* Global Hero Search Bar */}
          <div className="pt-2 max-w-4xl mx-auto space-y-4">
            <form
              onSubmit={handleHeroSearch}
              className="glass-dark p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-white/20 flex flex-col md:flex-row gap-3 items-stretch backdrop-blur-xl"
            >
              {/* Keyword input */}
              <div className="flex-1 flex items-center gap-2.5 px-3.5 py-3 bg-white rounded-xl border border-slate-200 glow-focus transition-all shadow-xs">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search job title, skills (React, Python), company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent font-medium"
                />
              </div>

              {/* Region Dropdown Filter */}
              <div className="flex items-center gap-2 px-3 py-3 bg-white rounded-xl border border-slate-200 focus-within:border-brand-500 transition-all shadow-xs">
                <Globe2 className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value as any)}
                  className="text-xs font-semibold text-slate-700 outline-none bg-transparent cursor-pointer"
                >
                  <option value="ALL">All Regions</option>
                  <option value="INDIA">India</option>
                  <option value="US">US / Remote</option>
                  <option value="GLOBAL">Global</option>
                  <option value="BANGLADESH">Bangladesh</option>
                </select>
              </div>

              {/* Experience Dropdown Filter */}
              <div className="flex items-center gap-2 px-3 py-3 bg-white rounded-xl border border-slate-200 focus-within:border-brand-500 transition-all shadow-xs">
                <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedExp}
                  onChange={(e) => setSelectedExp(e.target.value as any)}
                  className="text-xs font-semibold text-slate-700 outline-none bg-transparent cursor-pointer"
                >
                  <option value="ALL">Any Experience</option>
                  <option value="Fresher">Fresher</option>
                  <option value="1-2 yrs">1–2 yrs</option>
                  <option value="3-5 yrs">3–5 yrs</option>
                  <option value="5+ yrs">5+ yrs</option>
                </select>
              </div>

              {/* Search CTA */}
              <Button
                type="submit"
                className="btn-polish h-auto bg-gradient-to-r from-cream via-white to-amber-100 hover:from-white hover:to-amber-200 text-royal-deep font-bold px-7 py-3 flex items-center justify-center gap-2 text-sm shrink-0 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <span>Search</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            {/* Quick Trending Searches */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-white/80">
              <span className="text-white/60 font-semibold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-300" /> Trending:
              </span>
              {[
                "React",
                "Node.js",
                "Full Stack",
                "Data Scientist",
                "DevOps",
                "Remote",
              ].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSearchQuery(tag);
                    router.push(`/jobs?q=${encodeURIComponent(tag)}`);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 hover:text-white text-[11px] font-medium transition-all cursor-pointer backdrop-blur-xs"
                >
                  {tag}
                </button>
              ))}
            </div>

          </div>
        </motion.div>
      </section>

      {/* Resources Section */}
      <motion.section {...sectionReveal} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Resources</h2>
            <p className="text-xs text-slate-700">
              Practical guides and tools to support every step of your search
            </p>
          </div>
        </div>

        {/* Resource Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => {
            const Icon = resource.icon;
            return (
              <Link
                key={resource.title}
                href={resource.href}
                className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs hover:shadow-sm hover:border-brand-300 transition-all flex flex-col gap-3 group"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900 group-hover:text-brand-600 transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed mt-1">
                    {resource.description}
                  </p>
                </div>
                <span className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-brand-600">
                  Open
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
