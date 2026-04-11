"use client";

import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { key: string; label: string }[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

function Tabs({ tabs, activeKey, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1 bg-white/[0.02] border border-white/[0.04] rounded-xl p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            activeKey === tab.key
              ? "bg-emerald-500/15 text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.2)]"
              : "text-muted hover:text-foreground hover:bg-white/[0.04]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export { Tabs };
