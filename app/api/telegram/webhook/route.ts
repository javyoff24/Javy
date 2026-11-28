import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
};

const TELEGRAM_API = "https://api.telegram.org";

async function sendTelegramMessage(token: string, chatId: number, text: string) {
  const chunks = splitMessage(text || "Javy hozir javob bera olmadi. Iltimos, qayta urinib ko'ring.");
  for (const chunk of chunks) {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Telegram sendMessage failed:", response.status, detail.slice(0, 300));
      throw new Error("Telegram xabarini yuborib bo'lmadi.");
    }
  }
}

function splitMessage(value: string, limit = 4000): string[] {
  const chars = Array.from(value.trim());
  if (!chars.length) return ["Javy bo'sh javob qaytardi."];
  const chunks: string[] = [];
  while (chars.length) {
    let size = Math.min(limit, chars.length);
    if (chars.length > limit) {
      const breakAt = chars.slice(0, limit).lastIndexOf("\n");
      if (breakAt > limit * 0.6) size = breakAt + 1;
    }
    chunks.push(chars.splice(0, size).join(""));
  }
  return chunks;
}

async function getJavyReply(origin: string, message: string, guestName: string) {
  const response = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestName,
      messages: [{ role: "user", content: message.slice(0, 20000) }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.error === "string" ? payload.error : "Javy AI xizmatida xatolik yuz berdi.");
  }
  if (!response.body) throw new Error("Javy javob oqimini qaytarmadi.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.type === "delta" && typeof payload.content === "string") answer += payload.content;
          if (payload.type === "error") throw new Error(payload.error || "Javy javobida xatolik.");
        } catch (error) {
          if (error instanceof SyntaxError) continue;
          throw error;
        }
      }
    }
  }

  if (!answer.trim()) throw new Error("Javy bo'sh javob qaytardi.");
  return answer.trim();
}

export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!token || !webhookSecret) {
    return Response.json({ error: "Telegram bot sozlamalari kiritilmagan." }, { status: 503 });
  }

  const suppliedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (suppliedSecret !== webhookSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  const text = message?.text?.trim();
  if (!message?.chat?.id || !text) return Response.json({ ok: true });

  const chatId = message.chat.id;
  const firstName = message.from?.first_name?.trim() || "Telegram foydalanuvchisi";

  try {
    if (text === "/start" || text.startsWith("/start ")) {
      await sendTelegramMessage(
        token,
        chatId,
        `Assalomu alaykum, ${firstName}! 👋

Men Javy — sun'iy intellekt yordamchingizman.

Menga savol, matematika masalasi, dasturlash topshirig'i yoki boshqa mavzuda xabar yuboring. Sizga javob beraman!`,
      );
      return Response.json({ ok: true });
    }

    if (text.startsWith("/")) {
      await sendTelegramMessage(token, chatId, "Hozircha oddiy xabar yuboring yoki /start buyrug'idan foydalaning.");
      return Response.json({ ok: true });
    }

    const answer = await getJavyReply(new URL(request.url).origin, text, firstName);
    await sendTelegramMessage(token, chatId, answer);
  } catch (error) {
    console.error("Javy Telegram webhook error:", error);
    const errorText = error instanceof Error ? error.message : "Noma'lum xatolik yuz berdi.";
    try {
      await sendTelegramMessage(token, chatId, `Kechirasiz, ${errorText}`);
    } catch {
      // Telegram retries failed webhook deliveries; avoid leaking provider details.
    }
  }

  return Response.json({ ok: true });
}
