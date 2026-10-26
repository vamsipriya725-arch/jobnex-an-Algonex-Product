/**
 * JobNex Mock Data (Converted to plain JavaScript)
 * Contains mock jobs, applications, questions, courses, and skills.
 */

const INITIAL_JOBS = [
  {
    id: "job-1",
    title: "Frontend Developer",
    company: "TCS",
    companyLogo: "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=128&auto=format&fit=crop&q=80",
    location: "Bangalore, India",
    region: "INDIA",
    workplaceType: "Hybrid",
    experienceLevel: "3-5 yrs",
    salaryMin: 600000,
    salaryMax: 1200000,
    currency: "INR",
    description: "Looking for an experienced Frontend Engineer with strong proficiency in React, TypeScript, and state management. You will build user-facing web applications serving enterprise clients with scalable, accessible code.",
    requirements: [
      "3+ years experience with React and TypeScript",
      "Familiarity with modern CSS (Tailwind, CSS Modules)",
      "Strong understanding of RESTful APIs & performance optimization",
      "Bachelor's degree in Computer Science or equivalent"
    ],
    skills: ["React", "JavaScript", "TypeScript", "Tailwind", "HTML/CSS"],
    certifications: ["Others"],
    isFeatured: true,
    postedAt: "2025-04-10",
    matchScore: 88
  },
  {
    id: "job-2",
    title: "Data Scientist",
    company: "Amazon",
    companyLogo: "https://images.unsplash.com/photo-1523474255658-4af9100492be?w=128&auto=format&fit=crop&q=80",
    location: "Remote / Bangalore",
    region: "INDIA",
    workplaceType: "Remote",
    experienceLevel: "1-2 yrs",
    salaryMin: 1000000,
    salaryMax: 2000000,
    currency: "INR",
    description: "Join Amazon's Forecasting and Intelligence team to design machine learning pipelines, optimize predictive supply chain algorithms, and derive actionable business insights from petabyte-scale data.",
    requirements: [
      "Proficiency in Python, SQL, and Machine Learning libraries (Scikit-Learn, Pandas)",
      "Experience deploying ML models to production",
      "Knowledge of statistical modeling and hypothesis testing"
    ],
    skills: ["Python", "Machine Learning", "SQL", "Deep Learning", "AWS"],
    certifications: ["AWS"],
    isFeatured: true,
    postedAt: "2025-04-12",
    matchScore: 74
  },
  {
    id: "job-3",
    title: "DevOps Engineer",
    company: "Microsoft",
    companyLogo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80",
    location: "Hyderabad, India",
    region: "INDIA",
    workplaceType: "Hybrid",
    experienceLevel: "3-5 yrs",
    salaryMin: 800000,
    salaryMax: 1500000,
    currency: "INR",
    description: "We are seeking a DevOps Engineer to streamline CI/CD pipelines, manage Kubernetes clusters on Azure & AWS, and enhance infrastructure reliability and monitoring across cloud services.",
    requirements: [
      "Deep hands-on experience with Docker, Kubernetes, and Terraform",
      "Proficient in AWS or Azure cloud infrastructure",
      "Strong scripting skills in Bash or Python"
    ],
    skills: ["AWS", "Docker", "Kubernetes", "Linux", "CI/CD"],
    certifications: ["AWS", "Google Cloud"],
    isFeatured: true,
    postedAt: "2025-04-08",
    matchScore: 65
  },
  {
    id: "job-4",
    title: "Software Engineer",
    company: "Google",
    companyLogo: "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=128&auto=format&fit=crop&q=80",
    location: "Bangalore, India",
    region: "INDIA",
    workplaceType: "Hybrid",
    experienceLevel: "3-5 yrs",
    salaryMin: 1800000,
    salaryMax: 3500000,
    currency: "INR",
    description: "Build next-generation distributed systems that scale to billions of daily active users. You will architect low-latency microservices, write performant code, and collaborate with global engineering teams.",
    requirements: [
      "Strong computer science fundamentals, data structures and algorithms",
      "Experience with distributed systems, microservices, and databases",
      "Proficiency in Java, Go, C++, or Python"
    ],
    skills: ["Java", "Python", "Docker", "Machine Learning", "System Design"],
    certifications: ["Google Cloud"],
    isFeatured: true,
    postedAt: "2025-04-14",
    matchScore: 92
  },
  {
    id: "job-5",
    title: "Data Analyst",
    company: "Accenture",
    companyLogo: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80",
    location: "Hyderabad, India",
    region: "INDIA",
    workplaceType: "On-site",
    experienceLevel: "Fresher",
    salaryMin: 600000,
    salaryMax: 1000000,
    currency: "INR",
    description: "Translate complex business queries into intuitive dashboards and analytical reports. Ideal for ambitious graduates who want hands-on exposure to global enterprise projects.",
    requirements: [
      "Proficiency in SQL and Excel / Google Sheets",
      "Experience with Power BI or Tableau visualization tools",
      "Strong communicative and problem-solving skills"
    ],
    skills: ["SQL", "Python", "Data Visualization", "Excel"],
    certifications: ["Others"],
    isFeatured: true,
    postedAt: "2025-04-05",
    matchScore: 82
  },
  {
    id: "job-6",
    title: "Web Developer",
    company: "RemoteBase",
    companyLogo: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=128&auto=format&fit=crop&q=80",
    location: "Remote",
    region: "GLOBAL",
    workplaceType: "Remote",
    experienceLevel: "1-2 yrs",
    salaryMin: 500000,
    salaryMax: 800000,
    currency: "INR",
    description: "Join an agile startup building modern SaaS landing pages, customer dashboards, and API integrations with Next.js and Supabase.",
    requirements: [
      "Demonstrated portfolio of full-stack or frontend projects",
      "Experience with React, Next.js, and CSS frameworks",
      "Comfortable with Git workflows"
    ],
    skills: ["React", "JavaScript", "HTML/CSS", "Node.js"],
    certifications: ["Others"],
    isFeatured: true,
    postedAt: "2025-04-11",
    matchScore: 95
  },
  {
    id: "job-7",
    title: "Lead Backend Engineer",
    company: "Pathao",
    companyLogo: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=128&auto=format&fit=crop&q=80",
    location: "Dhaka, Bangladesh",
    region: "BANGLADESH",
    workplaceType: "Hybrid",
    experienceLevel: "3-5 yrs",
    salaryMin: 1200000,
    salaryMax: 2200000,
    currency: "BDT",
    description: "Lead the ride-sharing and fintech transaction processing services. Optimize database queries, design fault-tolerant queue workers, and mentor junior engineers.",
    requirements: [
      "Experience with high-throughput backend systems in Node.js or Go",
      "Strong familiarity with PostgreSQL and Redis caching",
      "Experience in Bangladesh fintech/ride-hailing domain is a plus"
    ],
    skills: ["Python", "Docker", "Node.js", "PostgreSQL", "Redis"],
    certifications: ["Others"],
    isFeatured: false,
    postedAt: "2025-04-09",
    matchScore: 78
  },
  {
    id: "job-8",
    title: "Staff Cloud Architect",
    company: "Stripe",
    companyLogo: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=128&auto=format&fit=crop&q=80",
    location: "San Francisco, CA / Remote",
    region: "US",
    workplaceType: "Remote",
    experienceLevel: "5+ yrs",
    salaryMin: 140000,
    salaryMax: 195000,
    currency: "USD",
    description: "Architect the resilient infrastructure backbone underpinning billions in financial transactions globally. Champion zero-downtime deployments and multi-region failover strategies.",
    requirements: [
      "7+ years architecting mission-critical cloud infrastructure",
      "Expert knowledge of AWS, PMP methodologies, and security compliance",
      "Deep distributed systems troubleshooting capability"
    ],
    skills: ["AWS", "Docker", "Kubernetes", "Machine Learning", "System Design"],
    certifications: ["AWS", "PMP"],
    isFeatured: false,
    postedAt: "2025-04-13",
    matchScore: 70
  }
];

