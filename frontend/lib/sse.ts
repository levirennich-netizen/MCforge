"use client";

import { useEffect, useRef } from "react";
import { streamProgress } from "./api";
import { useProjectStore } from "@/stores/project-store";

export function useJobProgress(projectId: string | null) {
  const updateJob = useProjectStore((s) => s.updateJob);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId) return;

    esRef.current = streamProgress(projectId, (event) => {
      updateJob(event.job_id, {
        status: event.status,
        progress: event.progress,
        message: event.message,
        stage: event.stage,
      });
    });

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [projectId, updateJob]);
}
