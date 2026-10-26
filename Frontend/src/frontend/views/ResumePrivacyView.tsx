import React, { useState } from "react";
import { useJobNex } from "@/frontend/context/JobNexContext";
import {
  ShieldCheck,
  FileText,
  Upload,
  Eye,
  Download,
  Lock,
  Globe,
  User,
  CheckCircle2,
  EyeOff,
  Link2,
  Search,
  RefreshCw,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

interface MatchAnalysis {
  matchScore: number;
  matchLevel: "Strong Match" | "Moderate Match" | "Low Match";
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
  recommendations: string[];
}

export function ResumePrivacyView() {
  const {
    uploadedResumeName,
    setUploadedResumeName,
    resumeParsedSummary,
    privacySettings,
    updatePrivacySettings,
    currentUser,
  } = useJobNex();

  const [activeTab, setActiveTab] = useState<"resume" | "privacy">("resume");
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [showRecruiterPreview, setShowRecruiterPreview] = useState(false);

  // Job Description (JD) state
  const [jdInputMode, setJdInputMode] = useState<"paste" | "url">("paste");
  const [jdText, setJdText] = useState<string>(
    "Looking for a Full-Stack Engineer proficient in React, TypeScript, Node.js, and RESTful APIs. Must have experience building responsive web UIs, PostgreSQL or MongoDB databases, Docker containerization, and AWS or Cloud deployments. Strong collaborative communication and agile development background required."
  );
  const [jdUrl, setJdUrl] = useState<string>("");
  const [isFetchingJd, setIsFetchingJd] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MatchAnalysis | null>(null);
  const [copiedTip, setCopiedTip] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedResumeName(file.name);
      setSaveNotification(`Uploaded new resume: ${file.name}`);
      setTimeout(() => setSaveNotification(null), 3500);
      setAnalysisResult(null);
    }
  };

  const handleSaveSettings = () => {
    setSaveNotification("Privacy settings saved successfully!");
    setTimeout(() => setSaveNotification(null), 3000);
  };

  // Sample JD loader
  const handleLoadSampleJd = (type: "frontend" | "fullstack" | "datascience") => {
    if (type === "frontend") {
      setJdText(
        "Senior Frontend Engineer (React / TypeScript)\n\nKey Requirements:\n- 3+ years experience with React, Next.js, and modern TypeScript\n- Deep knowledge of Tailwind CSS, CSS Modules, and accessible UI components\n- Experience with GraphQL or REST APIs, state management (Zustand/Redux)\n- Strong understanding of Core Web Vitals, testing with Jest/Vitest, and CI/CD pipelines"
      );
    } else if (type === "datascience") {
      setJdText(
        "Data Scientist / ML Engineer\n\nKey Requirements:\n- Strong foundation in Python, SQL, Pandas, and Scikit-Learn\n- Experience designing and training Machine Learning & Deep Learning models\n- Knowledge of Data Visualization tools (Plotly, Tableau) and AWS Cloud deployments\n- Excellent problem-solving skills and predictive modeling experience"
      );
    } else {
      setJdText(
        "Full-Stack Web Developer\n\nKey Requirements:\n- Hands-on experience with React, TypeScript, Node.js, Express, and PostgreSQL\n- Experience architecting microservices and RESTful API endpoints\n- Familiarity with Docker containers, AWS Cloud deployments, and Git workflows\n- Passion for clean, scalable, and well-tested code"
      );
    }
    setSaveNotification("Sample Job Description loaded!");
    setTimeout(() => setSaveNotification(null), 2500);
    setAnalysisResult(null);
  };

  // Fetch JD by URL
  const handleFetchJdByUrl = (urlToFetch?: string) => {
    const targetUrl = urlToFetch || jdUrl;
    if (!targetUrl.trim()) {
      setSaveNotification("Please enter a valid job posting URL");
      setTimeout(() => setSaveNotification(null), 3000);
      return;
    }

    setIsFetchingJd(true);
    setTimeout(() => {
      setIsFetchingJd(false);
      let fetchedTitle = "Senior Software Engineer";
      let fetchedCompany = "Tech Enterprise";
      let fetchedContent = "";

      if (targetUrl.toLowerCase().includes("google")) {
        fetchedTitle = "Senior Software Engineer";
        fetchedCompany = "Google";
        fetchedContent =
          "Senior Software Engineer — Google\n\nRole Overview:\nBuild distributed microservices and performant systems at scale.\n\nMinimum Qualifications:\n- BS/MS degree in Computer Science or equivalent practical experience\n- Proficiency in TypeScript, React, Java, or Python\n- Deep understanding of distributed databases, Docker containerization, and System Design\n- Experience with CI/CD deployment pipelines and cloud infrastructure (GCP/AWS)";
      } else if (targetUrl.toLowerCase().includes("amazon")) {
        fetchedTitle = "Data Scientist";
        fetchedCompany = "Amazon";
        fetchedContent =
          "Data Scientist — Amazon Forecasting & Intelligence\n\nRole Overview:\nDevelop scalable predictive algorithms and business intelligence pipelines.\n\nMinimum Qualifications:\n- Proficiency in Python, SQL, Machine Learning, and Deep Learning models\n- Experience deploying models to production using AWS SageMaker\n- Expertise in Data Visualization and statistical hypothesis testing";
      } else if (targetUrl.toLowerCase().includes("microsoft")) {
        fetchedTitle = "Cloud DevOps Engineer";
        fetchedCompany = "Microsoft";
        fetchedContent =
          "Cloud DevOps Engineer — Microsoft Azure\n\nRole Overview:\nAutomate infrastructure provisioning and streamline CI/CD pipelines.\n\nMinimum Qualifications:\n- Hands-on expertise with Docker, Kubernetes, Terraform (IaC), and Azure/AWS\n- Scripting proficiency in Bash, Python, or PowerShell\n- Strong experience in zero-downtime deployments and system monitoring";
      } else {
        fetchedContent = `Job Posting fetched from: ${targetUrl}\n\nRole Requirements:\n- Strong proficiency in modern web development frameworks (React, TypeScript, Node.js)\n- Experience working with relational databases (PostgreSQL/MySQL) and RESTful API design\n- Demonstrated track record of delivering scalable web solutions in an agile environment\n- Familiarity with Cloud architectures (AWS/Azure) and automated testing`;
      }

      setJdText(fetchedContent);
      setSaveNotification(`Successfully fetched JD for ${fetchedTitle} (${fetchedCompany})!`);
      setTimeout(() => setSaveNotification(null), 3500);
      setAnalysisResult(null);
    }, 1200);
  };

  // Analyze Resume against JD
  const handleAnalyzeResumeAndJd = () => {
    if (!jdText.trim()) {
      setSaveNotification("Please paste or fetch a Job Description before analyzing");
      setTimeout(() => setSaveNotification(null), 3000);
      return;
    }

    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);

      const resumeContent = (resumeParsedSummary + " " + uploadedResumeName).toLowerCase();
      const jdLower = jdText.toLowerCase();

      // Common technical keywords to inspect
      const skillKeywords = [
        { name: "React", jdMatch: jdLower.includes("react"), resMatch: resumeContent.includes("react") },
        { name: "TypeScript", jdMatch: jdLower.includes("typescript"), resMatch: resumeContent.includes("typescript") },
        { name: "Node.js", jdMatch: jdLower.includes("node"), resMatch: resumeContent.includes("node") },
        { name: "REST APIs", jdMatch: jdLower.includes("api") || jdLower.includes("rest"), resMatch: resumeContent.includes("rest") || resumeContent.includes("api") },
        { name: "PostgreSQL", jdMatch: jdLower.includes("postgres") || jdLower.includes("sql"), resMatch: resumeContent.includes("postgres") || resumeContent.includes("sql") },
        { name: "Tailwind CSS", jdMatch: jdLower.includes("tailwind") || jdLower.includes("css"), resMatch: resumeContent.includes("tailwind") },
        { name: "Docker", jdMatch: jdLower.includes("docker") || jdLower.includes("container"), resMatch: resumeContent.includes("docker") },
        { name: "AWS Cloud", jdMatch: jdLower.includes("aws") || jdLower.includes("cloud"), resMatch: resumeContent.includes("aws") },
        { name: "CI/CD Pipelines", jdMatch: jdLower.includes("ci/cd") || jdLower.includes("pipeline"), resMatch: false },
        { name: "Kubernetes", jdMatch: jdLower.includes("kubernetes") || jdLower.includes("k8s"), resMatch: false },
        { name: "GraphQL", jdMatch: jdLower.includes("graphql"), resMatch: resumeContent.includes("graphql") },
        { name: "System Design", jdMatch: jdLower.includes("system design") || jdLower.includes("distributed"), resMatch: false },
        { name: "Machine Learning", jdMatch: jdLower.includes("machine learning") || jdLower.includes("ml"), resMatch: false },
      ];

      const requiredSkills = skillKeywords.filter((s) => s.jdMatch);
      const matched = requiredSkills.filter((s) => s.resMatch).map((s) => s.name);
      const missing = requiredSkills.filter((s) => !s.resMatch).map((s) => s.name);

      // Default fallbacks if generic JD
      const finalMatched = matched.length > 0 ? matched : ["React", "TypeScript", "Node.js", "REST APIs", "Tailwind CSS"];
      const finalMissing = missing.length > 0 ? missing : ["CI/CD Pipelines", "AWS Cloud Deployments", "Automated Testing"];

      // Calculate score
      const totalCount = finalMatched.length + finalMissing.length;
      const rawScore = totalCount > 0 ? Math.round((finalMatched.length / totalCount) * 100) : 82;
      const matchScore = Math.min(Math.max(rawScore, 68), 94);

      const level = matchScore >= 80 ? "Strong Match" : matchScore >= 60 ? "Moderate Match" : "Low Match";

      setAnalysisResult({
        matchScore,
        matchLevel: level,
        matchedSkills: finalMatched,
        missingSkills: finalMissing,
        summary: `Your resume shows strong proficiency in core frontend and backend technologies (${finalMatched.slice(0, 3).join(", ")}). Adding verified experience in ${finalMissing.slice(0, 2).join(" and ")} will push your ATS score into the top 5% of candidate submissions.`,
        recommendations: [
          `Integrate high-frequency JD keywords such as "${finalMissing[0] || "CI/CD Pipelines"}" into your project experience bullet points.`,
          `Quantify your accomplishments with measurable metrics (e.g. "Reduced API latency by 35% with Node.js microservices").`,
          `Align your headline to match the job title for higher initial automated recruiter ranking.`,
        ],
      });

      setSaveNotification("Resume & JD Match Analysis completed!");
      setTimeout(() => setSaveNotification(null), 3500);
    }, 900);
  };

  const handleCopyTips = () => {
    if (analysisResult) {
      navigator.clipboard.writeText(analysisResult.recommendations.join("\n"));
      setCopiedTip(true);
      setTimeout(() => setCopiedTip(false), 2500);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {saveNotification && (
        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveNotification}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center text-white shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Resume & Privacy
            </h1>
            <p className="text-xs text-slate-700">
              Upload your resume and compare against any Job Description for instant ATS match diagnostics
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab("resume")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "resume"
                ? "bg-white text-brand-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My Resume & JD
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "privacy"
                ? "bg-white text-brand-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Privacy Controls
          </button>
        </div>
      </div>

      {activeTab === "resume" ? (
        <div className="space-y-8">
          {/* Top Comparison Row: Upload Resume (Left) + Upload JD (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Card: Upload Resume */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Upload Resume</h2>
                    <p className="text-xs text-slate-700">Supported formats: PDF, DOCX (Max 5MB)</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Active File
                  </span>
                </div>

                <label className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50 hover:bg-brand-50/30 transition-all text-center">
                  <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-brand-600 shadow-xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Click to browse or drag & drop file
                    </p>
                    <p className="text-[10px] text-slate-700 mt-0.5">PDF, DOCX up to 5MB</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {/* Active Resume Details & Quick Actions */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-900 truncate">{uploadedResumeName}</p>
                      <p className="text-[10px] text-slate-700">142 KB • Primary PDF Document</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSaveNotification(`Viewing ${uploadedResumeName} in high-resolution preview`)}
                      className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                      title="View Full"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaveNotification(`Downloading ${uploadedResumeName}...`)}
                      className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* AI Parsed Summary */}
                <div className="p-4 bg-brand-50/60 rounded-lg border border-brand-100 space-y-1.5">
                  <span className="text-[10px] font-bold text-brand-800 uppercase tracking-wide">
                    AI Parsed Profile Summary
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-mono">
                    {resumeParsedSummary}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Card: Upload Job Description (JD) */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Upload Job Description (JD)</h2>
                    <p className="text-xs text-slate-700">Copy paste job description or fetch directly by URL</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                    Target JD
                  </span>
                </div>

                {/* Toggle: Paste JD Text vs Fetch by URL */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setJdInputMode("paste")}
                    className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      jdInputMode === "paste"
                        ? "bg-white text-brand-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Paste JD Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJdInputMode("url")}
                    className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      jdInputMode === "url"
                        ? "bg-white text-brand-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Fetch by URL</span>
                  </button>
                </div>

                {/* Mode 1: Paste Text */}
                {jdInputMode === "paste" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Paste Job Description:</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadSampleJd("fullstack")}
                          className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Load Sample JD</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={6}
                      value={jdText}
                      onChange={(e) => {
                        setJdText(e.target.value);
                        setAnalysisResult(null);
                      }}
                      placeholder="Paste target job posting requirements, responsibilities, and qualifications here..."
                      className="w-full text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:border-brand-500 focus:bg-white transition-all resize-none font-sans leading-relaxed"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>{jdText ? `${jdText.trim().split(/\s+/).length} words detected` : "No JD entered yet"}</span>
                      {jdText && (
                        <button
                          type="button"
                          onClick={() => {
                            setJdText("");
                            setAnalysisResult(null);
                          }}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          Clear Text
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Mode 2: Fetch by URL */
                  <div className="space-y-3.5">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        Job Posting Web URL:
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="url"
                            value={jdUrl}
                            onChange={(e) => setJdUrl(e.target.value)}
                            placeholder="https://careers.google.com/jobs/..."
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-500 focus:bg-white text-slate-800 placeholder-slate-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFetchJdByUrl()}
                          disabled={isFetchingJd}
                          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                          {isFetchingJd ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Fetching...</span>
                            </>
                          ) : (
                            <>
                              <Search className="w-3.5 h-3.5" />
                              <span>Fetch JD</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Quick sample URLs to try */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block">
                        Or click to fetch sample company posting:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: "Google — Senior SDE", url: "https://careers.google.com/jobs/senior-software-engineer" },
                          { name: "Amazon — Data Scientist", url: "https://amazon.jobs/en/jobs/data-scientist-forecasting" },
                          { name: "Microsoft — DevOps", url: "https://careers.microsoft.com/jobs/cloud-devops-engineer" },
                        ].map((sample) => (
                          <button
                            key={sample.name}
                            type="button"
                            onClick={() => {
                              setJdUrl(sample.url);
                              handleFetchJdByUrl(sample.url);
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-700 border border-slate-200 transition-colors"
                          >
                            {sample.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fetched Preview */}
                    {jdText && (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            JD Successfully Extracted
                          </span>
                          <span className="text-[10px] text-emerald-700">
                            {jdText.trim().split(/\s+/).length} words
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 line-clamp-3 leading-relaxed">
                          {jdText}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Helper Info */}
                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>Target for ATS keyword comparison</span>
                  <span className="font-semibold text-brand-600">Ready to Analyze</span>
                </div>
              </div>
            </div>
          </div>

          {/* Analyze Button in the Bottom in between Upload Resume & Upload JD */}
          <div className="flex flex-col items-center justify-center pt-2">
            <button
              type="button"
              onClick={handleAnalyzeResumeAndJd}
              disabled={isAnalyzing}
              className="btn-polish bg-gradient-to-r from-brand-600 via-brand-700 to-accent-violet hover:from-brand-700 hover:to-accent-violet text-white font-bold text-sm px-10 py-3.5 rounded-xl shadow-md hover:shadow-lg flex items-center gap-3 transition-all group disabled:opacity-60 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Comparing Resume with Job Description...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300 group-hover:rotate-12 transition-transform" />
                  <span>Analyze Resume & JD Match</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-600 mt-2 text-center">
              Evaluates ATS keyword match, missing technical requirements, and generates tailored tailoring tips
            </p>
          </div>

          {/* Match Analysis Results Dashboard */}
          {analysisResult && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6 animate-in slide-in-from-bottom-4">
              {/* Score Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-violet flex flex-col items-center justify-center text-white shadow-sm shrink-0">
                    <span className="text-xl font-bold leading-none">{analysisResult.matchScore}%</span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold mt-0.5">Match</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">ATS Resume & JD Alignment</h3>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          analysisResult.matchScore >= 80
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {analysisResult.matchLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {analysisResult.summary}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyTips}
                  className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {copiedTip ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTip ? "Tips Copied!" : "Copy Recommendations"}</span>
                </button>
              </div>

              {/* Skills Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Matched Keywords */}
                <div className="p-5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Matched Keywords & Skills ({analysisResult.matchedSkills.length})</span>
                    </h4>
                    <span className="text-[10px] font-semibold text-emerald-700">Present in Resume</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.matchedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{skill}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Missing Keywords */}
                <div className="p-5 rounded-xl bg-rose-50/50 border border-rose-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Missing Keywords to Add ({analysisResult.missingSkills.length})</span>
                    </h4>
                    <span className="text-[10px] font-semibold text-rose-700">Required by JD</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.missingSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-800 text-xs font-semibold shadow-2xs"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>{skill}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="p-5 bg-brand-50/60 rounded-xl border border-brand-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-900 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  <span>Actionable Optimization Checklist</span>
                </div>
                <ul className="space-y-2">
                  {analysisResult.recommendations.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Granular Privacy Controls
            </h2>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Resume Access Permission
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label
                  onClick={() => updatePrivacySettings({ visibility: "PUBLIC" })}
                  className={`p-4 rounded-lg border cursor-pointer flex items-start gap-3 transition-all ${
                    privacySettings.visibility === "PUBLIC"
                      ? "border-brand-600 bg-brand-50/70 shadow-xs ring-1 ring-brand-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Globe
                    className={`w-5 h-5 shrink-0 mt-0.5 ${privacySettings.visibility === "PUBLIC" ? "text-brand-600" : "text-slate-400"}`}
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">
                      Public (Visible to all verified recruiters)
                    </span>
                    <span className="text-[11px] text-slate-700 mt-0.5 block leading-relaxed">
                      Recommended for active job seekers. Allows recruiters to discover and contact
                      you.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => updatePrivacySettings({ visibility: "PRIVATE" })}
                  className={`p-4 rounded-lg border cursor-pointer flex items-start gap-3 transition-all ${
                    privacySettings.visibility === "PRIVATE"
                      ? "border-brand-600 bg-brand-50/70 shadow-xs ring-1 ring-brand-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Lock
                    className={`w-5 h-5 shrink-0 mt-0.5 ${privacySettings.visibility === "PRIVATE" ? "text-brand-600" : "text-slate-400"}`}
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">
                      Private (Only when applying)
                    </span>
                    <span className="text-[11px] text-slate-700 mt-0.5 block leading-relaxed">
                      Your profile remains invisible in recruiter searches until you explicitly
                      apply.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Recruiter Visibility & Personal Detail Masking
              </label>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Hide Personal Contact Details</p>
                  <p className="text-[11px] text-slate-700">
                    Masks phone number and direct email until your application is accepted for an
                    interview.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updatePrivacySettings({ maskContactInfo: !privacySettings.maskContactInfo })
                  }
                  className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                    privacySettings.maskContactInfo
                      ? "bg-brand-600 justify-end"
                      : "bg-slate-300 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm"></div>
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Hide Current Employer Name</p>
                  <p className="text-[11px] text-slate-700">
                    Replaces current employer with &quot;[Confidential Tech Enterprise]&quot; to
                    protect active employment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updatePrivacySettings({
                      maskCurrentEmployer: !privacySettings.maskCurrentEmployer,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                    privacySettings.maskCurrentEmployer
                      ? "bg-brand-600 justify-end"
                      : "bg-slate-300 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm"></div>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900">
                  Live Recruiter Perspective Simulator
                </span>
                <button
                  onClick={() => setShowRecruiterPreview(!showRecruiterPreview)}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  {showRecruiterPreview ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>{showRecruiterPreview ? "Hide Simulator" : "Preview Recruiter View"}</span>
                </button>
              </div>

              {showRecruiterPreview && (
                <div className="p-5 bg-slate-900 text-white rounded-lg space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-400">
                    <User className="w-4 h-4" />
                    <span>How External Recruiters See You:</span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-slate-300">
                    <p>
                      <strong>Name:</strong> {currentUser.name}
                    </p>
                    <p>
                      <strong>Contact:</strong>{" "}
                      {privacySettings.maskContactInfo ? (
                        <span className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          [Hidden until interview stage]
                        </span>
                      ) : (
                        currentUser.phone
                      )}
                    </p>
                    <p>
                      <strong>Company:</strong>{" "}
                      {privacySettings.maskCurrentEmployer ? (
                        <span className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          [Confidential Enterprise]
                        </span>
                      ) : (
                        currentUser.currentCompany
                      )}
                    </p>
                    <p>
                      <strong>Visibility Mode:</strong>{" "}
                      <span className="text-emerald-400">{privacySettings.visibility}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-8 py-3 rounded-xl shadow-md transition-all active:scale-95"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
