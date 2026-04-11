"use client";

import { useEffect } from "react";
import { warmUpBackend } from "@/lib/api";

export function BackendWarmup() {
  useEffect(() => {
    warmUpBackend();
  }, []);
  return null;
}
