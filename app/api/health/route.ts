import Groq from "groq-sdk";
import { monitoredApi } from "../../lib/api-monitor";

export const runtime = "nodejs";

export const GET = monitoredApi("GET /api/health", async () => {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  let chatStatus: "connected" | "missing_api_key" | "unreachable" = "missing_api_key";

  if (apiKey) {
    try {
      const groq = new Groq({ apiKey, timeout: 8_000, maxRetries: 0 });
      await groq.models.list();
      chatStatus = "connected";
    } catch {
      chatStatus = "unreachable";
    }
  }

  const healthy = chatStatus === "connected";
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      services: {
        chat: chatStatus,
        webSearch: "Google News RSS + DuckDuckGo HTML/Lite + Bing RSS; relevance filtering enabled",
        pdf: "server-side extraction enabled",
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    },
  );
});
