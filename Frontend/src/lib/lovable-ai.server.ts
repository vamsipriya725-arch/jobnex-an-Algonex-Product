export async function handleCareerAgent(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const userMessage =
      body.messages?.[body.messages.length - 1]?.content || body.prompt || "";

    // Attempt proxying to JobNex backend career chatbot if running
    try {
      const backendUrl =
        (typeof process !== "undefined" && process.env && process.env["BACKEND_URL"]) ||
        "http://127.0.0.1:8000";
      const apiRes = await fetch(`${backendUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      if (apiRes.ok) {
        return apiRes;
      }
    } catch {
      // Backend unavailable fallback
    }

    return new Response(
      JSON.stringify({
        role: "assistant",
        content:
          "I am your JobNex AI Career Assistant. How can I help you accelerate your job search, improve your ATS resume match score, or prepare for technical interviews today?",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
