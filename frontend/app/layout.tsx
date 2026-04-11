import type { Metadata } from "next";
import localFont from "next/font/local";
import Image from "next/image";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { ToastContainer } from "@/components/ui/Toast";
import { BackendWarmup } from "@/components/layout/BackendWarmup";
import mcBg from "../public/mc-bg.jpg";

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
        {/* Minecraft background */}
        <Image
          src={mcBg}
          alt=""
          fill
          priority
          quality={60}
          placeholder="empty"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -2,
            objectFit: "cover",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
            background: "linear-gradient(to bottom, rgba(8,8,15,0.15) 0%, rgba(8,8,15,0.5) 100%)",
            pointerEvents: "none",
          }}
        />
        <BackendWarmup />
        <Header />
        <main className="flex-1 relative">{children}</main>
        <ToastContainer />
        {/* Corner icon */}
        <div
          style={{
            position: "fixed",
            bottom: "16px",
            left: "16px",
            zIndex: 9999,
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            backgroundColor: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="MCForge"
        >
          <svg width="20" height="20" viewBox="0 0 8 8">
            {/* Green background */}
            <rect x="0" y="0" width="8" height="8" fill="#4aba3b" />
            {/* Eyes - dark squares */}
            <rect x="1" y="1" width="2" height="2" fill="#1a1a1a" />
            <rect x="5" y="1" width="2" height="2" fill="#1a1a1a" />
            {/* Mouth - T-shape frown */}
            <rect x="3" y="3" width="2" height="1" fill="#1a1a1a" />
            <rect x="2" y="4" width="4" height="1" fill="#1a1a1a" />
            <rect x="2" y="5" width="1" height="2" fill="#1a1a1a" />
            <rect x="5" y="5" width="1" height="2" fill="#1a1a1a" />
          </svg>
        </div>
      </body>
    </html>
  );
}
