import Groq from "groq-sdk";
import { NextRequest } from "next/server";
export const runtime = "nodejs";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MODELS = new Set([DEFAULT_MODEL,"openai/gpt-oss-20b"]);
const hits = new Map<string,{count:number;reset:number}>();
function limited(key:string){const now=Date.now();const item=hits.get(key);if(!item||item.reset<now){hits.set(key,{count:1,reset:now+60000});return false;}item.count++;return item.count>20;}
export async function POST(req:NextRequest){
 const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
 if(limited(ip))return Response.json({error:"Juda ko'p so'rov yuborildi. Bir daqiqadan keyin urinib ko'ring."},{status:429});
 const apiKey=process.env.GROQ_API_KEY?.trim();
 if(!apiKey)return Response.json({error:"Vercel sozlamalarida GROQ_API_KEY topilmadi. Environment Variables bo'limiga kalitni kiriting va qayta deploy qiling."},{status:500});
 try{
  const body=await req.json();const {messages,model,temperature,systemPrompt}=body??{};
  if(!Array.isArray(messages)||messages.length<1||messages.length>50)return Response.json({error:"Xabarlar formati noto'g'ri."},{status:400});
  if(!messages.every((m:any)=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string"&&m.content.length<=20000))return Response.json({error:"Xabar matni noto'g'ri yoki juda uzun."},{status:400});
  const selected=typeof model==="string"&&MODELS.has(model)?model:DEFAULT_MODEL;
  const temp=typeof temperature==="number"?Math.min(2,Math.max(0,temperature)):0.7;
  const prompt=typeof systemPrompt==="string"?systemPrompt.slice(0,4000):"Sen Javy'san, foydalanuvchi qaysi tilda yozsa, shu tilda (ayniqsa o'zbek tilida) aniq va do'stona javob ber";
  const groq=new Groq({apiKey});
  const completion=await groq.chat.completions.create({model:selected,temperature:temp,stream:false,citation_options:"enabled",tool_choice:"auto",tools:[{type:"browser_search"}],messages:[{role:"system",content:prompt+"\n\nAgar savol eng soʻnggi, bugungi, joriy, yangiliklar, hozirgi narx yoki vaqtga bogʻliq faktlarni soʻrasa, browser_search orqali internetdan izla. Oddiy, vaqtga bogʻliq boʻlmagan savollarda internet qidiruvidan foydalanma. Internetdan foydalansang, javob oxirida ishlatilgan manbalarni aniq ko‘rsat."},...messages]} as any);
  const message:any=completion.choices?.[0]?.message??{};
  const content=typeof message.content==="string"?message.content:"Kechirasiz, javob tayyorlab bo‘lmadi.";
  const executed=Array.isArray(message.executed_tools)?message.executed_tools:Array.isArray((completion as any).executed_tools)?(completion as any).executed_tools:[];
  const found=new Map<string,{title:string;url:string}>();
  for(const tool of executed){
   const items=[...(Array.isArray(tool.browser_results)?tool.browser_results:[]),...(Array.isArray(tool.search_results?.results)?tool.search_results.results:[])];
   for(const item of items){if(typeof item?.url==="string"&&/^https?:\/\//i.test(item.url)){found.set(item.url,{title:typeof item.title==="string"&&item.title?item.title:new URL(item.url).hostname,url:item.url});}}
  }
  const sources=Array.from(found.values()).slice(0,8);
  return Response.json({content,sources},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch(error:any){
  console.error("Groq chat error:",{status:error?.status,code:error?.code,message:error?.message});
  const status=Number(error?.status)||500;let message="Groq serveriga ulanib bo'lmadi. Birozdan keyin qayta urinib ko'ring.";
  if(status===401)message="Groq API kaliti noto'g'ri yoki bekor qilingan. Groq Console'dan yangi kalit oling va Vercel'dagi GROQ_API_KEY qiymatini yangilang.";
  else if(status===403)message="Groq API ushbu kalit yoki model uchun ruxsat bermadi. Groq Console'dagi hisob va model ruxsatlarini tekshiring.";
  else if(status===404)message="Tanlangan AI modeli Groq'da topilmadi. Sozlamalardan boshqa modelni tanlang.";
  else if(status===429)message="Groq limitiga yetdingiz. Birozdan so'ng qayta urinib ko'ring.";
  else if(status===400)message="Groq so'rovni qabul qilmadi. Sozlamalardagi modelni almashtirib ko'ring.";
  return Response.json({error:message},{status:status>=400&&status<600?status:500});
 }
}