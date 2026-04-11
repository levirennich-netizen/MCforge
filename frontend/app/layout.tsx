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
      </body>
    </html>
  );
}