const INITIAL_USER_SKILLS = [
  { id: "s-1", name: "Python", masteryPercentage: 70, category: "Languages" },
  { id: "s-2", name: "SQL", masteryPercentage: 60, category: "Databases" },
  { id: "s-3", name: "Machine Learning", masteryPercentage: 30, category: "Core" },
  { id: "s-4", name: "Communication", masteryPercentage: 80, category: "Core" }
];

const INITIAL_MISSING_SKILLS = [
  "Data Visualization",
  "Deep Learning",
  "Cloud Computing",
  "Docker & Kubernetes"
];

const INITIAL_COURSES = [
  {
    id: "c-1",
    title: "Data Visualization with Python",
    provider: "Coursera",
    rating: 4.5,
    reviewCount: 1240,
    duration: "12h",
    url: "https://www.coursera.org",
    skillsTargeted: ["Data Visualization", "Python"],
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200"
  },
  {
    id: "c-2",
    title: "Machine Learning Basics",
    provider: "Udemy",
    rating: 4.6,
    reviewCount: 890,
    duration: "8h",
    url: "https://www.udemy.com",
    skillsTargeted: ["Machine Learning", "Deep Learning"],
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200"
  },
  {
    id: "c-3",
    title: "AWS Cloud Practitioner Essentials",
    provider: "Coursera",
    rating: 4.4,
    reviewCount: 3100,
    duration: "14h",
    url: "https://www.coursera.org",
    skillsTargeted: ["Cloud Computing", "AWS"],
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200"
  },
  {
    id: "c-4",
    title: "Docker & Containerization for Developers",
    provider: "Udemy",
    rating: 4.8,
    reviewCount: 2450,
    duration: "10h",
    url: "https://www.udemy.com",
    skillsTargeted: ["Cloud Computing", "Docker"],
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200"
  }
];

