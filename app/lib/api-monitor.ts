const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export function logApiEvent(event: {
  route: string;
  requestId: string;
  status: number;
  durationMs: number;
  error?: unknown;
}) {
  const payload = {
    type: "javy_api",
    ...event,
    error: event.error instanceof Error ? event.error.message : event.error,
    at: new Date().toISOString(),
  };
  if (event.status >= 500) console.error(JSON.stringify(payload));
  else console.info(JSON.stringify(payload));
}

export function monitoredApi(
  route: string,
  handler: (request: Request, requestId: string) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    try {
      const response = await handler(request, requestId);
      logApiEvent({ route, requestId, status: response.status, durationMs: Date.now() - startedAt });
      const headers = new Headers(response.headers);
      headers.set("x-request-id", requestId);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      logApiEvent({ route, requestId, status: 500, durationMs: Date.now() - startedAt, error });
      return Response.json(
        { error: "Serverda kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.", requestId },
        { status: 500, headers: { "x-request-id": requestId, "Cache-Control": "no-store" } },
      );
    }
  };
}
