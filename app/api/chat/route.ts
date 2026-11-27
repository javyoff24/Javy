import Groq from "groq-sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const MODELS = new Set([
  DEFAULT_MODEL, "llama-3.1-8b-instant", "openai/gpt-oss-120b",
  "openai/gpt-oss-20b", "qwen/qwen3-32b", "meta-llama/llama-4-scout-17b-16e-instruct"
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
  if (!process.env.GROQ_API_KEY) return Response.json({ error: "Serverda GROQ_API_KEY sozlanmagan." }, { status: 500 });
  try {
    const body = await req.json();
    const { messages, model, temperature, systemPrompt } = body ?? {};
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 50) return Response.json({ error: "Xabarlar formati noto'g'ri." }, { status: 400 });
    if (!messages.every((m: any) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string" && m.content.length <= 20000)) return Response.json({ error: "Xabar matni noto'g'ri yoki juda uzun." }, { status: 400 });
    const selected = typeof model === "string" && MODELS.has(model) ? model : DEFAULT_MODEL;
    const temp = typeof temperature === "number" ? Math.min(2, Math.max(0, temperature)) : 0.7;
    const prompt = typeof systemPrompt === "string" ? systemPrompt.slice(0, 4000) : "Sen Javy'san, foydalanuvchi qaysi tilda yozsa, shu tilda (ayniqsa o'zbek tilida) aniq va do'stona javob ber";
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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
        } catch { controller.enqueue(encoder.encode("\n\n[STREAM_ERROR]")); }
        finally { controller.close(); }
      }
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
  } catch (error: any) {
    const status = error?.status === 429 ? 429 : 500;
    return Response.json({ error: status === 429 ? "Groq limitiga yetdingiz. Birozdan so'ng qayta urinib ko'ring." : "Javob yaratishda xatolik yuz berdi. API kalitini tekshiring." }, { status });
  }
}