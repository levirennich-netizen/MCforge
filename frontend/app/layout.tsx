import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { ToastContainer } from "@/components/ui/Toast";
import { BackendWarmup } from "@/components/layout/BackendWarmup";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MCForge - AI Minecraft Video Editor",
  description: "AI-powered video editing for Minecraft YouTubers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} font-sans antialiased bg-[#08080f] text-[#e8e8f0] min-h-screen`}>
        <BackendWarmup />
        <Header />
        <main className="flex-1 relative">{children}</main>
        <ToastContainer />
        {/* Corner icon */}
        <div className="fixed bottom-4 left-4 z-50 w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity select-none"
             title="MCForge">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="#10b981">
            <rect x="2" y="2" width="5" height="5" />
            <rect x="9" y="2" width="5" height="5" />
            <rect x="5" y="7" width="6" height="2" />
            <rect x="3" y="9" width="4" height="5" />
            <rect x="9" y="9" width="4" height="5" />
          </svg>
        </div>
      </body>
    </html>
  );
}
