// @ts-nocheck -- imported source; written without strict optional-property typing

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  UserRole,
  JobPosting,
  Application,
  UserSkill,
  CourseRecommendation,
  InterviewSession,
  InterviewQuestionItem,
  AutoApplyConfig,
  AutoApplyLog,
  ReferralOutreach,
  PrivacySettings,
  ChatMessage,
  ApplicationStatus,
} from "@/domain/types";
import {
  INITIAL_JOBS,
  INITIAL_USER_SKILLS,
  INITIAL_MISSING_SKILLS,
  INITIAL_COURSES,
  INITIAL_APPLICATIONS,
  TECHNICAL_QUESTIONS,
  HR_QUESTIONS,
} from "@/lib/mockData";

interface JobNexContextType {
  // Auth & RBAC
  currentUser: User;
  setCurrentUser: (user: User) => void;
  setUserRole: (role: UserRole) => void;
  isLoggedIn: boolean;
  login: (email: string, role: UserRole) => void;
  logout: () => void;

  // Jobs & Bookmarking
  jobs: JobPosting[];
  savedJobIds: string[];
  toggleBookmark: (jobId: string) => void;
  applyToJob: (
    jobId: string,
    coverLetter?: string,
    resumeName?: string,
  ) => { success: boolean; message: string };

  // ATS Applications
  applications: Application[];
  updateApplicationStatus: (appId: string, newStatus: ApplicationStatus, notes?: string) => void;
  selectedApplicationForTimeline: Application | null;
  setSelectedApplicationForTimeline: (app: Application | null) => void;

  // AI Interview Simulator
  interviewSession: InterviewSession;
  startInterview: (role: string, type: "Technical" | "HR") => void;
  submitAnswer: (answer: string) => Promise<{ score: number; feedback: string }>;
  nextQuestion: () => void;
  resetInterview: () => void;

  // Skill Gap & Courses
  userSkills: UserSkill[];
  updateSkillMastery: (skillId: string, percentage: number) => void;
  missingSkills: string[];
  courses: CourseRecommendation[];

  // Auto-Apply Engine
  autoApplyConfig: AutoApplyConfig;
  updateAutoApplyConfig: (config: Partial<AutoApplyConfig>) => void;
  autoApplyLogs: AutoApplyLog[];
  runAutoApplyBatch: () => { matched: number; applied: number };

  // Referral Outreach
  referrals: ReferralOutreach[];
  generateReferralDraft: (company: string, role: string, recipientEmail: string) => string;
  sendReferral: (
    company: string,
    role: string,
    recipientEmail: string,
    subject: string,
    message: string,
  ) => Promise<boolean>;

  // Resume & Privacy
  uploadedResumeName: string;
  setUploadedResumeName: (name: string) => void;
  resumeParsedSummary: string;
  privacySettings: PrivacySettings;
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;

  // AI Chatbot
  chatMessages: ChatMessage[];
  sendChatMessage: (content: string) => void;
  isChatLoading: boolean;
}

const DEFAULT_USER: User = {
  id: "u-1",
  name: "Candidate",
  email: "",
  phone: "",
  role: "JOB_SEEKER",
  avatar:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&auto=format&fit=crop&q=80",
  headline: "Full-Stack Engineer & Tech Professional",
  currentCompany: "",
};

const DEFAULT_PRIVACY: PrivacySettings = {
  visibility: "PUBLIC",
  maskContactInfo: false,
  maskCurrentEmployer: false,
};

const DEFAULT_AUTO_APPLY: AutoApplyConfig = {
  isEnabled: true,
  targetRole: "Software Engineer",
  region: "INDIA",
  experience: "1-2 yrs",
  minMatchPercentage: 70,
  resumeFileName: "Candidate_Resume.pdf",
  maxDaily: 10,
  appliedTodayCount: 2,
  lastRun: "2025-04-12 14:30",
};

const JobNexContext = createContext<JobNexContextType | undefined>(undefined);

