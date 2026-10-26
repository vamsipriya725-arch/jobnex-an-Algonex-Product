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
