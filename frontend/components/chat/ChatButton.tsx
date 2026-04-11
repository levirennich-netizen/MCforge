"use client";

import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";

export function ChatButton() {
  const { isOpen, isStreaming, toggleOpen } = useChatStore();

  return (
    <button
      onClick={toggleOpen}
      className={cn(
        "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full",
        "bg-gradient-to-b from-emerald-500 to-emerald-600",
        "shadow-[0_2px_8px_rgba(0,0,0,0.3),0_0_16px_rgba(16,185,129,0.2)]",
        "hover:from-emerald-400 hover:to-emerald-500",
        "transition-all duration-200 hover:scale-105 active:scale-95",
        "flex items-center justify-center",
        isStreaming && "animate-glow-pulse",
      )}
    >
      {isOpen ? (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )}
    </button>
  );
}