export const JobNexProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Jobs & Bookmarks
  const [jobs, setJobs] = useState<JobPosting[]>(INITIAL_JOBS);
  const [savedJobIds, setSavedJobIds] = useState<string[]>(["job-1", "job-4"]);

  // ATS
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [selectedApplicationForTimeline, setSelectedApplicationForTimeline] =
    useState<Application | null>(null);

  // Skill Gap
  const [userSkills, setUserSkills] = useState<UserSkill[]>(INITIAL_USER_SKILLS);
  const [missingSkills] = useState<string[]>(INITIAL_MISSING_SKILLS);
  const [courses] = useState<CourseRecommendation[]>(INITIAL_COURSES);

  // Auto-Apply
  const [autoApplyConfig, setAutoApplyConfig] = useState<AutoApplyConfig>(DEFAULT_AUTO_APPLY);
  const [autoApplyLogs, setAutoApplyLogs] = useState<AutoApplyLog[]>([
    {
      id: "log-1",
      jobId: "job-1",
      jobTitle: "Frontend Developer",
      company: "TCS",
      matchScore: 88,
      status: "APPLIED",
      timestamp: "2025-04-10 11:20",
    },
    {
      id: "log-2",
      jobId: "job-2",
      jobTitle: "Data Scientist",
      company: "Amazon",
      matchScore: 74,
      status: "APPLIED",
      timestamp: "2025-04-12 14:15",
    },
    {
      id: "log-3",
      jobId: "job-3",
      jobTitle: "DevOps Engineer",
      company: "Microsoft",
      matchScore: 65,
      status: "SKIPPED_LOW_SCORE",
      timestamp: "2025-04-12 14:16",
      reason: "Match score (65%) is below threshold (70%)",
    },
  ]);

  // Referral
  const [referrals, setReferrals] = useState<ReferralOutreach[]>([
    {
      id: "ref-1",
      company: "Google",
      recipientEmail: "hiring@google.com",
      targetRole: "Software Engineer",
      subject: "Referral for Software Engineer Position",
      message:
        "Hi,\n\nI came across the Software Engineer role at Google and I'm very interested. With my hands-on background in full-stack architecture, React, and scalable backend microservices, I would love to be considered for an internal referral.\n\nHere is my resume for your consideration.\n\nBest regards,\nCandidate",
      attachedResumeName: "Candidate_Resume.pdf",
      status: "Delivered",
      sentAt: "2025-04-10 16:45",
    },
  ]);

  // Resume & Privacy
  const [uploadedResumeName, setUploadedResumeName] = useState<string>(
    "Candidate_Resume.pdf",
  );
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [resumeParsedSummary] = useState<string>(
    "Candidate is a proactive Full-Stack Engineer experienced in designing scalable React frontend applications, Node.js/Python REST microservices, and database architectures.",
  );

  // Interview Simulator
  const [interviewSession, setInterviewSession] = useState<InterviewSession>({
    id: "session-1",
    role: "Software Engineer",
    type: "Technical",
    currentQuestionIndex: 0,
    questions: TECHNICAL_QUESTIONS,
    isCompleted: false,
  });

  // AI Chatbot
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      sender: "ASSISTANT",
      content:
        "Hello! 👋 I am **JobNex AI Assistant**, your personal career copilot. How can I help you accelerate your job search today?",
      timestamp: "Just now",
      suggestedChips: [
        "Best skills for Data Science?",
        "Interview tips for Google?",
        "Top companies hiring freshers?",
        "Analyze my skill gap",
      ],
      actionLinks: [
        { title: "Explore Tech Jobs", url: "/jobs", type: "JOB" },
        { title: "Test Interview Prep", url: "/interview-prep", type: "INTERVIEW" },
      ],
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Auth Methods
  useEffect(() => {
    const syncUserSession = (session: any) => {
      if (session?.user) {
        const u = session.user;
        const meta = u.user_metadata || {};
        const displayName =
          meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : "Candidate");
        const avatarUrl =
          meta.avatar_url ||
          meta.picture ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff&bold=true`;
        const userRole: UserRole =
          (meta.role || "seeker").toUpperCase() === "RECRUITER" ? "RECRUITER" : "JOB_SEEKER";

        setIsLoggedIn(true);
        setCurrentUser({
          id: u.id,
          name: displayName,
          email: u.email || "",
          phone: meta.phone || "",
          role: userRole,
          avatar: avatarUrl,
          headline:
            userRole === "RECRUITER" ? "Senior Talent Acquisition Partner" : "Software Engineer",
          currentCompany: userRole === "RECRUITER" ? "JobNex Global Hiring" : "Tech Innovators",
        });

        // Clean up OAuth tokens from URL if present (detectSessionInUrl stays true)
        if (
          typeof window !== "undefined" &&
          (window.location.hash.includes("access_token") || window.location.search.includes("code="))
        ) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncUserSession(session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        syncUserSession(session);
      } else if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        setCurrentUser(DEFAULT_USER);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setUserRole = (role: UserRole) => {
    setCurrentUser((prev) => ({ ...prev, role }));
  };

  const login = (email: string, role: UserRole) => {
    setIsLoggedIn(true);
    setCurrentUser({
      id: "u-active",
      name: email
        .split("@")[0]
        .replace(".", " ")
        .replace(/^\w/, (c) => c.toUpperCase()),
      email,
      role,
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&auto=format&fit=crop&q=80",
      headline: role === "RECRUITER" ? "Senior Talent Acquisition Partner" : "Software Engineer",
      currentCompany: role === "RECRUITER" ? "JobNex Global Hiring" : "Tech Innovators",
    });
  };

  const logout = async () => {
    setIsLoggedIn(false);
    setCurrentUser(DEFAULT_USER);
    try {
      await supabase.auth.signOut();
    } catch (e) {}
  };

  // Bookmark Toggle
  const toggleBookmark = (jobId: string) => {
    setSavedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId],
    );
  };

  // Apply to Job
  const applyToJob = (jobId: string, coverLetter?: string, resumeName?: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return { success: false, message: "Job not found" };

    const alreadyApplied = applications.some((a) => a.jobId === jobId);
    if (alreadyApplied) {
      return { success: false, message: "You have already applied to this position!" };
    }

    const newApp: Application = {
      id: `app-${Date.now()}`,
      jobId,
      job,
      candidateName: currentUser.name,
      candidateEmail: currentUser.email,
      status: "Applied",
      appliedDate: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      matchScore: job.matchScore || Math.floor(Math.random() * 25) + 75,
      resumeFileName: resumeName || uploadedResumeName,
      notes: coverLetter,
      timeline: [
        {
          id: `t-${Date.now()}`,
          stage: "Applied",
          title: "Application Submitted",
          description: `Applied for ${job.title} at ${job.company} with resume ${resumeName || uploadedResumeName}`,
          date: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          actor: "Candidate",
        },
      ],
    };

    setApplications((prev) => [newApp, ...prev]);
    return { success: true, message: `Application submitted to ${job.company} successfully!` };
  };

  // ATS Status Update (For Recruiter or Candidate)
  const updateApplicationStatus = (appId: string, newStatus: ApplicationStatus, notes?: string) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          const newEvent = {
            id: `t-${Date.now()}`,
            stage: newStatus,
            title: `Status changed to ${newStatus}`,
            description: notes || `Application moved to ${newStatus} phase`,
            date: new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
            actor: currentUser.role === "RECRUITER" ? "Recruiter" : "System",
          };
          return {
            ...app,
            status: newStatus,
            timeline: [newEvent, ...app.timeline],
          };
        }
        return app;
      }),
    );
  };

  // Interview Simulator Logic
  const startInterview = (role: string, type: "Technical" | "HR") => {
    const questions = type === "Technical" ? TECHNICAL_QUESTIONS : HR_QUESTIONS;
    setInterviewSession({
      id: `sess-${Date.now()}`,
      role,
      type,
      currentQuestionIndex: 0,
      questions: questions.map((q) => ({
        ...q,
        candidateAnswer: "",
        isAnswered: false,
        score: undefined,
      })),
      isCompleted: false,
    });
  };

  const submitAnswer = async (answer: string): Promise<{ score: number; feedback: string }> => {
    const currIndex = interviewSession.currentQuestionIndex;
    const currQuestion = interviewSession.questions[currIndex];

    // Compute realistic AI rubric grading based on answer length and keyword depth
    const words = answer.trim().split(/\s+/).length;
    let score = 75;
    let feedback = "Good explanation of core concepts with solid practical perspective.";

    if (words < 15) {
      score = 45;
      feedback =
        "Answer is quite brief. Consider elaborating with architecture details and specific production examples.";
    } else if (words > 60) {
      score = 92;
      feedback =
        "Outstanding depth! Clear structural logic, accurate terminology, and great real-world context.";
    } else {
      score = 82;
      feedback = "Solid answer! Addresses the question directly with clear reasoning.";
    }

    const updatedQuestions = [...interviewSession.questions];
    updatedQuestions[currIndex] = {
      ...currQuestion,
      candidateAnswer: answer,
      isAnswered: true,
      score,
      accuracyScore: Math.min(100, score + 4),
      communicationScore: Math.min(100, score - 2),
      relevanceScore: Math.min(100, score + 2),
      actionableFeedback: feedback,
    };

    const isLast = currIndex === updatedQuestions.length - 1;
    const answeredList = updatedQuestions.filter((q) => q.isAnswered && q.score !== undefined);
    const avgScore = Math.round(
      answeredList.reduce((acc, q) => acc + (q.score || 0), 0) / answeredList.length,
    );

    setInterviewSession((prev) => ({
      ...prev,
      questions: updatedQuestions,
      overallScore: avgScore,
      benchmarkPercentile: Math.min(98, Math.max(60, avgScore + 5)),
      summaryFeedback: `Candidate demonstrated strong knowledge in ${prev.type} concepts with an overall benchmark score of ${avgScore}/100.`,
      isCompleted: isLast,
    }));

    return { score, feedback };
  };

  const nextQuestion = () => {
    setInterviewSession((prev) => {
      if (prev.currentQuestionIndex < prev.questions.length - 1) {
        return {
          ...prev,
          currentQuestionIndex: prev.currentQuestionIndex + 1,
        };
      } else {
        return {
          ...prev,
          isCompleted: true,
        };
      }
    });
  };

  const resetInterview = () => {
    startInterview(interviewSession.role, interviewSession.type);
  };

  // Skill Gap
  const updateSkillMastery = (skillId: string, percentage: number) => {
    setUserSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, masteryPercentage: percentage } : s)),
    );
  };

  // Auto-Apply
  const updateAutoApplyConfig = (config: Partial<AutoApplyConfig>) => {
    setAutoApplyConfig((prev) => ({ ...prev, ...config }));
  };

  const runAutoApplyBatch = () => {
    let matched = 0;
    let applied = 0;
    const newLogs: AutoApplyLog[] = [];

    jobs.forEach((job) => {
      const match = job.matchScore || Math.floor(Math.random() * 25) + 70;
      if (match >= autoApplyConfig.minMatchPercentage) {
        matched++;
        const alreadyApplied = applications.some((a) => a.jobId === job.id);
        if (!alreadyApplied) {
          applied++;
          applyToJob(
            job.id,
            "Auto-applied via JobNex Smart Matching Queue",
            autoApplyConfig.resumeFileName,
          );
          newLogs.push({
            id: `log-${Date.now()}-${job.id}`,
            jobId: job.id,
            jobTitle: job.title,
            company: job.company,
            matchScore: match,
            status: "APPLIED",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        }
      } else {
        newLogs.push({
          id: `log-${Date.now()}-${job.id}`,
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          matchScore: match,
          status: "SKIPPED_LOW_SCORE",
          reason: `Match score ${match}% below threshold ${autoApplyConfig.minMatchPercentage}%`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    });

    setAutoApplyLogs((prev) => [...newLogs, ...prev]);
    setAutoApplyConfig((prev) => ({
      ...prev,
      appliedTodayCount: prev.appliedTodayCount + applied,
      lastRun: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));

    return { matched, applied };
  };

  // Referral
  const generateReferralDraft = (company: string, role: string, recipientEmail: string) => {
    return `Hi ${recipientEmail ? recipientEmail.split("@")[0] : "Hiring Team"},

I hope this message finds you well.

I came across the ${role} opening at ${company} and was immediately drawn to the high-caliber engineering initiatives your team is leading. With my strong background in full-stack architecture, React, Node.js, and high-performance databases, I believe I can make an immediate positive contribution to the team.

Attached is my resume (${uploadedResumeName}) for your review. I would be immensely grateful if you could consider referring me or putting me in touch with the hiring manager.

Thank you very much for your time and guidance!

Warm regards,
${currentUser.name}
${currentUser.email} | ${currentUser.phone || "+91 98765 43210"}`;
  };

  const sendReferral = async (
    company: string,
    role: string,
    recipientEmail: string,
    subject: string,
    message: string,
  ): Promise<boolean> => {
    const newReferral: ReferralOutreach = {
      id: `ref-${Date.now()}`,
      company,
      recipientEmail,
      targetRole: role,
      subject,
      message,
      attachedResumeName: uploadedResumeName,
      status: "Sent",
      sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setReferrals((prev) => [newReferral, ...prev]);
    return true;
  };

  // Privacy
  const updatePrivacySettings = (settings: Partial<PrivacySettings>) => {
    setPrivacySettings((prev) => ({ ...prev, ...settings }));
  };

  // AI Chatbot
  const sendChatMessage = (content: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "USER",
      content,
      timestamp: "Just now",
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    setTimeout(() => {
      let botReply = "Here is what I found for your career goals!";
      let actionLinks = undefined;
      const lower = content.toLowerCase();

      if (lower.includes("data science") || lower.includes("skills")) {
        botReply =
          "For **Data Science & ML**, the most in-demand industry skills are **Python**, **SQL**, **Data Visualization (Seaborn/Plotly)**, and **Machine Learning pipelines (Scikit-Learn/PyTorch)**. Based on your skill gap analysis, leveling up on Data Visualization will boost your profile match by +18%!";
        actionLinks = [
          { title: "View Skill Gap Diagnostic", url: "/skill-gap", type: "SKILL" as const },
          { title: "Data Scientist at Amazon", url: "/jobs", type: "JOB" as const },
        ];
      } else if (
        lower.includes("interview") ||
        lower.includes("tips") ||
        lower.includes("google")
      ) {
        botReply =
          "For top tier companies like **Google**, focus on **System Design** and **Algorithmic efficiency (Time/Space complexity)**. Would you like to practice our interactive 5-question interview simulator right now?";
        actionLinks = [
          {
            title: "Start Technical Interview Prep",
            url: "/interview-prep",
            type: "INTERVIEW" as const,
          },
        ];
      } else if (lower.includes("fresher") || lower.includes("companies")) {
        botReply =
          "Currently, companies like **Accenture**, **TCS**, and **RemoteBase** have open roles for freshers and 1-2 year candidates with strong React and SQL knowledge.";
        actionLinks = [
          { title: "View Filtered Jobs", url: "/jobs", type: "JOB" as const },
          { title: "Setup Auto-Apply", url: "/auto-apply", type: "JOB" as const },
        ];
      } else {
        botReply = `Great question regarding "${content}"! With JobNex, you can analyze your skill gaps, practice tailored interview questions, or dispatch automated cold outreach emails to hiring managers.`;
        actionLinks = [
          { title: "Find Matching Jobs", url: "/jobs", type: "JOB" as const },
          {
            title: "Launch Interview Simulator",
            url: "/interview-prep",
            type: "INTERVIEW" as const,
          },
        ];
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "ASSISTANT",
        content: botReply,
        timestamp: "Just now",
        suggestedChips: [
          "Explain REST APIs",
          "Recommended Coursera Courses",
          "How to negotiate salary?",
        ],
        actionLinks,
      };

      setChatMessages((prev) => [...prev, botMsg]);
      setIsChatLoading(false);
    }, 800);
  };

  return (
    <JobNexContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        setUserRole,
        isLoggedIn,
        login,
        logout,
        jobs,
        savedJobIds,
        toggleBookmark,
        applyToJob,
        applications,
        updateApplicationStatus,
        selectedApplicationForTimeline,
        setSelectedApplicationForTimeline,
        interviewSession,
        startInterview,
        submitAnswer,
        nextQuestion,
        resetInterview,
        userSkills,
        updateSkillMastery,
        missingSkills,
        courses,
        autoApplyConfig,
        updateAutoApplyConfig,
        autoApplyLogs,
        runAutoApplyBatch,
        referrals,
        generateReferralDraft,
        sendReferral,
        uploadedResumeName,
        setUploadedResumeName,
        resumeParsedSummary,
        privacySettings,
        updatePrivacySettings,
        chatMessages,
        sendChatMessage,
        isChatLoading,
      }}
    >
      {children}
    </JobNexContext.Provider>
  );
};

const FALLBACK_CONTEXT: JobNexContextType = {
  currentUser: DEFAULT_USER,
  setCurrentUser: () => {},
  setUserRole: () => {},
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
  jobs: INITIAL_JOBS,
  savedJobIds: [],
  toggleBookmark: () => {},
  applyToJob: () => ({ success: false, message: "" }),
  applications: INITIAL_APPLICATIONS,
  updateApplicationStatus: () => {},
  selectedApplicationForTimeline: null,
  setSelectedApplicationForTimeline: () => {},
  interviewSession: {
    id: "session-fallback",
    role: "Software Engineer",
    type: "Technical",
    currentQuestionIndex: 0,
    questions: TECHNICAL_QUESTIONS,
    isCompleted: false,
  },
  startInterview: () => {},
  submitAnswer: async () => ({ score: 75, feedback: "" }),
  nextQuestion: () => {},
  resetInterview: () => {},
  userSkills: INITIAL_USER_SKILLS,
  updateSkillMastery: () => {},
  missingSkills: INITIAL_MISSING_SKILLS,
  courses: INITIAL_COURSES,
  autoApplyConfig: DEFAULT_AUTO_APPLY,
  updateAutoApplyConfig: () => {},
  autoApplyLogs: [],
  runAutoApplyBatch: () => ({ matched: 0, applied: 0 }),
  referrals: [],
  generateReferralDraft: () => "",
  sendReferral: async () => false,
  uploadedResumeName: "resume.pdf",
  setUploadedResumeName: () => {},
  resumeParsedSummary: "",
  privacySettings: DEFAULT_PRIVACY,
  updatePrivacySettings: () => {},
  chatMessages: [],
  sendChatMessage: () => {},
  isChatLoading: false,
};

export const useJobNex = () => {
  const context = useContext(JobNexContext);
  return context || FALLBACK_CONTEXT;
};
