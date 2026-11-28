const http = require("node:http");
const { timingSafeEqual } = require("node:crypto");

const PORT = Number(process.env.PORT || 10000);
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
const JAVY_API_URL = (process.env.JAVY_API_URL || "https://javy-ten.vercel.app/api/chat").trim();
const TELEGRAM_API = "https://api.telegram.org";
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_MESSAGE_LENGTH = 20_000;
const seenUpdates = new Set();
let botUsername = "";

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function telegram(method, payload) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan.");
  const response = await fetch(\`\${TELEGRAM_API}/bot\${BOT_TOKEN}/\${method}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(data.description || \`Telegram API \${method} failed\`);
  }
  return data.result;
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: "❓ Yordam" }, { text: "🤖 Javy haqida" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Javyga xabar yozing...",
  };
}

async function sendMessage(chatId, text, extra = {}) {
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
      link_preview_options: { is_disabled: true },
      ...extra,
    });
  }
}

function commandOf(text) {
  const match = String(text || "").trim().match(/^\/([a-z0-9_]+)(?:@\w+)?(?:\s|$)/i);
  return match ? match[1].toLowerCase() : "";
}

function isPrivateChat(message) {
  return !message.chat?.type || message.chat.type === "private";
}

function isBotAddressed(message, text) {
  if (isPrivateChat(message)) return true;
  const mentioned = botUsername && new RegExp(\`@\${botUsername.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&")}\\b\`, "i").test(text);
  const repliedToBot = message.reply_to_message?.from?.is_bot === true;
  return Boolean(mentioned || repliedToBot || commandOf(text));
}

function cleanBotMention(text) {
  return botUsername ? text.replace(new RegExp(\`@\${botUsername.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&")}\\b\`, "ig"), "").trim() : text.trim();
}

async function getJavyReply(message, guestName) {
  const response = await fetch(JAVY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestName,
      messages: [{ role: "user", content: String(message).slice(0, MAX_MESSAGE_LENGTH) }],
    }),
    signal: AbortSignal.timeout(55_000),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      throw new Error("Javy API'ga kirish cheklangan. JAVY_API_URL manzilini tekshirish kerak.");
    }
    if (response.status === 429) throw new Error("Javy so'rovlar limiti vaqtincha tugadi. Birozdan keyin urinib ko'ring.");
    if (response.status >= 500) throw new Error("Javy AI xizmati vaqtincha ishlamayapti. Keyinroq urinib ko'ring.");
    throw new Error(typeof error.error === "string" ? error.error : \`Javy API xatoligi (\${response.status}).\`);
  }
  if (!response.body) throw new Error("Javy javob oqimini qaytarmadi.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  function consumeEvent(event) {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      let item;
      try {
        item = JSON.parse(raw);
      } catch {
        continue;
      }
      if (item.type === "delta" && typeof item.content === "string") answer += item.content;
      if (item.type === "error") throw new Error(item.error || "Javy javobida xatolik yuz berdi.");
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      for (const event of events) consumeEvent(event);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consumeEvent(buffer);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }

  if (!answer.trim()) throw new Error("Javy bo'sh javob qaytardi. Qayta urinib ko'ring.");
  return answer.trim();
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message?.chat?.id) return;

  const chatId = message.chat.id;
  const firstName = message.from?.first_name?.trim() || "foydalanuvchi";
  const text = typeof message.text === "string" ? message.text.trim() : "";
  const command = commandOf(text);

  if (command === "start") {
    await sendMessage(chatId, \`Assalomu alaykum, \${firstName}! 👋

Men Javy — sun'iy intellekt yordamchingizman.

Savolingizni yozing: bilim, matematika, dasturlash, tarjima yoki boshqa mavzularda yordam beraman.

Quyidagi tugmalardan yordam olishingiz mumkin.\`, {
      reply_markup: mainKeyboard(),
    });
    return;
  }

  if (command === "help" || text === "❓ Yordam") {
    await sendMessage(chatId, \`❓ Javy'dan foydalanish

• Savolingizni oddiy xabar qilib yuboring.
• Kod yozish yoki xatoni tushuntirishni so'rashingiz mumkin.
• Joriy ma'lumot kerak bo'lsa, internetdan qidirishni so'rang.
• Uzun javoblar bir nechta xabarga bo'linadi.

Buyruqlar:
/start — botni boshlash
/help — yordam
/about — Javy haqida\`, { reply_markup: mainKeyboard() });
    return;
  }

  if (command === "about" || text === "🤖 Javy haqida") {
    await sendMessage(chatId, "🤖 Javy — savollarga javob berish, tushuntirish, yozish va dasturlashda yordam beradigan sun'iy intellekt yordamchisi.", {
      reply_markup: mainKeyboard(),
    });
    return;
  }

  if (command) {
    await sendMessage(chatId, "Bu buyruq hozircha mavjud emas. /help orqali mavjud buyruqlarni ko'ring.", {
      reply_markup: mainKeyboard(),
    });
    return;
  }

  if (!text) {
    await sendMessage(chatId, "Hozircha matnli xabarlarni qabul qilaman. Savolingizni yozib yuboring.", {
      reply_markup: mainKeyboard(),
    });
    return;
  }

  if (!isBotAddressed(message, text)) return;
  const prompt = cleanBotMention(text);
  if (!prompt) {
    await sendMessage(chatId, "Savolingizni ham yozib yuboring 🙂");
    return;
  }

  if (prompt.length > MAX_MESSAGE_LENGTH) {
    await sendMessage(chatId, "Xabaringiz juda uzun. Iltimos, uni 20 000 belgidan qisqartiring.");
    return;
  }

  let typingTimer;
  try {
    await telegram("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
    typingTimer = setInterval(() => {
      telegram("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
    }, 4000);
    typingTimer.unref?.();

    const answer = await getJavyReply(prompt, firstName);
    await sendMessage(chatId, answer);
  } catch (error) {
    console.error("Javy Telegram error:", error);
    const messageText = error instanceof Error ? error.message : "Noma'lum xatolik yuz berdi.";
    await sendMessage(chatId, \`Kechirasiz, \${messageText}\`);
  } finally {
    if (typingTimer) clearInterval(typingTimer);
  }
}

function validWebhookSecret(supplied) {
  if (!WEBHOOK_SECRET || typeof supplied !== "string") return false;
  const expectedBuffer = Buffer.from(WEBHOOK_SECRET);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host || "localhost"}\`);

  if (req.method === "GET" && url.pathname === "/") {
    return sendJson(res, 200, {
      service: "Javy Telegram Bot",
      status: "running",
      health: "/health",
    });
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "javy-telegram-bot",
      configured: Boolean(BOT_TOKEN && WEBHOOK_SECRET),
    });
  }

  if (req.method === "POST" && url.pathname === "/telegram/webhook") {
    if (!validWebhookSecret(req.headers["x-telegram-bot-api-secret-token"])) {
      return sendJson(res, 401, { ok: false, error: "Unauthorized" });
    }

    let update;
    try {
      update = await readBody(req);
    } catch {
      return sendJson(res, 400, { ok: false, error: "Invalid request body" });
    }

    if (Number.isInteger(update.update_id)) {
      if (seenUpdates.has(update.update_id)) return sendJson(res, 200, { ok: true, duplicate: true });
      seenUpdates.add(update.update_id);
      if (seenUpdates.size > 2000) seenUpdates.delete(seenUpdates.values().next().value);
    }

    // Telegram receives a quick acknowledgement; the bot handles AI generation separately.
    sendJson(res, 200, { ok: true });
    handleUpdate(update).catch((error) => console.error("Update processing failed:", error));
    return;
  }

  return sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, "0.0.0.0", async () => {
  console.log(\`Javy Telegram bot listening on port \${PORT}\`);

  if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET.");
    return;
  }

  const publicUrl = (process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  if (!publicUrl) {
    console.error("RENDER_EXTERNAL_URL is not available; webhook registration skipped.");
    return;
  }

  try {
    const me = await telegram("getMe", {});
    botUsername = me.username || "";
    const result = await telegram("setWebhook", {
      url: \`\${publicUrl}/telegram/webhook\`,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
    console.log(\`Telegram webhook registered for @\${botUsername || "bot"}:\`, Boolean(result));
  } catch (error) {
    console.error("Telegram startup configuration failed:", error.message);
  }
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
