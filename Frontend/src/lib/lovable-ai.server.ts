export async function handleCareerAgent(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const rawMessages = body["messages"] as unknown;
    const messages = Array.isArray(rawMessages) ? rawMessages : [];
    const lastMsg =
      messages.length > 0
        ? (messages[messages.length - 1] as Record<string, any> | undefined)
        : undefined;

    let userMessage = "";
    if (lastMsg && typeof lastMsg === "object") {
      if (typeof lastMsg["content"] === "string") {
        userMessage = lastMsg["content"];
      } else if (Array.isArray(lastMsg["parts"]) && lastMsg["parts"].length > 0) {
        const firstPart = lastMsg["parts"][0] as Record<string, any> | undefined;
        if (firstPart && typeof firstPart["text"] === "string") {
          userMessage = firstPart["text"];
        }
      }
    }
    if (!userMessage) {
      userMessage = String(body["prompt"] || body["message"] || "");
    }

    const sessionId = (body["session_id"] || body["sessionId"] || body["threadId"]) as string | undefined;
    const analysis = body["analysis"] as unknown;

    // Attempt proxying to JobNex backend career chatbot if running
    try {
      const proc = (globalThis as Record<string, any>)["process"];
      const procEnv = proc ? (proc["env"] as Record<string, string | undefined> | undefined) : undefined;
      const rawBackendUrl = (procEnv && procEnv["BACKEND_URL"]) || "http://127.0.0.1:8000";
      const baseWithSlash = rawBackendUrl.endsWith("/") ? rawBackendUrl : `${rawBackendUrl}/`;
      const targetUrl = new URL("api/chat", baseWithSlash);

      const payload: Record<string, any> = { message: userMessage };
      if (sessionId) payload["session_id"] = sessionId;
      if (analysis) payload["analysis"] = analysis;

      const apiRes = await fetch(targetUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (apiRes.ok) {
        const data = (await apiRes.json()) as Record<string, any>;
        const replyText = String(
          data["reply"] ||
          data["content"] ||
          data["message"] ||
          "I am your JobNex AI Career Assistant. How can I help you today?"
        );

        return new Response(
          JSON.stringify({
            role: "assistant",
            content: replyText,
            parts: [{ type: "text", text: replyText }],
            reply: replyText,
            session_id: data["session_id"] || sessionId,
            actionLinks: data["actionLinks"] || [],
            suggestedChips: data["suggestedChips"] || [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } catch {
      // Backend unavailable fallback
    }

    const fallbackText =
      "I am your JobNex AI Career Assistant. How can I help you accelerate your job search, improve your ATS resume match score, or prepare for technical interviews today?";

    return new Response(
      JSON.stringify({
        role: "assistant",
        content: fallbackText,
        parts: [{ type: "text", text: fallbackText }],
        reply: fallbackText,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
