import React, { useState } from "react";
import { X, CheckCircle2, Loader2 } from "lucide-react";
import type { JobPosting } from "@/domain/types";
import {
    EXPERIENCE_OPTIONS,
    uploadCommunityJob,
    type CommunityJobForm,
} from "@/lib/communityJobs";

interface UploadJobModalProps {
    onClose: () => void;
    onUploaded: (job: JobPosting) => void;
    uploadedBy?: string | undefined;
}

const EMPTY: CommunityJobForm = {
    title: "",
    company: "",
    location: "",
    experience: "Fresher",
    salary: "",
    skills: "",
    url: "",
};

const inputCls =
    "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-brand-500 focus:bg-white transition-all";
const labelCls = "block text-xs font-bold text-slate-700 mb-1";

export function UploadJobModal({ onClose, onUploaded, uploadedBy }: UploadJobModalProps) {
    const [form, setForm] = useState<CommunityJobForm>(EMPTY);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const set = <K extends keyof CommunityJobForm>(key: K, value: CommunityJobForm[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.skills.split(",").some((s) => s.trim())) {
            setError("Add at least one skill (comma separated).");
            return;
        }
        setSubmitting(true);
        try {
            const job = await uploadCommunityJob(form, uploadedBy);
            onUploaded(job);
            setDone(true);
            setTimeout(onClose, 1400);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed. Is the backend running?");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="Upload a job"
        >
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <span className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider block">
                            Help other job seekers
                        </span>
                        <h3 className="text-xl font-semibold text-slate-900">Upload a job</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {done ? (
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        <div>
                            <p className="font-bold text-sm">Job uploaded</p>
                            <p className="text-xs">Thanks! It is now visible to everyone.</p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className={labelCls}>Job title *</label>
                            <input
                                required
                                minLength={2}
                                maxLength={200}
                                value={form.title}
                                onChange={(e) => set("title", e.target.value)}
                                placeholder="e.g. Python Developer"
                                className={inputCls}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Company *</label>
                                <input
                                    required
                                    minLength={2}
                                    maxLength={200}
                                    value={form.company}
                                    onChange={(e) => set("company", e.target.value)}
                                    placeholder="e.g. Acme Pvt Ltd"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Location *</label>
                                <input
                                    required
                                    minLength={2}
                                    maxLength={200}
                                    value={form.location}
                                    onChange={(e) => set("location", e.target.value)}
                                    placeholder="e.g. Bengaluru / Remote"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Experience *</label>
                                <select
                                    value={form.experience}
                                    onChange={(e) => set("experience", e.target.value as CommunityJobForm["experience"])}
                                    className={inputCls}
                                >
                                    {EXPERIENCE_OPTIONS.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Salary (optional)</label>
                                <input
                                    maxLength={100}
                                    value={form.salary}
                                    onChange={(e) => set("salary", e.target.value)}
                                    placeholder="e.g. 5-8 LPA"
                                    className={inputCls}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Skills * (comma separated)</label>
                            <input
                                required
                                value={form.skills}
                                onChange={(e) => set("skills", e.target.value)}
                                placeholder="Python, FastAPI, SQL"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Job link (URL) *</label>
                            <input
                                required
                                type="url"
                                maxLength={500}
                                value={form.url}
                                onChange={(e) => set("url", e.target.value)}
                                placeholder="https://company.com/careers/123"
                                className={inputCls}
                            />
                        </div>

                        {error && (
                            <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
                            >
                                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Upload job
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}