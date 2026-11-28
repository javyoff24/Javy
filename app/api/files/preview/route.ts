import { NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = typeof body?.data === "string" ? body.data : "";
    const match = data.match(/^data:([^;,]+);base64,([\s\S]+)$/);
    if (!match || !/\.docx$/i.test(String(body?.name || ""))) {
      return NextResponse.json({ error: "Yaroqli DOCX hujjat yuboring." }, { status: 400 });
    }
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 2_500_000) return NextResponse.json({ error: "Hujjat hajmi 2.5 MB dan oshmasin." }, { status: 413 });
    const result = await mammoth.extractRawText({ buffer });
    return NextResponse.json({ text: result.value || "" });
  } catch {
    return NextResponse.json({ error: "DOCX hujjatini ochib bo‘lmadi." }, { status: 422 });
  }
}
