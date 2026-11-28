import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!token || !secret) {
    return Response.json({ ok: false, error: "Telegram bot sozlamalari topilmadi." }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/api/telegram/webhook`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message"],
        drop_pending_updates: false,
      }),
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      console.error("Telegram setWebhook failed:", result);
      return Response.json({ ok: false, error: "Telegram webhook sozlanmadi." }, { status: 502 });
    }

    return Response.json({ ok: true, message: "Telegram webhook muvaffaqiyatli ulandi.", webhook: webhookUrl });
  } catch (error) {
    console.error("Telegram webhook setup error:", error);
    return Response.json({ ok: false, error: "Telegram bilan bog'lanib bo'lmadi." }, { status: 502 });
  }
}
