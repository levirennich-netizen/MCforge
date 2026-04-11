"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[rgba(8,8,15,0.8)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* Logo icon with glow */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(16,185,129,0.2)] transition-all duration-300">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-gradient">MC</span>
              <span className="text-foreground">Forge</span>
            </h1>
          </Link>
          <Badge variant="muted">AI Video Editor</Badge>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition-colors duration-200"
          >
            Dashboard
          </Link>
        </nav>
      </div>
      {/* Subtle gradient line under header */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
    </header>
  );
}

export { Header };
