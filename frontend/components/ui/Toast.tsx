"use client";

import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

const icons: Record<string, React.ReactNode> = {
  success: (
    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ),
  error: (
    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
      <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  ),
  info: (
    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
      <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  ),
};

const accentColors: Record<string, string> = {
  success: "border-l-emerald-500/50",
  error: "border-l-red-500/50",
  info: "border-l-blue-500/50",
};

function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto animate-toast-in",
            "flex items-center gap-3 px-4 py-3.5 rounded-xl",
            "glass border-l-[3px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "min-w-[300px] max-w-[420px]",
            accentColors[t.type],
          )}
        >
          {icons[t.type]}
          <p className="text-sm flex-1 leading-snug">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="text-muted/50 hover:text-foreground transition shrink-0 ml-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export { ToastContainer };
