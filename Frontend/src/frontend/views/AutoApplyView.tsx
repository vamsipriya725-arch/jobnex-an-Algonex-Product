import React, { useState } from "react";
import { useJobNex } from "@/frontend/context/JobNexContext";
import { Region, ExperienceLevel } from "@/domain/types";
import { Zap, CheckCircle2, FileText, Clock, ShieldCheck, Play, RotateCw } from "lucide-react";

export function AutoApplyView() {
  const {
    autoApplyConfig,
    updateAutoApplyConfig,
    autoApplyLogs,
    runAutoApplyBatch,
    uploadedResumeName,
  } = useJobNex();

  const [isRunning, setIsRunning] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const handleToggle = () => {
    updateAutoApplyConfig({ isEnabled: !autoApplyConfig.isEnabled });
  };

  const handleRunBatchNow = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runAutoApplyBatch();
      setIsRunning(false);
      setNotification(
        `Auto-apply queue processed! Scanned available jobs, found ${res.matched} matching candidates, and auto-submitted ${res.applied} applications.`,
      );
      setTimeout(() => setNotification(null), 4500);
    }, 1200);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {notification && (
        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center text-white shadow-md ">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Automated Applications
            </h1>
            <p className="text-xs text-slate-700">
              Set your preferences and apply to matching roles automatically
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-xs font-bold text-slate-800">
            {autoApplyConfig.isEnabled ? "Auto-Apply Active" : "Auto-Apply Paused"}
          </span>
          <button
            onClick={handleToggle}
            className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
              autoApplyConfig.isEnabled
                ? "bg-emerald-500 justify-end"
                : "bg-slate-300 justify-start"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-sm"></div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Preferences Setup Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Preferences Setup</h2>
            <span className="text-[10px] uppercase font-bold text-slate-700">Criteria Rules</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Job Role</label>
              <select
                value={autoApplyConfig.targetRole}
                onChange={(e) => updateAutoApplyConfig({ targetRole: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-brand-500"
              >
                <option value="Software Engineer">Software Engineer</option>
                <option value="Frontend Developer">Frontend Developer</option>
                <option value="Data Scientist">Data Scientist</option>
                <option value="DevOps Engineer">DevOps Engineer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Region</label>
              <select
                value={autoApplyConfig.region}
                onChange={(e) => updateAutoApplyConfig({ region: e.target.value as Region })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-brand-500"
              >
                <option value="INDIA">India</option>
                <option value="US">US / Remote</option>
                <option value="GLOBAL">Global</option>
                <option value="BANGLADESH">Bangladesh</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Experience Range
              </label>
              <select
                value={autoApplyConfig.experience}
                onChange={(e) =>
                  updateAutoApplyConfig({ experience: e.target.value as ExperienceLevel })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-brand-500"
              >
                <option value="Fresher">Fresher (0 years)</option>
                <option value="1-2 yrs">1–2 years</option>
                <option value="3-5 yrs">3–5 years</option>
                <option value="5+ yrs">5+ years</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Minimum Match Threshold</label>
                <span className="text-xs font-semibold text-brand-600">
                  Min {autoApplyConfig.minMatchPercentage}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={autoApplyConfig.minMatchPercentage}
                onChange={(e) =>
                  updateAutoApplyConfig({ minMatchPercentage: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 mt-2"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-brand-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{uploadedResumeName}</p>
                <p className="text-[10px] text-slate-700">
                  Default resume auto-attached to dispatched applications
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              Attached
            </span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleRunBatchNow}
              disabled={isRunning || !autoApplyConfig.isEnabled}
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isRunning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Scanning & Auto-Applying...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Review & Run Auto-Apply Batch Now</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-700">
              System evaluates listings against minimum {autoApplyConfig.minMatchPercentage}% match
              threshold.
            </p>
          </div>
        </div>

        {/* Right: Daily Quota */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Daily Application Quota
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Dispatched Today:</span>
                <span className="text-brand-600">
                  {autoApplyConfig.appliedTodayCount} / {autoApplyConfig.maxDaily}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full"
                  style={{
                    width: `${(autoApplyConfig.appliedTodayCount / autoApplyConfig.maxDaily) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Last Scan: {autoApplyConfig.lastRun || "Never"}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Rate-limiting protection active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Apply Audit Log Table */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Auto-Apply Activity Logs</h3>
            <p className="text-xs text-slate-700">
              Real-time trace of evaluated job postings and auto-submits
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700">
            {autoApplyLogs.length} events logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Role & Company</th>
                <th className="py-2.5 px-4">Match %</th>
                <th className="py-2.5 px-4">Outcome</th>
                <th className="py-2.5 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {autoApplyLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {log.jobTitle} •{" "}
                    <span className="font-semibold text-slate-600">{log.company}</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-brand-600">{log.matchScore}%</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.status === "APPLIED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {log.status === "APPLIED" ? "Auto-Applied" : "Skipped"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 text-[11px]">
                    {log.reason || "Met target criteria & threshold"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
