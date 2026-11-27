import { monitoredApi } from "../../lib/api-monitor";

export const runtime = "nodejs";

export const GET = monitoredApi("GET /api/health", async () => {
  const groqConfigured = Boolean(process.env.GROQ_API_KEY?.trim());
  const healthy = groqConfigured;
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      services: {
        chat: groqConfigured ? "configured" : "missing_api_key",
        webSearch: "duckduckgo",
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    },
  );
});
