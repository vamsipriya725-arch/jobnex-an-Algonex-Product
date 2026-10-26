# JobNex Frontend — Setup

React + TypeScript + TanStack Start + Tailwind CSS v4 + Framer Motion.

## Run locally

```sh
npm i
cp .env.example .env   # then fill in your own values
npm run dev            # http://localhost:8080
```

`npm run build` builds for production, `npm run lint` checks code style,
`npm run test` runs the routing tests.

## Pages (one route file each under `src/routes`)

| Route               | Screen                                     |
| ------------------- | ------------------------------------------ |
| `/`                 | Home landing page                          |
| `/jobs`             | Job search & filtering                     |
| `/dashboard`        | Candidate dashboard & application tracking |
| `/ai-assistant`     | AI career assistant                        |
| `/interview-prep`   | Interview prep simulator                   |
| `/skill-gap`        | Skill gap analysis                         |
| `/auto-apply`       | Auto-apply queue                           |
| `/cold-referral`    | Cold referral outreach generator           |
| `/resume-privacy`   | Resume privacy controls                    |
| `/courses`          | Courses                                    |
| `/resources`        | Resources                                  |
| `/login`, `/signup` | Auth                                       |

## Where things live

- `src/frontend/views/` — one view per screen (the imported jobNex views)
- `src/frontend/components/shared/` — Navbar, Footer, JobCard (shared across screens)
- `src/frontend/components/agent/AgentPanel.tsx` — the AI assistant side panel
- `src/frontend/components/ui/` and `src/frontend/components/ai-elements/` — UI primitives
- `src/frontend/context/JobNexContext.tsx` — shared demo state and sample data
- `src/frontend/hooks/` — custom React hooks (e.g., use-mobile)
- `src/frontend/styles.css` — theme colours, gradients and animations
- `src/lib/mockData.ts` — sample jobs, applications and profile data
- `src/lib/nav.tsx` — navigation helper used by the imported views
- `src/routes/` — route files; `routeTree.gen.ts` is generated, don't edit it

## Backend notes

Most screens run on sample data and work with no backend. The login, sign-up
and AI assistant panel use Lovable Cloud (Supabase) — set `VITE_SUPABASE_URL`
and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`, and apply
`drizzle/migrations/0000_create_agent_chat_tables.sql` for the chat history
tables. Server-side AI calls need the `LOVABLE_API_KEY` environment variable.
Without these, the app still runs; those features stay inactive.
