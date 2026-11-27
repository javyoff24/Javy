import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Javy — AI assistant", description: "Javy, your friendly AI assistant." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz" suppressHydrationWarning><body>{children}</body></html>;
}