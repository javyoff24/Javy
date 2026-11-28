"use client";

import { useEffect, useState } from "react";
import { SessionProvider, signIn, useSession } from "next-auth/react";

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.91c-.58 2.96-2.26 5.48-4.73 7.17l7.64 5.92c4.46-4.12 7.16-10.2 7.16-17.56Z"/><path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.94 23.94 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 5)"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.89l-7.64-5.92c-2.12 1.42-4.84 2.26-8.26 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>;
}

function BrandMark() {
  return <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2.8 14.4 9.6 21.2 12 14.4 14.4 12 21.2 9.6 14.4 2.8 12 9.6 9.6 12 2.8Z"/><circle cx="18.5" cy="5.5" r="1.4" fill="currentColor" stroke="none"/></svg></div>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestInput, setGuestInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("javy-guest-name") || "";
    setGuestName(saved);
    setGuestInput(saved);
  }, []);

  if (status === "loading") return <main className="grid min-h-[100dvh] place-items-center bg-[#090b12] text-white"><div className="flex items-center gap-3 text-sm text-white/70"><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"/>Javy tayyorlanmoqda...</div></main>;

  if (!session?.user && !guestName) return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#090b12] px-5 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_10%,rgba(59,130,246,.22),transparent_38%),radial-gradient(ellipse_at_85%_85%,rgba(139,92,246,.2),transparent_40%)]"/>
      <div className="pointer-events-none absolute inset-0 opacity-[.1] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:44px_44px]"/>
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-[#111521]/90 shadow-[0_32px_120px_rgba(0,0,0,.5)] backdrop-blur-2xl md:min-h-[550px] md:grid-cols-2">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-10 md:flex lg:p-14">
          <div className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-[90px]"/>
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-violet-500/20 blur-[90px]"/>
          <div className="relative flex items-center gap-3"><BrandMark/><div><p className="text-lg font-bold">Javy</p><p className="text-[10px] tracking-[.22em] text-white/40">PERSONAL AI</p></div></div>
          <div className="relative max-w-md py-12">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-xs text-blue-200"><span className="h-1.5 w-1.5 rounded-full bg-blue-300"/>Fikringizga hamroh AI</p>
            <h1 className="text-5xl font-semibold leading-[1.12] tracking-[-.045em] lg:text-[58px]">G‘oyangizni <span className="bg-gradient-to-r from-blue-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent">amalga</span> oshiring.</h1>
            <p className="mt-6 max-w-sm text-[15px] leading-7 text-slate-400">Savollar bering, o‘rganing, yozing va yangi imkoniyatlarni kashf eting. Hammasi bitta joyda.</p>
          </div>
          <p className="relative text-xs text-white/35">Oddiy suhbatdan katta g‘oyalargacha.</p>
        </section>
        <section className="flex flex-col justify-center px-6 py-12 sm:px-12 md:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9 flex items-center gap-3 md:hidden"><BrandMark/><div><p className="text-lg font-bold">Javy</p><p className="text-[10px] tracking-[.2em] text-white/40">PERSONAL AI</p></div></div>
            <p className="mb-3 text-xs font-semibold tracking-[.2em] text-blue-300/80">JAVY AI HISOBI</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-[34px]">Xush kelibsiz</h2>
            <p className="mt-3 mb-8 text-sm leading-6 text-slate-400">Davom etish uchun Google hisobingiz orqali xavfsiz kiring.</p>
            <button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await signIn("google",{redirectTo:"/"});}catch{setBusy(false);setError("Kirishni boshlashda xatolik yuz berdi. Qayta urinib ko‘ring.");}}} className="flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-lg shadow-white/5 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-0 disabled:cursor-wait disabled:opacity-65">
              {busy?<span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"/>:<GoogleMark/>}{busy?"Google’ga ulanmoqda...":"Google bilan davom etish"}
            </button>
            {error&&<p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
            <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-white/10"/><span className="text-[10px] font-medium uppercase tracking-[.16em] text-white/30">yoki</span><span className="h-px flex-1 bg-white/10"/></div>
            <div className="space-y-3">
              <label htmlFor="javy-guest-name" className="block text-sm font-medium text-slate-200">Mehmon sifatida davom etish</label>
              <input id="javy-guest-name" value={guestInput} onChange={event=>setGuestInput(event.target.value)} maxLength={40} placeholder="Ismingizni kiriting" className="min-h-[50px] w-full rounded-2xl border border-white/10 bg-white/[.06] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/15"/>
              <button type="button" disabled={guestInput.trim().length<2} onClick={()=>{const name=guestInput.trim().slice(0,40);localStorage.setItem("javy-guest-name",name);setGuestName(name);}} className="min-h-[50px] w-full rounded-2xl border border-white/10 bg-white/[.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[.13] disabled:cursor-not-allowed disabled:opacity-40">Mehmon bo‘lib kirish</button>
            </div>
            <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-white/10"/><span className="text-[10px] font-medium uppercase tracking-[.16em] text-white/30">Xavfsiz kirish</span><span className="h-px flex-1 bg-white/10"/></div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/[.07] bg-white/[.035] p-4"><svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 19 6v5c0 4.5-2.9 7.8-7 10-4.1-2.2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg><p className="text-xs leading-5 text-slate-400">Google orqali kirish himoyalangan. Parolingiz Javy’da saqlanmaydi.</p></div>
            <p className="mt-8 text-center text-[11px] leading-5 text-white/30">Davom etish orqali xizmatdan foydalanish shartlariga rozilik bildirasiz.</p>
          </div>
        </section>
      </div>
    </main>
  );

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider><AuthGate>{children}</AuthGate></SessionProvider>;
}