const INITIAL_APPLICATIONS = [
  {
    id: "app-1",
    jobId: "job-4",
    job: INITIAL_JOBS[3],
    candidateName: "Candidate",
    candidateEmail: "candidate@example.com",
    status: "Interview",
    appliedDate: "12 Apr 2025",
    matchScore: 92,
    resumeFileName: "Candidate_Resume.pdf",
    timeline: [
      { id: "t-1", stage: "Applied", title: "Application Submitted", description: "Application Submitted with Resume", date: "12 Apr 2025", actor: "Candidate" },
      { id: "t-2", stage: "Interview", title: "Technical Round 1 Scheduled", description: "Google recruiter scheduled 45-min System Design & Coding round.", date: "15 Apr 2025", actor: "Google Recruiter" }
    ]
  },
  {
    id: "app-2",
    jobId: "job-2",
    job: INITIAL_JOBS[1],
    candidateName: "Candidate",
    candidateEmail: "candidate@example.com",
    status: "Applied",
    appliedDate: "10 Apr 2025",
    matchScore: 74,
    resumeFileName: "Candidate_Resume.pdf",
    timeline: [
      { id: "t-3", stage: "Applied", title: "Application Submitted", description: "Application sent via Auto-Apply Engine", date: "10 Apr 2025", actor: "System Auto-Apply" }
    ]
  },
  {
    id: "app-3",
    jobId: "job-1",
    job: INITIAL_JOBS[0],
    candidateName: "Candidate",
    candidateEmail: "candidate@example.com",
    status: "Applied",
    appliedDate: "08 Apr 2025",
    matchScore: 88,
    resumeFileName: "Candidate_Resume.pdf",
    timeline: [
      { id: "t-4", stage: "Applied", title: "Profile Viewed", description: "TCS Talent Acquisition reviewed the profile", date: "09 Apr 2025", actor: "TCS Recruiter" }
    ]
  },
  {
    id: "app-4",
    jobId: "job-3",
    job: INITIAL_JOBS[2],
    candidateName: "Candidate",
    candidateEmail: "candidate@example.com",
    status: "Rejected",
    appliedDate: "05 Apr 2025",
    matchScore: 65,
    resumeFileName: "Candidate_Resume.pdf",
    timeline: [
      { id: "t-5", stage: "Applied", title: "Application Submitted", description: "Applied directly via JobNex Portal", date: "05 Apr 2025", actor: "Candidate" },
      { id: "t-6", stage: "Rejected", title: "Application Closed", description: "Role requires 5+ years with Kubernetes; skills kept on file for future openings.", date: "07 Apr 2025", actor: "Microsoft Recruiter" }
    ]
  },
  {
    id: "app-5",
    jobId: "job-5",
    job: INITIAL_JOBS[4],
    candidateName: "Candidate",
    candidateEmail: "candidate@example.com",
    status: "Applied",
    appliedDate: "01 Apr 2025",
    matchScore: 82,
    resumeFileName: "Candidate_Resume.pdf",
    timeline: [
      { id: "t-7", stage: "Applied", title: "Application Received", description: "Application submitted and queued for ATS scoring", date: "01 Apr 2025", actor: "Candidate" }
    ]
  }
];

