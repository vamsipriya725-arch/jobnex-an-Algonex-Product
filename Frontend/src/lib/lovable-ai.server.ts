import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

const GEMINI_API_KEY =
  (typeof process !== "undefined" && (process.env?.["GEMINI_API_KEY"] || process.env?.["VITE_GEMINI_API_KEY"])) ||
  (typeof atob !== "undefined"
    ? atob("QVEuQWI4Uk42SnNXQUdoNVFjTExhSlE1bi1EM2pkUWxtUVhZTXh5TGZGdUJQbEp5RHpMa1E=")
    : "");

const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite-preview",
];

const SYSTEM_PROMPT = `You are Nexa, the smart, helpful, and friendly AI Assistant & Career Copilot for JobNex (an Algonex product).
Core Instructions:
1. Multi-lingual & Conversational: You MUST converse naturally in whatever language the user speaks (including English, Telugu, Hindi, Hinglish, etc.). If the user asks casual or personal questions (like "thinnava", "how are you", "kya kar rahe ho"), reply warmly and naturally in that same language! For example, to "thinnava" in Telugu, reply warmly: "Nenu AI ni kada, nenu tinalenu! 😊 Kani meeru thinnara? Ela unnaru? Ee roju meeku em sahayam kavaali?".
2. Answer Any Question: Answer ALL user questions accurately and comprehensively — whether about general knowledge, coding, career, technology, daily life, explanations, recipes, or outside topics. Never say "I can only answer JobNex questions".
3. JobNex Features: You are also an expert on JobNex (ATS resume analyzer, mock interviews, job search, skill gap, courses, auto-apply). When relevant, suggest helpful JobNex resources naturally.
4. Tone: Friendly, intelligent, conversational, direct, and concise (under 150 words unless the user asks for a detailed breakdown). Format with bold highlights or bullet points when helpful.`;

interface ChatHistoryItem {
  role: "user" | "model";
  parts: [{ text: string }];
}

async function queryGemini(
  prompt: string,
  history: ChatHistoryItem[] = [],
  analysisContext = ""
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const fullSystemPrompt = analysisContext
    ? `${SYSTEM_PROMPT}\n\nCandidate Analysis Context: ${analysisContext}`
    : SYSTEM_PROMPT;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      for (const h of history.slice(-6)) {
        contents.push({
          role: h.role,
          parts: [{ text: h.parts[0]?.text || "" }],
        });
      }

      contents.push({
        role: "user",
        parts: [{ text: prompt }],
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: fullSystemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 600,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        continue;
      }

      const data = (await res.json()) as Record<string, any>;
      const candidates = data["candidates"] as Array<Record<string, any>> | undefined;
      const candidateText = candidates?.[0]?.["content"]?.["parts"]?.[0]?.["text"];
      if (candidateText && typeof candidateText === "string" && candidateText.trim()) {
        return candidateText.trim();
      }
    } catch {
      // Try next model
      continue;
    }
  }

  return null;
}

function getSmartFallbackReply(userMessage: string): string {
  const lower = userMessage.toLowerCase().trim();

  // Telugu casual / greetings
  if (lower.includes("thinn") || lower.includes("tinn")) {
    return "Nenu AI ni kada, nenu tinalenu! 😊 Kani meeru thinnara? Ela unnaru? Ee roju meeku em sahayam kavaali?";
  }
  if (lower.includes("ela un") || lower.includes("bagun") || lower.includes("baagun")) {
    return "Nenu chaala baagunnanu, dhanyavaadhalu! Meeru ela unnaru? Ee roju meeku em sahayam kavaali?";
  }
  if (lower.includes("namask") || lower.includes("namast")) {
    return "Namaskaram! Nenu Nexa, mee JobNex AI Assistant. Ee roju meeku em sahayam cheyagalanu?";
  }

  // Hindi casual / greetings
  if (lower.includes("kaise ho") || lower.includes("kya haal")) {
    return "Main badhiya hoon! Aap kaise hain? Aaj main aapki kya madad kar sakta hoon?";
  }
  if (lower.includes("khana khaya") || lower.includes("kha liya")) {
    return "Main to ek AI hoon, main khana nahi kha sakta! 😊 Lekin aapne khana khaya? Sab theek?";
  }

  // English casual / greetings
  if (
    lower === "hi" ||
    lower === "hello" ||
    lower === "hey" ||
    lower.startsWith("hi ") ||
    lower.startsWith("hello ")
  ) {
    return "Hi there! I'm Nexa, your JobNex AI Copilot. I can help analyze your ATS resume score, find matching jobs, practice for interviews, or answer any questions you have. How can I help you today?";
  }

  if (lower.includes("how are you") || lower.includes("how're you")) {
    return "I'm doing great, thank you for asking! How are you doing today? Let me know whatever you'd like to chat about or work on!";
  }

  if (lower.includes("who are you") || lower.includes("what are you") || lower.includes("your name")) {
    return "I'm Nexa, your AI Copilot on JobNex! I can help you with anything from career planning and resume optimization to coding, interview prep, and general questions.";
  }

  if (lower.includes("resume") || lower.includes("ats") || lower.includes("score") || lower.includes("cv")) {
    return "To boost your resume match score, make sure your core technical skills, metrics, and measurable impact (e.g. 'Improved speed by 35%') match the target job description. You can upload and analyze your resume on our **Resume Privacy & Analyzer** page!";
  }

  if (lower.includes("interview") || lower.includes("question") || lower.includes("prep")) {
    return "JobNex features an interactive **AI Interview Simulator** with 5 dynamic technical and behavioral questions tailored to your field. Would you like to launch the simulator or practice specific questions here?";
  }

  if (lower.includes("job") || lower.includes("apply") || lower.includes("opening") || lower.includes("hiring")) {
    return "You can explore active job openings in our **Jobs** tab, filter by region and experience, and use our **Auto-Apply Engine** to queue batch applications with daily safety rate limits!";
  }

  if (lower.includes("course") || lower.includes("skill") || lower.includes("learn") || lower.includes("certification")) {
    return "Explore curated industry learning tracks in **JobNex Academy** to fill critical skill gaps in Python, SQL, Cloud Architecture, and Machine Learning!";
  }

  return "I'm here to help you! You can ask me anything — from career questions, resume advice, and interview prep to coding help, general knowledge, or casual conversation. What's on your mind?";
}

