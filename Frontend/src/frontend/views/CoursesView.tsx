import React from "react";
import { GraduationCap, Clock, Layers } from "lucide-react";

const courses = [
  {
    title: "Full-Stack Web Development",
    provider: "JobNex Academy",
    level: "Intermediate",
    duration: "12 weeks",
    modules: 42,
    topics: ["React", "Node.js", "PostgreSQL"],
  },
  {
    title: "Data Science with Python",
    provider: "JobNex Academy",
    level: "Beginner",
    duration: "10 weeks",
    modules: 36,
    topics: ["Python", "Pandas", "ML Basics"],
  },
  {
    title: "Cloud & DevOps Essentials",
    provider: "JobNex Academy",
    level: "Advanced",
    duration: "8 weeks",
    modules: 28,
    topics: ["AWS", "Docker", "CI/CD"],
  },
  {
    title: "UI/UX Design Foundations",
    provider: "JobNex Academy",
    level: "Beginner",
    duration: "6 weeks",
    modules: 20,
    topics: ["Figma", "Wireframing", "Prototyping"],
  },
  {
    title: "System Design Interview Prep",
    provider: "JobNex Academy",
    level: "Advanced",
    duration: "4 weeks",
    modules: 16,
    topics: ["Scalability", "Caching", "APIs"],
  },
  {
    title: "AI & Machine Learning Basics",
    provider: "JobNex Academy",
    level: "Intermediate",
    duration: "9 weeks",
    modules: 30,
    topics: ["Python", "Neural Networks", "LLMs"],
  },
];

export function CoursesView() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-md">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Courses</h1>
          <p className="text-xs text-slate-700">
            Structured programs that build the skills employers ask for
          </p>
        </div>
      </div>

      {/* Course Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div
            key={course.title}
            className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs hover:shadow-sm hover:border-brand-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-sm text-slate-900">{course.title}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 shrink-0">
                  {course.level}
                </span>
              </div>
              <p className="text-xs text-slate-700 mb-3">{course.provider}</p>
              <div className="flex flex-wrap gap-1.5">
                {course.topics.map((topic) => (
                  <span
                    key={topic}
                    className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[11px] text-slate-700">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {course.duration}
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  {course.modules} modules
                </span>
              </div>
              <button className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-md transition-all active:scale-95">
                Enroll
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
