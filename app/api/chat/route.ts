import Groq from "groq-sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MODELS = new Set([
  DEFAULT_MODEL, "openai/gpt-oss-20b", "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant", "qwen/qwen3.8-27b"
]);
const hits = new Map<string, { count: number; reset: number }>();
function limited(key: string) {
  const now = Date.now();
  const item = hits.get(key);
  if (!item || item.reset < now) { hits.set(key, { count: 1, reset: now + 60_000 }); return false; }
  item.count++;
  return item.count > 20;
}
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return Response.json({ error: "Juda ko'p so'rov yuborildi. Bir daqiqadan keyin urinib ko'ring." }, { status: 429 });
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Vercel sozlamalarida GROQ_API_KEY topilmadi. Environment Variables bo'limiga kalitni kiriting va qayta deploy qiling." }, { status: 500 });
  try {
    const body = await req.json();
    const { messages, model, temperature, systemPrompt } = body ?? {};
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 50) return Response.json({ error: "Xabarlar formati noto'g'ri." }, { status: 400 });
    if (!messages.every((m: any) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string" && m.content.length <= 20000)) return Response.json({ error: "Xabar matni noto'g'ri yoki juda uzun." }, { status: 400 });
    const selected = typeof model === "string" && MODELS.has(model) ? model : DEFAULT_MODEL;
    const temp = typeof temperature === "number" ? Math.min(2, Math.max(0, temperature)) : 0.7;
    const prompt = typeof systemPrompt === "string" ? systemPrompt.slice(0, 4000) : "Sen Javy'san, foydalanuvchi qaysi tilda yozsa, shu tilda (ayniqsa o'zbek tilida) aniq va do'stona javob ber";
    const groq = new Groq({ apiKey });
    const stream = await groq.chat.completions.create({
      model: selected, temperature: temp, stream: true,
      messages: [{ role: "system", content: prompt }, ...messages]
    });
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content;
            if (token) controller.enqueue(encoder.encode(token));
          }
        } catch (error) {
          console.error("Groq stream error:", error);
          controller.enqueue(encoder.encode("\n\n[STREAM_ERROR]"));
        } finally { controller.close(); }
      }
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
  } catch (error: any) {
    console.error("Groq chat error:", { status: error?.status, code: error?.code, message: error?.message });
    const status = Number(error?.status) || 500;
    let message = "Groq serveriga ulanib bo'lmadi. Birozdan keyin qayta urinib ko'ring.";
    if (status === 401) message = "Groq API kaliti noto'g'ri yoki bekor qilingan. Groq Console'dan yangi kalit oling va Vercel'dagi GROQ_API_KEY qiymatini yangilang.";
    else if (status === 403) message = "Groq API ushbu kalit yoki model uchun ruxsat bermadi. Groq Console'dagi hisob va model ruxsatlarini tekshiring.";
    else if (status === 404) message = "Tanlangan AI modeli Groq'da topilmadi. Sozlamalardan boshqa modelni tanlang.";
    else if (status === 429) message = "Groq limitiga yetdingiz. Birozdan so'ng qayta urinib ko'ring.";
    else if (status === 400) message = "Groq so'rovni qabul qilmadi. Sozlamalardagi modelni almashtirib ko'ring.";
    return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}