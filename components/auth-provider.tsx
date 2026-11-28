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
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />
      <div className="auth-layout">
        <section className="auth-brand-panel">
          <div className="auth-brand">
            <BrandMark />
            <div><p className="auth-brand-name">Javy</p><p className="auth-eyebrow">PERSONAL AI</p></div>
          </div>
          <div className="auth-brand-copy">
            <p className="auth-kicker">✦ Fikringizga hamroh AI</p>
            <h1>G‘oyangizni <span>amalga</span> oshiring.</h1>
            <p className="auth-description">Savollar bering, o‘rganing, yozing va yangi imkoniyatlarni kashf eting. Hammasi bitta joyda.</p>
          </div>
          <p className="auth-brand-foot">Oddiy suhbatdan katta g‘oyalargacha.</p>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form">
            <div className="auth-brand auth-mobile-brand">
              <BrandMark />
              <div><p className="auth-brand-name">Javy</p><p className="auth-eyebrow">PERSONAL AI</p></div>
            </div>
            <p className="auth-eyebrow auth-section-label">JAVY AI HISOBI</p>
            <h2>Xush kelibsiz</h2>
            <p className="auth-description auth-intro">Davom etish uchun Google hisobingiz orqali xavfsiz kiring.</p>

            <button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await signIn("google",{redirectTo:"/"});}catch{setBusy(false);setError("Kirishni boshlashda xatolik yuz berdi. Qayta urinib ko‘ring.");}}} className="auth-google-button">
              {busy?<span className="auth-spinner"/>:<GoogleMark/>}{busy?"Google’ga ulanmoqda...":"Google bilan davom etish"}
            </button>
            {error&&<p role="alert" className="auth-error">{error}</p>}

            <div className="auth-divider"><span/><span>YOKI</span><span/></div>

            <div className="auth-guest">
              <label htmlFor="javy-guest-name">Mehmon sifatida davom etish</label>
              <input id="javy-guest-name" value={guestInput} onChange={event=>setGuestInput(event.target.value)} maxLength={40} placeholder="Ismingizni kiriting" />
              <button type="button" disabled={guestInput.trim().length<2} onClick={()=>{const name=guestInput.trim().slice(0,40);localStorage.setItem("javy-guest-name",name);setGuestName(name);}} className="auth-guest-button">Mehmon bo‘lib kirish</button>
            </div>

            <div className="auth-divider auth-safe-divider"><span/><span>XAVFSIZ KIRISH</span><span/></div>
            <div className="auth-security">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 19 6v5c0 4.5-2.9 7.8-7 10-4.1-2.2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>
              <p>Google orqali kirish himoyalangan. Parolingiz Javy’da saqlanmaydi.</p>
            </div>
            <p className="auth-terms">Davom etish orqali xizmatdan foydalanish shartlariga rozilik bildirasiz.</p>
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
