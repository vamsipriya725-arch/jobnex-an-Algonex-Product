import React, { useState } from "react";
import { Link } from "@/lib/nav";
import { useJobNex } from "@/frontend/context/JobNexContext";
import { ApplicationStatus, Application } from "@/domain/types";
import { UserCheck, ChevronRight, X, FileText } from "lucide-react";

export function DashboardView() {
  const { applications, updateApplicationStatus, currentUser } = useJobNex();

  const [activeTab, setActiveTab] = useState<ApplicationStatus>("All");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const countAll = applications.length;
  const countApplied = applications.filter((a) => a.status === "Applied").length;
  const countInterview = applications.filter((a) => a.status === "Interview").length;
  const countRejected = applications.filter((a) => a.status === "Rejected").length;
  const countOffered = applications.filter((a) => a.status === "Offered").length;

  const filteredApplications = applications.filter((app) => {
    if (activeTab === "All") return true;
    return app.status === activeTab;
  });

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case "Interview":
        return "bg-brand-100 text-brand-800 border-brand-200";
      case "Applied":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Rejected":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Offered":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Dashboard Top Header */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center text-white shadow-md ">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Application Dashboard
            </h1>
            <p className="text-xs text-slate-700">
              Track the status of every application in one place
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
            <p className="text-[10px] text-brand-600 font-semibold">
              {currentUser.role === "JOB_SEEKER" ? "Job Seeker" : "Recruiter"}
            </p>
          </div>
          <Link
            href="/jobs"
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
          >
            Explore More Jobs
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-700">Total Applications</span>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{countAll}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-brand-600">In Review / Applied</span>
          <p className="text-2xl font-semibold text-blue-600 mt-1">{countApplied}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-brand-700">Interviews Scheduled</span>
          <p className="text-2xl font-semibold text-brand-600 mt-1">{countInterview}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-amber-700">Offers Extended</span>
          <p className="text-2xl font-semibold text-emerald-600 mt-1">{countOffered}</p>
        </div>
      </div>

      {/* Main ATS Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-2">
          {[
            { id: "All", label: "All", count: countAll },
            { id: "Applied", label: "Applied", count: countApplied },
            { id: "Interview", label: "Interview", count: countInterview },
            { id: "Rejected", label: "Rejected", count: countRejected },
            { id: "Offered", label: "Offered", count: countOffered },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ApplicationStatus)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-6">Company</th>
                <th className="py-3 px-6">Role</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Applied On</th>
                <th className="py-3 px-6">Match</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-700">
                    No applications under &quot;{activeTab}&quot; tab.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          <img
                            src={app.job.companyLogo}
                            alt={app.job.company}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-bold text-slate-900">{app.job.company}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6 font-semibold text-slate-800">{app.job.title}</td>

                    <td className="py-4 px-6">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${getStatusBadge(
                          app.status,
                        )}`}
                      >
                        {app.status}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-slate-600 font-medium">{app.appliedDate}</td>

                    <td className="py-4 px-6 font-semibold text-brand-600">{app.matchScore}%</td>

                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-bold text-xs px-3.5 py-1.5 rounded-lg border border-slate-200 transition-all inline-flex items-center gap-1"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Timeline Drawer */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-lg h-full shadow-sm p-6 overflow-y-auto space-y-6 flex flex-col justify-between animate-in slide-in-from-right">
            <div className="space-y-6">
              <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <img
                      src={selectedApp.job.companyLogo}
                      alt={selectedApp.job.company}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{selectedApp.job.title}</h3>
                    <p className="text-xs text-slate-700">
                      {selectedApp.job.company} • {selectedApp.job.location}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">Current Stage</span>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadge(selectedApp.status)}`}
                  >
                    {selectedApp.status}
                  </span>
                </div>

                {currentUser.role === "RECRUITER" && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <label className="text-[11px] font-bold text-brand-600 block">
                      Recruiter Action: Advance Candidate Stage
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(["Applied", "Interview", "Offered", "Rejected"] as ApplicationStatus[]).map(
                        (st) => (
                          <button
                            key={st}
                            onClick={() => {
                              updateApplicationStatus(selectedApp.id, st);
                              setSelectedApp((prev) => (prev ? { ...prev, status: st } : null));
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              selectedApp.status === st
                                ? "bg-brand-600 text-white"
                                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {st}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-brand-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {selectedApp.resumeFileName || "Active_Resume.pdf"}
                    </p>
                    <p className="text-[10px] text-slate-700">Submitted with ATS application</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-brand-600">
                  {selectedApp.matchScore}% Match
                </span>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Application Timeline
                </h4>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {selectedApp.timeline.map((event) => (
                    <div key={event.id} className="relative">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-brand-600 ring-4 ring-brand-100"></div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{event.title}</span>
                          <span className="text-[10px] text-slate-700">{event.date}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {event.description}
                        </p>
                        <span className="text-[10px] text-brand-600 font-semibold block">
                          By: {event.actor}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedApp(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition-all"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
