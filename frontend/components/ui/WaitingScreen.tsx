"use client";

import { useEffect, useState } from "react";
import { MineRunner } from "./MineRunner";

interface WaitingScreenProps {
  /** When the job started (Date.now() timestamp) */
  startedAt?: number;
  /** Timeout in ms before showing warning (default: 5 min) */
  timeoutMs?: number;
  /** Called when user dismisses the waiting screen */
  onDismiss?: () => void;
}

export function WaitingScreen({ startedAt, timeoutMs = 5 * 60 * 1000, onDismiss }: WaitingScreenProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!startedAt) return;
    const elapsed = Date.now() - startedAt;
    const remaining = timeoutMs - elapsed;
    if (remaining <= 0) {
      setTimedOut(true);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), remaining);
    return () => clearTimeout(timer);
  }, [startedAt, timeoutMs]);

  return (
    <div className="mb-8 space-y-4">
      {timedOut ? (
        <div className="text-center space-y-3 py-4">
          <p className="text-sm font-medium text-yellow-400">
            This is taking longer than expected — something may have gone wrong.
          </p>
          <p className="text-xs text-muted/60">
            The backend may have crashed or timed out. Try refreshing the page.
          </p>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-foreground/80 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      ) : (
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-sm font-medium text-foreground/80">
              This may take a few minutes — please try our MineRunner while you wait!
            </p>
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-xs text-muted/60">
            Use WASD to move, click to mine, type /help for commands
          </p>
        </div>
      )}
      <MineRunner />
    </div>
  );
}
