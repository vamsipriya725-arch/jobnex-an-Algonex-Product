import type { JobPosting, ExperienceLevel, Region } from "@/domain/types";

const API_BASE: string =
    (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:8000";

export const EXPERIENCE_OPTIONS: ExperienceLevel[] = ["Fresher", "1-2 yrs", "3-5 yrs", "5+ yrs"];

export interface CommunityJobForm {
    title: string;
    company: string;
    location: string;
    experience: ExperienceLevel;
    salary: string;
    skills: string; // comma separated in the form
    url: string;
}

interface CommunityJobApi {
    id: number;
    title: string;
    company: string;
    location: string;
    experience: ExperienceLevel;
    salary: string;
    skills: string[];
    url: string;
    uploaded_by?: string | null;
    created_at?: string | null;
}

const INDIA_RE =
    /india|bengaluru|bangalore|hyderabad|chennai|pune|mumbai|delhi|noida|gurgaon|gurugram|kolkata|ahmedabad|vijayawada|kochi/i;

function guessRegion(location: string): Region {
    if (INDIA_RE.test(location)) return "INDIA";
    if (/bangladesh|dhaka/i.test(location)) return "BANGLADESH";
    if (/\bUSA?\b|united states|new york|san francisco|california|texas|seattle/i.test(location))
        return "US";
    return "GLOBAL";
}

function guessWorkplace(location: string): JobPosting["workplaceType"] {
    if (/remote/i.test(location)) return "Remote";
    if (/hybrid/i.test(location)) return "Hybrid";
    return "On-site";
}

/** Simple letter logo so community jobs don't need an image upload. */
function letterLogo(company: string): string {
    const letter = (company.trim()[0] || "?").toUpperCase();
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'>` +
        `<rect width='56' height='56' fill='#e0e7ff'/>` +
        `<text x='50%' y='54%' font-family='Arial' font-size='26' font-weight='700' ` +
        `fill='#4338ca' text-anchor='middle' dominant-baseline='middle'>${letter}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function toJobPosting(j: CommunityJobApi): JobPosting {
    return {
        id: `community-${j.id}`,
        title: j.title,
        company: j.company,
        companyLogo: letterLogo(j.company),
        location: j.location,
        region: guessRegion(j.location),
        workplaceType: guessWorkplace(j.location),
        experienceLevel: j.experience,
        salaryMin: 0,
        salaryMax: 0,
        currency: "INR",
        description: "",
        requirements: [],
        skills: j.skills,
        certifications: [],
        postedAt: j.created_at || new Date().toISOString(),
        salaryText: j.salary || "",
        sourceUrl: j.url,
        isCommunity: true,
    };
}

async function readError(res: Response): Promise<string> {
    try {
        const data = await res.json();
        if (typeof data.detail === "string") return data.detail;
        if (Array.isArray(data.detail) && data.detail[0]?.msg)
            return String(data.detail[0].msg).replace(/^Value error, /, "");
    } catch {
        /* ignore */
    }
    return "Something went wrong. Please try again.";
}

export async function fetchCommunityJobs(): Promise<JobPosting[]> {
    const res = await fetch(`${API_BASE}/api/community-jobs`);
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return (data.jobs as CommunityJobApi[]).map(toJobPosting);
}

export async function uploadCommunityJob(
    form: CommunityJobForm,
    uploadedBy?: string,
): Promise<JobPosting> {
    const res = await fetch(`${API_BASE}/api/community-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: form.title,
            company: form.company,
            location: form.location,
            experience: form.experience,
            salary: form.salary || null,
            skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
            url: form.url,
            uploaded_by: uploadedBy || null,
        }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return toJobPosting(data.job as CommunityJobApi);
}