import React from "react";
import { Link } from "@/lib/nav";
import {
  FileText,
  BrainCircuit,
  BarChart3,
  BookOpen,
  Building,
  Compass,
  ArrowRight,
} from "lucide-react";

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
    href: "/ai-assistant",
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

export function ResourcesView() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-md">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Resources</h1>
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
    </div>
  );
}
