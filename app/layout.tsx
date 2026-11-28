import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AuthProvider } from "../components/auth-provider";
export const metadata:Metadata={title:"Javy — AI yordamchi",description:"Javy — tezkor va qulay sun'iy intellekt yordamchisi.",applicationName:"Javy",appleWebApp:{capable:true,statusBarStyle:"default",title:"Javy"},formatDetection:{telephone:false}};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:[{media:"(prefers-color-scheme: light)",color:"#f7f8fa"},{media:"(prefers-color-scheme: dark)",color:"#101114"}]};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="uz" suppressHydrationWarning><body><AuthProvider>{children}</AuthProvider></body></html>;}
