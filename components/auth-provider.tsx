"use client";

import { useState } from "react";
import { SessionProvider, signIn, useSession } from "next-auth/react";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.91c-.58 2.96-2.26 5.48-4.73 7.17l7.64 5.92c4.46-4.12 7.16-10.2 7.16-17.56Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.94 23.94 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 5)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.89l-7.64-5.92c-2.12 1.42-4.84 2.26-8.26 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);

  if (status === "loading") {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#f7f8fa] text-slate-700 dark:bg-[#101114] dark:text-slate-200">
        <div className="flex items-center gap-3 text-sm"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />Javy yuklanmoqda...</div>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#f7f8fa] px-5 py-10 text-slate-900 dark:bg-[#101114] dark:text-white">
        <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl" />
        <section className="relative w-full max-w-md rounded-[28px] border border-slate-200/80 bg-white/90 p-8 text-center shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-[#1b1d23]/90 dark:shadow-black/20">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2.8 14.4 9.6 21.2 12 14.4 14.4 12 21.2 9.6 14.4 2.8 12 9.6 9.6 12 2.8Z"/><circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" stroke="none"/></svg>
          </div>
          <p className="mb-2 text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">JAVY AI</p>
          <h1 className="text-3xl font-bold tracking-tight">Xush kelibsiz!</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">Javy’dan foydalanishni davom ettirish uchun Google hisobingiz orqali kiring.</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signIn("google", { redirectTo: "/" });
              } catch {
                setBusy(false);
              }
            }}
            className="mt-8 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-white/15 dark:bg-white dark:text-slate-800 dark:hover:bg-slate-100"
          >
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" /> : <GoogleMark />}
            {busy ? "Google’ga ulanmoqda..." : "Google orqali kirish"}
          </button>
          <p className="mt-6 text-xs leading-5 text-slate-400">Kirish orqali Javy xizmatidan foydalanish shartlariga rozilik bildirasiz.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthGate>{children}</AuthGate>
    </SessionProvider>
  );
}
