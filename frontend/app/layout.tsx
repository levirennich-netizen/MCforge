import type { Metadata } from "next";
import localFont from "next/font/local";
import Image from "next/image";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { ToastContainer } from "@/components/ui/Toast";
import { BackendWarmup } from "@/components/layout/BackendWarmup";
import { CreeperButton } from "@/components/layout/CreeperButton";
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
          quality={75}
          placeholder="empty"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -2,
            objectFit: "cover",
            opacity: 0.55,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
            background: "linear-gradient(to bottom, rgba(8,8,15,0) 0%, rgba(4,20,12,0.4) 50%, rgba(8,8,15,0.7) 100%)",
            pointerEvents: "none",
          }}
        />
        <BackendWarmup />
        <Header />
        <main className="flex-1 relative">{children}</main>
        <ToastContainer />
        <CreeperButton />
      </body>
    </html>
  );
}