const TECHNICAL_QUESTIONS = [
  {
    id: "q-1",
    order: 1,
    question: "Explain the concept of REST API. How does it work and what are the key HTTP methods?",
    category: "Web Architecture",
    isAnswered: false,
    idealAnswer: "A REST (Representational State Transfer) API is an architectural style for building networked applications using HTTP. Key principles include stateless client-server communication, uniform interface, and cacheability. Core methods include GET (read), POST (create), PUT/PATCH (update/partial update), and DELETE (remove). Responses typically format payloads in JSON with standard HTTP status codes (200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Internal Error)."
  },
  {
    id: "q-2",
    order: 2,
    question: "How does React's Virtual DOM work, and how does the reconciliation algorithm optimize rendering?",
    category: "Frontend Engineering",
    isAnswered: false,
    idealAnswer: "React maintains a lightweight in-memory representation of the real DOM called the Virtual DOM. When state or props change, React creates a new VDOM tree and executes the diffing algorithm (Reconciliation) to compare it with the previous VDOM. It calculates the minimum necessary mutations and batch-updates the real browser DOM, avoiding expensive layout reflows and repaints."
  },
  {
    id: "q-3",
    order: 3,
    question: "What is the difference between SQL and NoSQL databases? In what situation would you choose MongoDB over PostgreSQL?",
    category: "Databases & Storage",
    isAnswered: false,
    idealAnswer: "SQL databases are relational, table-based, with fixed schemas and ACID guarantees (e.g. PostgreSQL). NoSQL databases are non-relational, document, key-value, or graph-based with flexible schemas. You would choose MongoDB when handling rapid prototyping, polymorphic documents, high-volume unstructured logs, or when horizontal sharding is required without complex multi-table joins."
  },
  {
    id: "q-4",
    order: 4,
    question: "Describe how you identify and fix a memory leak or CPU bottleneck in a high-traffic Node.js or web application.",
    category: "Performance & Debugging",
    isAnswered: false,
    idealAnswer: "To diagnose memory leaks, take heap snapshots using Chrome DevTools or Node --inspect over multiple intervals and compare retaining trees to identify unbounded closures or global caches. For CPU bottlenecks, use flame graphs and CPU profiling to pinpoint synchronous blocking operations in the event loop, and offload CPU-heavy tasks to worker threads or background queues."
  },
  {
    id: "q-5",
    order: 5,
    question: "How do microservices communicate reliably? Compare Synchronous HTTP/gRPC vs Asynchronous Message Queues (Kafka/RabbitMQ).",
    category: "System Design",
    isAnswered: false,
    idealAnswer: "Synchronous communication (REST/gRPC) is best for real-time request-response operations where immediate confirmation is needed, but introduces tight coupling and cascading failure risk. Asynchronous message queues (Kafka, BullMQ, RabbitMQ) decouple producers and consumers, buffer spike traffic, and guarantee eventual consistency and fault tolerance through retry policies."
  }
];

