const http = require("node:http");

const PORT = Number(process.env.PORT || 10000);
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
const JAVY_API_URL = (process.env.JAVY_API_URL || "https://javy-ten.vercel.app/api/chat").trim();
const TELEGRAM_API = "https://api.telegram.org";

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function telegram(method, payload) {
  const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(data.description || `Telegram API ${method} failed`);
  }
  return data;
}

async function sendMessage(chatId, text) {
  const chars = Array.from(String(text || "Javy bo'sh javob qaytardi."));
  while (chars.length) {
    let size = Math.min(4000, chars.length);
    if (chars.length > 4000) {
      const newline = chars.slice(0, 4000).lastIndexOf("\n");
      if (newline > 2400) size = newline + 1;
    }
    await telegram("sendMessage", {
      chat_id: chatId,
      text: chars.splice(0, size).join(""),
      disable_web_page_preview: true,
    });
  }
}

async function getJavyReply(message, guestName) {
  const response = await fetch(JAVY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestName,
      messages: [{ role: "user", content: String(message).slice(0, 20000) }],
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Javy API xatoligi (${response.status})`);
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
          const item = JSON.parse(line.slice(6));
          if (item.type === "delta" && typeof item.content === "string") answer += item.content;
          if (item.type === "error") throw new Error(item.error || "Javy AI javobida xatolik.");
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

async function handleUpdate(update) {
  const message = update.message;
  const text = message && typeof message.text === "string" ? message.text.trim() : "";
  if (!message || !message.chat || !text) return;

  const chatId = message.chat.id;
  const firstName = message.from && message.from.first_name ? message.from.first_name.trim() : "Telegram foydalanuvchisi";

  if (text === "/start" || text.startsWith("/start ")) {
    await sendMessage(chatId, `Assalomu alaykum, ${firstName}! 👋

Men Javy — sun'iy intellekt yordamchingizman.

Menga savol, matematika masalasi, dasturlash topshirig'i yoki boshqa mavzuda xabar yuboring. Sizga javob beraman!`);
    return;
  }

  if (text.startsWith("/")) {
    await sendMessage(chatId, "Hozircha oddiy xabar yuboring yoki /start buyrug'idan foydalaning.");
    return;
  }

  try {
    const answer = await getJavyReply(text, firstName);
    await sendMessage(chatId, answer);
  } catch (error) {
    console.error("Javy Telegram error:", error);
    await sendMessage(chatId, `Kechirasiz, ${error.message || "Javy hozir javob bera olmadi."}`);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "javy-telegram-bot" });
  }

  if (req.method === "POST" && url.pathname === "/telegram/webhook") {
    if (!WEBHOOK_SECRET || req.headers["x-telegram-bot-api-secret-token"] !== WEBHOOK_SECRET) {
      return sendJson(res, 401, { ok: false });
    }
    let update;
    try {
      update = await readBody(req);
    } catch {
      return sendJson(res, 400, { ok: false });
    }
    // Acknowledge quickly; process the update without making Telegram wait for AI generation.
    sendJson(res, 200, { ok: true });
    handleUpdate(update).catch((error) => console.error("Update processing failed:", error));
    return;
  }

  return sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Javy Telegram bot listening on port ${PORT}`);
  if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET.");
    return;
  }
  const publicUrl = (process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  if (!publicUrl) {
    console.error("RENDER_EXTERNAL_URL is not available; set the webhook manually after deployment.");
    return;
  }
  try {
    const result = await telegram("setWebhook", {
      url: `${publicUrl}/telegram/webhook`,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
    console.log("Telegram webhook registered:", result.ok);
  } catch (error) {
    console.error("Could not register Telegram webhook:", error.message);
  }
});
