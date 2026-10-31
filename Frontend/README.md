# JobNex — 100% Plain Static Website

JobNex is an AI-powered career and recruitment ecosystem built as a **pure static frontend website**: HTML5, CSS3, and JavaScript only. No TypeScript, no React, no backend server, and no build step.

---

## Project Structure

```
frontend/
├── index.html                  # Main Landing / Home page
├── pages/                      # All route pages
│   ├── jobs.html               # Job search & directory with filters & application modal
│   ├── courses.html            # JobNex Academy courses & certifications
│   ├── resources.html          # Career guides, resume templates, salary insights
│   ├── ai-assistant.html       # Interactive AI career assistant chatbot
│   ├── interview-prep.html     # AI interview simulator with real-time feedback
│   ├── skill-gap.html          # Skill gap diagnostics & course recommendations
│   ├── auto-apply.html         # Automated application queue & rate limiter
│   ├── cold-referral.html      # AI cold referral outreach email drafter
│   ├── dashboard.html          # ATS application tracking dashboard & timeline
│   ├── resume-privacy.html     # Resume parser & recruiter-blind privacy settings
│   └── login.html              # Sign-in & sign-up cockpit with demo 1-click accounts
├── components/                 # Reusable HTML fragments
│   ├── navbar.html             # Shared header navigation bar
│   ├── footer.html             # Shared footer
│   └── job-card.html           # Reusable job card template
├── css/
│   └── styles.css              # Vanilla design system & keyframe animations
├── js/                         # Page-specific scripts & core modules
│   ├── home.js                 # Home page logic
│   ├── jobs.js                 # Jobs filtering & application modal logic
│   ├── courses.js              # Academy courses logic
│   ├── resources.js            # Resource center logic
│   ├── ai-assistant.js         # AI Chatbot logic
│   ├── interview-prep.js       # Interview simulator logic
│   ├── skill-gap.js            # Skill gap & slider logic
│   ├── auto-apply.js           # Auto-apply batch runner
│   ├── cold-referral.js        # Referral message composer
│   ├── dashboard.js            # ATS table & slide-out timeline drawer
│   ├── resume-privacy.js       # Resume analysis & privacy toggles
│   ├── login.js                # Authentication & demo account switcher
│   ├── auth.js                 # User state management & Supabase CDN client
│   ├── nav.js                  # Relative URL routing & active navigation
│   └── utils.js                # HTML component loader, toasts, sound fx, starfield
├── data/
│   └── mock-data.js            # Jobs, courses, questions, applications dataset
└── assets/                     # Brand logos, icons, robots.txt
```

---

## How to Run

### Direct File / VS Code Live Server (Zero Installation)
Simply double-click `frontend/index.html` (or root `index.html`) in your file explorer, or right-click `frontend/index.html` in VS Code and choose **"Open with Live Server"**.

All assets, links, and components use relative paths and load with zero installation or build steps!

---

## Features

- **Pixel-Perfect Design**: Preserves all colors (`#eaebf6`, `#646ca6`, `#ebabbb`), typography (Plus Jakarta Sans, Space Grotesk), glassmorphism cards, and CSS animations.
- **Dynamic Interactions**: State management, live search filtering, speech-to-text recording simulation, skill sliders, and timeline drawers are fully functional in vanilla JavaScript.
- **Demo Quick Accounts**: 1-click login as Sandeep Kumar (Job Seeker) or Sarah Jenkins (Recruiter) on `pages/login.html`.
- **Responsive**: Mobile drawer navigation, tablet layouts, and desktop wide screens.

---

## 🔐 Google OAuth & Supabase Authentication Configuration Checklist

JobNex uses Google OAuth provisioned through **Supabase Auth**. No Google client secrets or Google SDK scripts reside in the frontend code.

### 1. Google Cloud Console Setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - App Name: `JobNex`
   - Scopes: `email`, `profile`, `openid`
3. Navigate to **Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `JobNex Supabase Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `http://localhost:3000`
     - `https://<your-production-domain>`
   - **Authorized redirect URIs**:
     - `https://swqebafkntjlgjglylcr.supabase.co/auth/v1/callback` (format: `https://<project-ref>.supabase.co/auth/v1/callback`)
4. Copy the generated **Client ID** and **Client Secret**.

---

### 2. Supabase Dashboard Setup
1. Open your project at [Supabase Dashboard](https://supabase.com/dashboard/project/swqebafkntjlgjglylcr).
2. Go to **Authentication → Providers → Google**:
   - Toggle **Enable Google provider** to **ON**.
   - Paste **Client ID** from Google Cloud Console.
   - Paste **Client Secret** from Google Cloud Console.
   - Click **Save**.
3. Go to **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (or your production URL).
   - **Redirect URLs** (add all environments):
     - `http://localhost:5173/**`
     - `http://localhost:3000/**`
     - `http://localhost:8000/**`
     - `https://<your-production-domain>/**`
   - Click **Save**.

---

### 3. Database Trigger (`profiles` creation)
Run the following SQL in your Supabase SQL Editor (also in `supabase_schema.sql`):
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        new.email,
        COALESCE(new.raw_user_meta_data->>'phone', ''),
        COALESCE(new.raw_user_meta_data->>'role', 'seeker'),
        COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        avatar_url = EXCLUDED.avatar_url;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### 4. Frontend Environment Variables
In `Frontend/.env.local`:
```env
VITE_SUPABASE_URL=https://swqebafkntjlgjglylcr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ax9iQjGlK5pP34biLoMcag_0egUp2qE
```