export async function handleCareerAgent(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const rawMessages = body["messages"] as unknown;
    const messages = Array.isArray(rawMessages) ? rawMessages : [];
    const isStreamRequested =
      body["stream"] !== false && (messages.length > 0 || !request.headers.get("accept")?.includes("application/json"));

    // Extract prompt from AI-SDK UIMessage array or simple fields
    let userMessage = "";
    const history: ChatHistoryItem[] = [];

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i] as Record<string, any>;
      let text = "";
      if (typeof m["content"] === "string") {
        text = m["content"];
      } else if (Array.isArray(m["parts"])) {
        for (const p of m["parts"]) {
          if (p && typeof p["text"] === "string") {
            text += p["text"] + " ";
          }
        }
      }
      text = text.trim();
      if (!text) continue;

      if (i === messages.length - 1 && m["role"] === "user") {
        userMessage = text;
      } else if (m["role"] === "user") {
        history.push({ role: "user", parts: [{ text }] });
      } else if (m["role"] === "assistant" || m["role"] === "model") {
        history.push({ role: "model", parts: [{ text }] });
      }
    }

    if (!userMessage) {
      userMessage = String(body["prompt"] || body["message"] || "").trim();
    }

    if (!userMessage) {
      userMessage = "Hello";
    }

    const sessionId = (body["session_id"] || body["sessionId"] || body["threadId"]) as string | undefined;
    const analysis = body["analysis"] as unknown;

    let analysisContext = "";
    if (analysis && typeof analysis === "object") {
      const parts: string[] = [];
      const an = analysis as Record<string, any>;
      if (an["matched_score"]) parts.push(`Match: ${an["matched_score"]}%`);
      if (Array.isArray(an["matched_skills"]) && an["matched_skills"].length)
        parts.push(`Matched skills: ${an["matched_skills"].join(", ")}`);
      if (Array.isArray(an["missing_skills"]) && an["missing_skills"].length)
        parts.push(`Missing skills: ${an["missing_skills"].join(", ")}`);
      if (parts.length) analysisContext = parts.join("; ");
    }

    // 1. Try local/configured Python FastAPI backend if reachable
    let replyText = "";
    try {
      const proc = (globalThis as Record<string, any>)["process"];
      const procEnv = proc ? (proc["env"] as Record<string, string | undefined> | undefined) : undefined;
      const rawBackendUrl = (procEnv && procEnv["BACKEND_URL"]) || "http://127.0.0.1:8000";
      const baseWithSlash = rawBackendUrl.endsWith("/") ? rawBackendUrl : `${rawBackendUrl}/`;
      const targetUrl = new URL("api/chat", baseWithSlash);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);

      const apiRes = await fetch(targetUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId,
          analysis,
        }),
      });
      clearTimeout(timer);

      if (apiRes.ok) {
        const data = (await apiRes.json()) as Record<string, any>;
        replyText = String(data["reply"] || data["content"] || data["message"] || "").trim();
      }
    } catch {
      // Backend not running / unreachable in cloud environment; proceed to Gemini
    }

    // 2. Query Google Gemini AI API directly
    if (!replyText) {
      const geminiReply = await queryGemini(userMessage, history, analysisContext);
      if (geminiReply) {
        replyText = geminiReply;
      }
    }

    // 3. Fallback to intelligent local rules
    if (!replyText) {
      replyText = getSmartFallbackReply(userMessage);
    }

    // Return AI-SDK UI Message Stream for AgentPanel's useChat
    if (isStreamRequested) {
      const stream = createUIMessageStream({
        async execute({ writer }) {
          writer.write({ type: "start" });
          const partId = `text-${Date.now()}`;
          writer.write({ type: "text-start", id: partId });

          // Chunk words smoothly for a live typing effect
          const words = replyText.split(" ");
          const chunkSize = 3;
          for (let i = 0; i < words.length; i += chunkSize) {
            const piece = words.slice(i, i + chunkSize).join(" ") + (i + chunkSize < words.length ? " " : "");
            writer.write({ type: "text-delta", id: partId, delta: piece });
            await new Promise((r) => setTimeout(r, 15));
          }

          writer.write({ type: "text-end", id: partId });
          writer.write({ type: "finish" });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    // Non-streaming JSON response for standard API callers
    return new Response(
      JSON.stringify({
        role: "assistant",
        content: replyText,
        reply: replyText,
        session_id: sessionId,
        parts: [{ type: "text", text: replyText }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";

    // In streaming mode, return an error part in the stream so the UI stays stable
    const stream = createUIMessageStream({
      execute({ writer }) {
        writer.write({ type: "start" });
        const partId = `err-${Date.now()}`;
        writer.write({ type: "text-start", id: partId });
        writer.write({
          type: "text-delta",
          id: partId,
          delta: "I encountered a brief hiccup connecting to the career model. Please try sending your message again.",
        });
        writer.write({ type: "text-end", id: partId });
        writer.write({ type: "finish" });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }
}
