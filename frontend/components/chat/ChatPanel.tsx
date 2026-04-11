"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useChatStore } from "@/stores/chat-store";
import { getChatMessages, clearChat, streamChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

function ChatBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-emerald-500/15 border border-emerald-500/20 text-foreground/90"
            : "bg-white/[0.04] border border-white/[0.06] text-foreground/80",
        )}
      >
        {content}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const params = useParams();
  const projectId = params.projectId as string;

  const {
    messages, isOpen, isStreaming, streamingContent,
    setMessages, addMessage, appendStreamToken, finalizeStream,
    setStreaming, clearMessages,
  } = useChatStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Load history on open
  useEffect(() => {
    if (isOpen && !loaded && projectId) {
      getChatMessages(projectId)
        .then((msgs) => {
          setMessages(msgs);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [isOpen, loaded, projectId, setMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    addMessage({
      id: `msg_${Date.now()}`,
      project_id: projectId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    });
    setStreaming(true);

    try {
      await streamChatMessage(
        projectId,
        text,
        (token) => appendStreamToken(token),
        (content) => finalizeStream(content),
        (error) => {
          finalizeStream(`Error: ${error}`);
        },
      );
    } catch {
      finalizeStream("Error: Failed to connect to AI");
    }
  };

  const handleClear = async () => {
    try {
      await clearChat(projectId);
      clearMessages();
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed top-0 right-0 z-40 h-full w-[420px] max-w-[90vw]",
        "glass border-l border-white/[0.06]",
        "flex flex-col",
        "animate-slide-in-right",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h3 className="font-semibold text-sm text-foreground/90">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClear}
            className="text-xs text-muted/60 hover:text-foreground/70 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition"
          >
            Clear
          </button>
          <button
            onClick={() => useChatStore.getState().setOpen(false)}
            className="text-muted/50 hover:text-foreground/70 p-1.5 rounded-lg hover:bg-white/[0.04] transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground/70 mb-1">AI Assistant</p>
            <p className="text-xs text-muted/50 max-w-[240px]">
              Ask about your clips, get editing suggestions, or discuss creative direction.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-white/[0.04] border border-white/[0.06] text-foreground/80">
              {streamingContent || (
                <span className="inline-flex gap-1 text-muted/50">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI anything..."
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-xl px-4 py-2.5 text-sm",
              "bg-white/[0.03] border border-white/[0.06]",
              "text-foreground/90 placeholder:text-muted/40",
              "focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/30",
              "transition",
            )}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={cn(
              "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition",
              input.trim() && !isStreaming
                ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500"
                : "bg-white/[0.04] text-muted/30 cursor-not-allowed",
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
