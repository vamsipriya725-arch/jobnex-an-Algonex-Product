export type UserRole = "JOB_SEEKER" | "RECRUITER" | "ADMIN";

export type Region = "US" | "GLOBAL" | "INDIA" | "BANGLADESH";

export type ExperienceLevel = "Fresher" | "1-2 yrs" | "3-5 yrs" | "5+ yrs";

export type ApplicationStatus = "All" | "Applied" | "Interview" | "Rejected" | "Offered";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  headline?: string;
  currentCompany?: string;
}

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  location: string;
  region: Region;
  workplaceType: "Remote" | "Hybrid" | "On-site";
  experienceLevel: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  description: string;
  requirements: string[];
  skills: string[];
  certifications: string[];
  isFeatured?: boolean;
  postedAt: string;
  matchScore?: number;
}

export interface ApplicationTimelineEvent {
  id: string;
  stage: ApplicationStatus;
  title: string;
  description: string;
  date: string;
  actor: string;
}

export interface Application {
  id: string;
  jobId: string;
  job: JobPosting;
  candidateName: string;
  candidateEmail: string;
  status: ApplicationStatus;
  appliedDate: string;
  matchScore: number;
  resumeFileName?: string;
  notes?: string;
  timeline: ApplicationTimelineEvent[];
}

export interface UserSkill {
  id: string;
  name: string;
  masteryPercentage: number; // 0 - 100
  category: "Languages" | "Frameworks" | "Databases" | "Cloud" | "Core";
}

export interface CourseRecommendation {
  id: string;
  title: string;
  provider: "Coursera" | "Udemy" | "edX" | "LinkedIn Learning";
  rating: number;
  reviewCount: number;
  duration: string; // e.g. "12h", "4 weeks"
  url: string;
  skillsTargeted: string[];
  badgeColor?: string;
}

export interface InterviewQuestionItem {
  id: string;
  order: number;
  question: string;
  category: string;
  candidateAnswer?: string;
  score?: number; // 0 - 100
  accuracyScore?: number;
  communicationScore?: number;
  relevanceScore?: number;
  actionableFeedback?: string;
  idealAnswer?: string;
  isAnswered: boolean;
}

export interface InterviewSession {
  id: string;
  role: string;
  type: "Technical" | "HR";
  currentQuestionIndex: number;
  questions: InterviewQuestionItem[];
  overallScore?: number;
  benchmarkPercentile?: number;
  summaryFeedback?: string;
  isCompleted: boolean;
}

export interface AutoApplyConfig {
  isEnabled: boolean;
  targetRole: string;
  region: Region;
  experience: ExperienceLevel;
  minMatchPercentage: number; // e.g. 70
  resumeFileName: string;
  maxDaily: number;
  appliedTodayCount: number;
  lastRun?: string;
}

export interface AutoApplyLog {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  status: "APPLIED" | "SKIPPED_LOW_SCORE" | "LIMIT_REACHED";
  timestamp: string;
  reason?: string;
}

export interface ReferralOutreach {
  id: string;
  company: string;
  recipientEmail: string;
  targetRole: string;
  subject: string;
  message: string;
  attachedResumeName?: string;
  status: "Draft" | "Queued" | "Sent" | "Delivered";
  sentAt?: string;
}

export interface PrivacySettings {
  visibility: "PUBLIC" | "PRIVATE"; // Public to all recruiters vs Private (only applied companies)
  maskContactInfo: boolean; // Hide phone, email until interview
  maskCurrentEmployer: boolean; // Hide current employer
}

export interface ChatDeepLink {
  title: string;
  url: string;
  type: "JOB" | "COURSE" | "INTERVIEW" | "SKILL";
}

export interface ChatMessage {
  id: string;
  sender: "USER" | "ASSISTANT";
  content: string;
  timestamp: string;
  suggestedChips?: string[];
  actionLinks?: ChatDeepLink[];
}
