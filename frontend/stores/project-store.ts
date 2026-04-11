"use client";

import { create } from "zustand";
import type { Project, ClipMetadata } from "@/types/project";
import type { AnalysisResult } from "@/types/analysis";
import type { EditPlan } from "@/types/timeline";

interface ProjectStore {
  // Current project
  project: Project | null;
  clips: ClipMetadata[];
  analyses: AnalysisResult[];
  editPlan: EditPlan | null;

  // Jobs
  activeJobs: Record<string, { status: string; progress: number; message: string; stage: string }>;

  // Actions
  setProject: (project: Project | null) => void;
  setClips: (clips: ClipMetadata[]) => void;
  addClip: (clip: ClipMetadata) => void;
  removeClip: (clipId: string) => void;
  setAnalyses: (analyses: AnalysisResult[]) => void;
  setEditPlan: (plan: EditPlan | null) => void;
  updateJob: (jobId: string, data: { status: string; progress: number; message: string; stage: string }) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  clips: [],
  analyses: [],
  editPlan: null,
  activeJobs: {},

  setProject: (project) => set({ project }),
  setClips: (clips) => set({ clips }),
  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
  removeClip: (clipId) => set((s) => ({ clips: s.clips.filter((c) => c.id !== clipId) })),
  setAnalyses: (analyses) => set({ analyses }),
  setEditPlan: (editPlan) => set({ editPlan }),
  updateJob: (jobId, data) =>
    set((s) => ({ activeJobs: { ...s.activeJobs, [jobId]: data } })),
  removeJob: (jobId) =>
    set((s) => {
      const { [jobId]: _, ...rest } = s.activeJobs;
      return { activeJobs: rest };
    }),
  clearJobs: () => set({ activeJobs: {} }),
}));
