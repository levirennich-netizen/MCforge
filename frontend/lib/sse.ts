"use client";

import { useEffect, useRef } from "react";
import { streamProgress } from "./api";
import { useProjectStore } from "@/stores/project-store";

export function useJobProgress(projectId: string | null) {
  const updateJob = useProjectStore((s) => s.updateJob);
  const removeJob = useProjectStore((s) => s.removeJob);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const connect = () => {
      esRef.current?.close();
      esRef.current = streamProgress(projectId, (event) => {
        updateJob(event.job_id, {
          status: event.status,
          progress: event.progress,
          message: event.message,
          stage: event.stage,
        });

        // Auto-remove completed/failed jobs after 4 seconds
        if (event.status === "completed" || event.status === "failed") {
          setTimeout(() => removeJob(event.job_id), 4000);
        }
      });

      // Reconnect on error (backend cold start / network blip)
      esRef.current.onerror = () => {
        esRef.current?.close();
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [projectId, updateJob, removeJob]);
}
