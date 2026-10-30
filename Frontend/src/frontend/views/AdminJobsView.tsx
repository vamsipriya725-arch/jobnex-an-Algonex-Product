import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { 
  Briefcase, 
  Plus, 
  Upload, 
  ListFilter, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  Download, 
  FileSpreadsheet, 
  Search,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Textarea } from "@/frontend/components/ui/textarea";

interface JobItem {
  id: string;
  title: string;
  company: string;
  locations?: string;
  work_mode?: string;
  job_type?: string;
  exp_min?: number;
  exp_max?: number;
  salary_range?: string;
  key_skills?: string;
  education?: string;
  department?: string;
  openings?: number;
  description?: string;
  apply_last_date?: string;
  apply_link?: string;
  apply_email?: string;
  status: string;
  applicants_count?: number;
}

export function AdminJobsView() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"post" | "bulk" | "manage">("post");

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    locations: "",
    work_mode: "Office",
    job_type: "Full-time",
    exp_min: 0,
    exp_max: 3,
    salary_range: "Not disclosed",
    key_skills: "",
    education: "Any Graduate",
    department: "Engineering",
    openings: 1,
    description: "",
    apply_last_date: "",
    apply_link: "",
    apply_email: "",
    status: "Active",
  });

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs?limit=100&status=all");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || data.data || []);
      }
    } catch (e) {
      console.warn("Failed to fetch jobs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleFormSubmit = async (publishStatus: "Active" | "Draft") => {
    if (!formData.title || !formData.company || !formData.description) {
      showToast("Please fill all required fields (Title, Company, Description).", "error");
      return;
    }

    const payload = {
      ...formData,
      status: publishStatus,
    };

    try {
      const url = editingId ? `/api/jobs/${editingId}` : "/api/jobs";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": "ADMIN",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      showToast(editingId ? "Job updated successfully!" : `Job saved as ${publishStatus}!`);
      setEditingId(null);
      setFormData({
        title: "",
        company: "",
        locations: "",
        work_mode: "Office",
        job_type: "Full-time",
        exp_min: 0,
        exp_max: 3,
        salary_range: "Not disclosed",
        key_skills: "",
        education: "Any Graduate",
        department: "Engineering",
        openings: 1,
        description: "",
        apply_last_date: "",
        apply_link: "",
        apply_email: "",
        status: "Active",
      });
      fetchJobs();
      setActiveTab("manage");
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this job posting?")) return;
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "DELETE",
        headers: { "X-User-Role": "ADMIN" },
      });
      if (res.ok) {
        showToast("Job posting deleted.");
        fetchJobs();
      }
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, "error");
    }
  };

  const handleEdit = (job: JobItem) => {
    setEditingId(job.id);
    setFormData({
      title: job.title,
      company: job.company,
      locations: job.locations || "",
      work_mode: job.work_mode || "Office",
      job_type: job.job_type || "Full-time",
      exp_min: job.exp_min || 0,
      exp_max: job.exp_max || 3,
      salary_range: job.salary_range || "Not disclosed",
      key_skills: job.key_skills || "",
      education: job.education || "Any Graduate",
      department: job.department || "Engineering",
      openings: job.openings || 1,
      description: job.description || "",
      apply_last_date: job.apply_last_date || "",
      apply_link: job.apply_link || "",
      apply_email: job.apply_email || "",
      status: job.status || "Active",
    });
    setActiveTab("post");
  };

  const filteredJobs = jobs.filter((j) => {
    const matchQ = (j.title + " " + j.company + " " + (j.locations || "")).toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || (j.status || "").toLowerCase() === statusFilter.toLowerCase();
    return matchQ && matchStatus;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 ${
          toast.type === "error" ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"
        }`}>
          {toast.type === "error" ? <AlertCircle className="w-5 h-5 text-rose-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-royal" />
            Recruiter Job Hub
          </h1>
          <p className="text-xs text-slate-500">Post new job openings, upload bulk CSVs, and manage live listings.</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <Button
            size="sm"
            variant={activeTab === "post" ? "default" : "ghost"}
            onClick={() => setActiveTab("post")}
            className="text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {editingId ? "Edit Job" : "Post a Job"}
          </Button>
          <Button
            size="sm"
            variant={activeTab === "bulk" ? "default" : "ghost"}
            onClick={() => setActiveTab("bulk")}
            className="text-xs font-semibold"
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            Bulk Upload
          </Button>
          <Button
            size="sm"
            variant={activeTab === "manage" ? "default" : "ghost"}
            onClick={() => setActiveTab("manage")}
            className="text-xs font-semibold"
          >
            <ListFilter className="w-3.5 h-3.5 mr-1" />
            Manage Listings ({jobs.length})
          </Button>
        </div>
      </div>

      {/* Section A: Post / Edit Job Form */}
      {activeTab === "post" && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 border-b pb-3">
            {editingId ? "Update Job Posting" : "Section A: Create New Job Posting"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Job Title *</label>
              <Input
                placeholder="e.g. Senior Machine Learning Engineer"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company Name *</label>
              <Input
                placeholder="e.g. Algonex AI"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Locations (comma separated) *</label>
              <Input
                placeholder="e.g. Bengaluru, Hyderabad, Remote"
                value={formData.locations}
                onChange={(e) => setFormData({ ...formData, locations: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work Mode</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input text-xs bg-background"
                value={formData.work_mode}
                onChange={(e) => setFormData({ ...formData, work_mode: e.target.value })}
              >
                <option value="Office">Office</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Job Type</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input text-xs bg-background"
                value={formData.job_type}
                onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Experience (Min - Max Yrs)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={formData.exp_min}
                  onChange={(e) => setFormData({ ...formData, exp_min: parseInt(e.target.value) || 0 })}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={formData.exp_max}
                  onChange={(e) => setFormData({ ...formData, exp_max: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Salary Range / Package</label>
              <Input
                placeholder="e.g. ₹18,00,000 - ₹28,00,000 or Not disclosed"
                value={formData.salary_range}
                onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Number of Openings</label>
              <Input
                type="number"
                min={1}
                value={formData.openings}
                onChange={(e) => setFormData({ ...formData, openings: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Key Skills (comma separated tags) *</label>
            <Input
              placeholder="e.g. Python, PyTorch, LangChain, FastAPI, Docker"
              value={formData.key_skills}
              onChange={(e) => setFormData({ ...formData, key_skills: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Job Description *</label>
            <Textarea
              rows={5}
              placeholder="Detailed responsibilities, expectations, and culture..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Application Last Date</label>
              <Input
                type="date"
                value={formData.apply_last_date}
                onChange={(e) => setFormData({ ...formData, apply_last_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Apply Link (URL)</label>
              <Input
                placeholder="https://company.com/apply"
                value={formData.apply_link}
                onChange={(e) => setFormData({ ...formData, apply_link: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Apply Email</label>
              <Input
                placeholder="careers@company.com"
                value={formData.apply_email}
                onChange={(e) => setFormData({ ...formData, apply_email: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleFormSubmit("Draft")}
              className="text-xs font-semibold"
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleFormSubmit("Active")}
              className="bg-primary hover:bg-royal-deep text-white text-xs font-bold px-6"
            >
              Publish Job
            </Button>
          </div>
        </div>
      )}

      {/* Section B: Bulk CSV Upload */}
      {activeTab === "bulk" && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Section B: Bulk CSV Upload</h2>
              <p className="text-xs text-slate-500">Upload multiple job postings at once using a formatted CSV file.</p>
            </div>
            <a
              href="/api/jobs/template"
              download
              className="inline-flex items-center gap-2 text-xs font-semibold text-royal border border-royal/30 px-3 py-2 rounded-xl hover:bg-royal/5"
            >
              <Download className="w-4 h-4" />
              Download CSV Template
            </a>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-50 text-royal flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Select or drop a CSV file to import</p>
              <p className="text-xs text-slate-400 mt-1">Accepts UTF-8 encoded .csv files matching the official schema.</p>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                try {
                  const res = await fetch("/api/jobs/bulk", {
                    method: "POST",
                    headers: { "X-User-Role": "ADMIN" },
                    body: fd,
                  });
                  const json = await res.json();
                  if (res.ok) {
                    showToast(`Imported ${json.imported_count} jobs successfully!`);
                    fetchJobs();
                    setActiveTab("manage");
                  } else {
                    showToast(`Import error: ${json.detail || "Invalid format"}`, "error");
                  }
                } catch (err: any) {
                  showToast(`Upload failed: ${err.message}`, "error");
                }
              }}
              className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Section C: Manage Jobs */}
      {activeTab === "manage" && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Search listings..."
                className="pl-9 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                className="h-9 px-3 rounded-lg border text-xs bg-background"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="active">Active Only</option>
                <option value="draft">Drafts Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-bold">
                  <th className="p-3">Job Title & Company</th>
                  <th className="p-3">Location & Mode</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Applicants</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{j.title}</div>
                      <div className="text-slate-500 font-medium">{j.company}</div>
                    </td>
                    <td className="p-3">
                      <div>{j.locations || "Remote"}</div>
                      <span className="text-[10px] text-slate-400 font-semibold">{j.work_mode || "Office"}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        j.status?.toLowerCase() === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {j.status || "Active"}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-royal">
                      {j.applicants_count || 0} candidates
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleEdit(j)}>
                        <Edit3 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(j.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

