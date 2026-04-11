"use client";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { ChatButton } from "@/components/chat/ChatButton";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatPanel />
      <ChatButton />
    </>
  );
}
