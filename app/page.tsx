"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Menu, Moon, Plus, Send, Settings2, Sun, Square, Trash2, Pencil, X, Orbit, RefreshCw, Globe } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; sources?: { title: string; url: string; domain: string }[] };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
const DEFAULT_PROMPT = "Sen Javy'san, foydalanuvchi qaysi tilda yozsa, shu tilda (ayniqsa o'zbek tilida) aniq va do'stona javob ber";
const MODELS = ["openai/gpt-oss-120b","openai/gpt-oss-20b"];
const uid = () => Math.random().toString(36).slice(2, 10);
const suggestions = ["Next.js nima va u qanday ishlaydi?","Menga haftalik o'qish rejasini tuzib ber","Python'da oddiy kalkulyator yoz","Sun'iy intellektni sodda tushuntir"];

function cleanAssistantText(value: string) {
  return value.replace(/【\s*\d+†L\d+(?:-L?\d+)?】/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export default function Home() {
  const [chats,setChats] = useState<Chat[]>([]);
  const [activeId,setActiveId] = useState("");
  const [input,setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [theme,setTheme] = useState("system");
  const [dark,setDark] = useState(false);
  const [sidebar,setSidebar] = useState(false);
  const [settings,setSettings] = useState(false);
  const [model,setModel] = useState(MODELS[0]);
  const [prompt,setPrompt] = useState(DEFAULT_PROMPT);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const abortRef = useRef<AbortController|null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const active = chats.find(c=>c.id===activeId);
  const messages = active?.messages ?? [];

  useEffect(()=>{
    try {
      const saved = localStorage.getItem("javy-chats");
      const parsed: Chat[] = saved ? JSON.parse(saved) : [];
      setChats(parsed); if(parsed.length) setActiveId(parsed[0].id);
      const t = localStorage.getItem("javy-theme") || "system"; setTheme(t);
      setModel(MODELS.includes(localStorage.getItem("javy-model") || "") ? (localStorage.getItem("javy-model") as string) : MODELS[0]);
      setPrompt(localStorage.getItem("javy-prompt") || DEFAULT_PROMPT);
    } catch {}
  },[]);
  useEffect(()=>{ localStorage.setItem("javy-chats",JSON.stringify(chats)); },[chats]);
  useEffect(()=>{
    const apply=()=>setDark(theme==="dark" || (theme==="system" && window.matchMedia("(prefers-color-scheme: dark)").matches));
    apply(); const mq=window.matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change",apply); return ()=>mq.removeEventListener("change",apply);
  },[theme]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,busy]);

  function updateChat(id:string, fn:(c:Chat)=>Chat) { setChats(prev=>prev.map(c=>c.id===id?fn(c):c)); }
  function newChat() { const c={id:uid(),title:"Yangi chat",messages:[],updatedAt:Date.now()}; setChats(p=>[c,...p]);setActiveId(c.id);setInput("");setError("");setSidebar(false); }
  function removeChat(id:string) { const next=chats.filter(c=>c.id!==id);setChats(next);if(activeId===id)setActiveId(next[0]?.id||""); }
  function renameChat(c:Chat) { const title=window.prompt("Chat nomi",c.title);if(title?.trim())updateChat(c.id,x=>({...x,title:title.trim()})); }

  async function sendMessage(text=input, retry=false) {
    const value=text.trim(); if(!value || busy)return;
    let chat=active;
    if(!chat){chat={id:uid(),title:value.slice(0,42)+(value.length>42?"…":""),messages:[],updatedAt:Date.now()};setChats(p=>[chat!,...p]);setActiveId(chat.id);}
    const id=chat.id;
    const prior=retry?chat.messages.slice(0,-1):chat.messages;
    const next=retry?prior:[...prior,{role:"user" as const,content:value}];
    updateChat(id,c=>({...c,title:c.messages.length===0?value.slice(0,42)+(value.length>42?"…": ""):c.title,messages:[...next,{role:"assistant",content:""}],updatedAt:Date.now()}));
    setInput("");if(inputRef.current)inputRef.current.style.height="42px";setError("");setBusy(true);
    const controller=new AbortController();abortRef.current=controller;
    try {
      const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({messages:next,model,systemPrompt:prompt})});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||"Server bilan bog'lanib bo'lmadi.");}
      const data=await response.json();
      const answer=typeof data.content==="string"?data.content:"Javob olinmadi.";
      const sources=Array.isArray(data.sources)?data.sources:[];
      
      const searchWarning=data.searchFailed?"\n\n*Internet qidiruvi hozircha natija bermadi. Eng yangi ma'lumotlar tasdiqlanmagan bo'lishi mumkin.*":"";
      const fullAnswer=cleanAssistantText(answer)+searchWarning;
      updateChat(id,c=>({...c,messages:c.messages.map((m,i)=>i===c.messages.length-1?{...m,content:fullAnswer,sources:sources.filter((s:any)=>typeof s.url==="string"&&/^https?:\/\//i.test(s.url)).map((s:any)=>({title:s.title||s.domain||"Manba",url:s.url,domain:s.domain||new URL(s.url).hostname.replace(/^www\./,"")}))}:m),updatedAt:Date.now()}));
    } catch(e:any) { if(e.name!=="AbortError"){setError(e.message||"Tarmoq xatosi.");} }
    finally {setBusy(false);abortRef.current=null;}
  }
  function stop(){abortRef.current?.abort();setBusy(false);}
  function regenerate(){if(!active||busy||messages.length<2)return;const last=messages[messages.length-1];if(last.role==="assistant")sendMessage(messages[messages.length-2].content,true);}
  function copy(text:string){navigator.clipboard?.writeText(text);}
  function saveSettings(){localStorage.setItem("javy-model",model);localStorage.setItem("javy-prompt",prompt);setSettings(false);}

  return <main className={dark?"dark":""}>
    <div className="flex h-[100dvh] overflow-hidden bg-white text-slate-800 dark:bg-[#212121] dark:text-slate-100">
      {sidebar&&<button aria-label="Close menu" className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={()=>setSidebar(false)}/>}
      <aside className={`fixed md:relative z-30 flex h-full w-[280px] shrink-0 flex-col border-r border-slate-200 bg-[#f9f9f9] p-3 transition-transform dark:border-white/10 dark:bg-[#181818] ${sidebar?"translate-x-0":"-translate-x-full md:translate-x-0"}`}>
        <div className="mb-5 flex items-center justify-between px-2 pt-2"><div className="flex items-center gap-2 text-lg font-semibold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"><Orbit size={17}/></span>Javy</div><button onClick={()=>setSidebar(false)} className="rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-white/10 md:hidden"><X size={18}/></button></div>
        <button onClick={newChat} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:bg-[#222] dark:hover:bg-white/5"><Plus size={17}/> Yangi chat</button>
        <p className="mb-2 mt-7 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">So'nggi chatlar</p>
        <div className="flex-1 space-y-1 overflow-y-auto">{chats.map(c=><div key={c.id} className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm ${activeId===c.id?"bg-slate-200/70 dark:bg-white/10":"hover:bg-slate-200/60 dark:hover:bg-white/5"}`}><button onClick={()=>{setActiveId(c.id);setSidebar(false);}} className="min-w-0 flex-1 truncate text-left">{c.title}</button><button title="Nomini o'zgartirish" onClick={()=>renameChat(c)} className="hidden rounded p-1 text-slate-400 hover:text-current group-hover:block"><Pencil size={13}/></button><button title="O'chirish" onClick={()=>removeChat(c.id)} className="hidden rounded p-1 text-slate-400 hover:text-red-500 group-hover:block"><Trash2 size={13}/></button></div>)}</div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-white/10"><button onClick={()=>setSettings(true)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-200 dark:hover:bg-white/10"><Settings2 size={17}/> Sozlamalar</button><button title="Tema" onClick={()=>{const t=dark?"light":"dark";setTheme(t);localStorage.setItem("javy-theme",t);}} className="rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-white/10">{dark?<Sun size={17}/>:<Moon size={17}/>}</button></div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-white/10 md:border-0"><div className="flex items-center gap-2"><button onClick={()=>setSidebar(true)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10 md:hidden"><Menu size={20}/></button><span className="font-semibold">Javy</span></div><div className="flex items-center gap-2"><span className="hidden text-xs text-slate-400 sm:inline">{model}</span><button onClick={()=>setSettings(true)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10"><Settings2 size={18}/></button></div></header>
        <div className="flex-1 overflow-y-auto px-4 pb-5">
          {messages.length===0?<div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center pb-16 text-center"><div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"><Orbit size={27}/></div><h1 className="mb-2 text-3xl font-semibold tracking-tight">Bugun nimada yordam beray?</h1><p className="mb-9 text-sm text-slate-500 dark:text-slate-400">Men Javy — savollaringizga javob berishga tayyorman.</p><div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">{suggestions.map(s=><button key={s} onClick={()=>sendMessage(s)} className="rounded-2xl border border-slate-200 p-4 text-left text-sm transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">{s}<span className="mt-2 block text-xs text-slate-400">Taklif etilgan savol ↗</span></button>)}</div></div>
          :<div className="mx-auto max-w-3xl space-y-8 py-8">{messages.map((m,i)=><article key={i} className={`animate-fade-in flex gap-3 ${m.role==="user"?"flex-row-reverse":""}`}><div className={`min-w-0 ${m.role==="user"?"w-fit max-w-full rounded-2xl bg-slate-100 px-3 py-2 dark:bg-white/10":"w-full flex-1 pt-1"}`}><div className="prose prose-sm max-w-none break-words text-slate-800 dark:prose-invert dark:text-slate-100">{m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{a:({href,children})=>{let site="Sayt";let favicon="";try{const url=new URL(href||"");if(!["http:","https:"].includes(url.protocol))throw new Error("Invalid URL");site=url.hostname.replace(/^www\./i,"");favicon="https://www.google.com/s2/favicons?domain="+url.hostname+"&sz=64";}catch{return <span>{children}</span>;}return <a href={href} target="_blank" rel="noopener noreferrer" title={site} className="my-1 inline-flex max-w-full items-center gap-2 rounded-lg border border-blue-200/70 bg-blue-50 px-2.5 py-1.5 text-sm font-semibold !text-blue-700 !no-underline transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-500/10 dark:!text-blue-300 dark:hover:bg-blue-500/20"><span className="relative grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-md bg-white"><Globe size={14} className="absolute text-slate-400"/><img src={favicon} alt="" className="absolute h-5 w-5 bg-white object-contain" onError={e=>{e.currentTarget.style.display="none";}}/></span><span className="truncate">{site}</span><span className="text-[10px] opacity-60">↗</span></a>}}}>{cleanAssistantText(m.content)}</ReactMarkdown> : busy&&i===messages.length-1 ? <span className="typing-indicator" role="status" aria-label="Javy yozmoqda"><i/><i/><i/></span> : null}{m.role==="assistant"&&!!m.sources?.length&&<section className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Globe size={14}/> Foydalanilgan manbalar <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{m.sources.length}</span></div><div className="grid gap-2 sm:grid-cols-2">{m.sources.map((source,j)=>{let host=source.domain;try{host=new URL(source.url).hostname.replace(/^www\./i,"");}catch{}return <a key={source.url+j} href={source.url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50/70 dark:border-white/10 dark:bg-white/[.03] dark:hover:border-blue-400/40 dark:hover:bg-blue-500/[.08]"><span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10"><Globe size={16} className="absolute text-slate-400"/><img src={"https://www.google.com/s2/favicons?domain="+host+"&sz=64"} alt="" className="absolute h-5 w-5 bg-white object-contain" onError={e=>{e.currentTarget.style.display="none";}}/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">{source.title}</span><span className="mt-0.5 block truncate text-xs text-slate-400">{host}</span></span><span className="text-xs text-blue-600 dark:text-blue-400">↗</span></a>})}</div></section>}{busy&&i===messages.length-1&&m.content&&<span className="typing-cursor" aria-hidden="true"/>}</div>{m.role==="assistant"&&m.content&&<div className="mt-2 flex gap-1"><button onClick={()=>copy(m.content)} title="Nusxa olish" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-current dark:hover:bg-white/10"><Copy size={14}/></button>{i===messages.length-1&&!busy&&<button onClick={regenerate} title="Qayta yaratish" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-current dark:hover:bg-white/10"><RefreshCw size={14}/></button>}</div>}</div></article>)}<div ref={bottomRef}/></div>}
          {error&&<div className="mx-auto mb-3 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        </div>
        <div className="px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2"><div className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-slate-300 dark:border-white/15 dark:bg-[#2b2b2b] dark:focus-within:border-white/30"><textarea ref={inputRef} value={input} onChange={e=>{setInput(e.target.value);e.currentTarget.style.height="auto";e.currentTarget.style.height=Math.min(e.currentTarget.scrollHeight,180)+"px";}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Javy'ga xabar yuboring..." rows={1} className="chat-input min-h-[42px] max-h-[180px] min-w-0 flex-1 overflow-y-auto resize-none self-center bg-transparent px-3 py-2 text-sm leading-6 placeholder:text-slate-400"/><button aria-label={busy?"To'xtatish":"Yuborish"} disabled={!busy&&!input.trim()} onClick={()=>busy?stop():sendMessage()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">{busy?<Square size={15} fill="currentColor"/>:<Send size={16}/>}</button></div><p className="mt-2 text-center text-[10px] text-slate-400">Javy xato qilishi mumkin. Muhim ma'lumotlarni tekshirib oling.</p></div>
      </section>
    </div>
    {settings&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setSettings(false);}}><div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="settings-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#202127]"><div className="mb-5 flex items-center justify-between"><h2 id="settings-title" className="text-lg font-semibold">Sozlamalar</h2><button onClick={()=>setSettings(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-white/10"><X size={19}/></button></div><label className="mb-2 block text-sm font-medium">AI modeli</label><select value={model} onChange={e=>setModel(e.target.value)} className="settings-control mb-5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#292c34]">{MODELS.map(m=><option key={m} value={m}>{m}</option>)}</select><label className="mb-2 block text-sm font-medium">System prompt</label><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={4} className="settings-control mb-5 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-[#292c34]"/><div className="mb-5 flex items-center justify-between"><span className="text-sm font-medium">Ko'rinish</span><select value={theme} onChange={e=>{setTheme(e.target.value);localStorage.setItem("javy-theme",e.target.value);}} className="settings-control rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#292c34]"><option value="system">Tizim</option><option value="light">Yorug'</option><option value="dark">Qorong'i</option></select></div><button onClick={saveSettings} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">Saqlash</button></div></div>}
  </main>;
}
