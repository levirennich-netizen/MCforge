import { create } from "zustand";
import type { ChatMessage } from "@/types/chat";

interface ChatStore {
  messages: ChatMessage[];
  isOpen: boolean;
  isStreaming: boolean;
  streamingContent: string;

  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  appendStreamToken: (token: string) => void;
  finalizeStream: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isOpen: false,
  isStreaming: false,
  streamingContent: "",

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  appendStreamToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),
  finalizeStream: (content) =>
    set((s) => ({
      streamingContent: "",
      isStreaming: false,
      messages: [
        ...s.messages,
        {
          id: `msg_${Date.now()}`,
          project_id: "",
          role: "assistant" as const,
          content,
          created_at: new Date().toISOString(),
        },
      ],
    })),
  setStreaming: (isStreaming) => set({ isStreaming, streamingContent: "" }),
  setOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  clearMessages: () => set({ messages: [], streamingContent: "" }),
}));
