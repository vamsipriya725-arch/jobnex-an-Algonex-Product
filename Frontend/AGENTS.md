<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Imported jobNex views live in src/frontend/views with shared state in src/context/JobNexContext.tsx (mock data, no backend); src/lib/nav.tsx adapts their Next-style href/router calls to TanStack Router — keep using it so ported views stay unchanged.
- Map imported utility color scales to the shared palette in src/styles.css so all ported screens follow theme changes without restructuring views.
- The AI agent side panel (src/components/agent/AgentPanel.tsx) is mounted in __root.tsx and streams through src/routes/api/chat.ts → src/lib/lovable-ai.server.ts (openai/gpt-6-astra via the Lovable AI Gateway Responses API). Threads/messages persist in public.chat_threads/chat_messages (RLS per user); thread CRUD lives in src/lib/agent.functions.ts. Server-side token validation must pass the JWT explicitly: supabase.auth.getUser(accessToken) — a bare getUser() reads the in-memory session and always fails in server handlers.
- Login/SignUp views call real Lovable Cloud auth (email/password + Google via lovable.auth.signInWithOAuth) alongside the mock JobNexContext login that drives the demo role UI — keep both paths when editing those views.
- No WebGL/3D libraries (three.js, React Three Fiber) anywhere in the project; animated backgrounds are plain React + CSS (see src/components/hero/HeroBackdrop.tsx) — the user wants only plain HTML/CSS/JS/React code.