const HR_QUESTIONS = [
  {
    id: "hr-1",
    order: 1,
    question: "Tell me about a challenging technical project you worked on and how you resolved an unexpected blocker.",
    category: "Behavioral & Problem Solving",
    isAnswered: false,
    idealAnswer: "Structure using STAR (Situation, Task, Action, Result). State the context clearly, what the constraint was (e.g., tight deadline or production bug), the specific collaborative steps taken to isolate the problem, and the quantifiable positive impact achieved."
  },
  {
    id: "hr-2",
    order: 2,
    question: "How do you prioritize competing deadlines when multiple stakeholders request urgent feature deliveries?",
    category: "Time Management",
    isAnswered: false,
    idealAnswer: "Evaluate features using impact vs effort frameworks (e.g., Eisenhower matrix). Communicate transparently with stakeholders early, align on OKRs and business critical paths, and set realistic expectations rather than making silent compromises on code quality."
  },
  {
    id: "hr-3",
    order: 3,
    question: "Describe a time you had a technical disagreement with a team member or lead. How did you resolve it?",
    category: "Conflict Resolution",
    isAnswered: false,
    idealAnswer: "Focus on data and technical trade-offs rather than egos. Seek common objectives, benchmark both approaches with proof-of-concept tests, and abide by the principle of 'disagree and commit' once a collective decision is made."
  },
  {
    id: "hr-4",
    order: 4,
    question: "Where do you see your engineering career evolving in the next 3 to 5 years?",
    category: "Career Vision",
    isAnswered: false,
    idealAnswer: "Express enthusiasm for growing from hands-on feature delivery into architectural ownership, mentoring junior engineers, and driving system-level scalability while staying attuned to modern AI and cloud engineering shifts."
  },
  {
    id: "hr-5",
    order: 5,
    question: "Why are you interested in joining JobNex and what motivates you about this role?",
    category: "Cultural Alignment",
    isAnswered: false,
    idealAnswer: "Connect your personal passion for empowering job seekers with high-impact software, aligning your skills in full-stack architecture and AI with JobNex's mission to make job hunting faster, fairer, and smarter."
  }
];

const JOB_SPECIFIC_DATA = {
  "job-2": {
    missingSkills: ["Deep Learning", "AWS Cloud Infrastructure", "Data Visualization (Plotly/Seaborn)", "Docker & Kubernetes"],
    aiTip: {
      highlightedSkills: ["Deep Learning", "Data Visualization"],
      currentScore: 74,
      projectedScore: 92,
      text: "Acquiring Deep Learning and Data Visualization will elevate your ATS resume match from 74% to 92% for Amazon Forecasting & Intelligence."
    },
    courses: [
      { id: "ds-1", title: "Deep Learning Specialization with PyTorch & TensorFlow", provider: "Coursera", domain: "coursera.org", rating: 4.9, reviewCount: 14200, duration: "16 weeks", url: "https://www.coursera.org/specializations/deep-learning", skillsTargeted: ["Deep Learning", "Neural Networks"], badgeColor: "bg-blue-50 text-blue-700 border-blue-200" },
      { id: "ds-2", title: "Machine Learning A-Z: Python & Scikit-Learn Hands-On", provider: "Udemy", domain: "udemy.com", rating: 4.8, reviewCount: 28900, duration: "44h", url: "https://www.udemy.com/course/machinelearning/", skillsTargeted: ["Machine Learning", "Python"], badgeColor: "bg-purple-50 text-purple-700 border-purple-200" },
      { id: "ds-3", title: "AWS Certified Machine Learning Specialty (MLS-C01)", provider: "Coursera", domain: "coursera.org", rating: 4.7, reviewCount: 5400, duration: "12 weeks", url: "https://www.coursera.org/learn/aws-machine-learning", skillsTargeted: ["AWS", "Cloud Computing"], badgeColor: "bg-amber-50 text-amber-700 border-amber-200" },
      { id: "ds-4", title: "Data Visualization & Dashboards with Python & Plotly", provider: "edX", domain: "edx.org", rating: 4.6, reviewCount: 3800, duration: "6 weeks", url: "https://www.edx.org/learn/data-visualization", skillsTargeted: ["Data Visualization", "Python"], badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    ]
  }
};

// Global export for vanilla browser environments
window.JobNexData = {
  INITIAL_JOBS,
  INITIAL_USER_SKILLS,
  INITIAL_MISSING_SKILLS,
  INITIAL_COURSES,
  INITIAL_APPLICATIONS,
  TECHNICAL_QUESTIONS,
  HR_QUESTIONS,
  JOB_SPECIFIC_DATA
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = window.JobNexData;
}
