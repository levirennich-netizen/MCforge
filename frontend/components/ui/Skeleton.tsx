import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("shimmer-bg animate-shimmer rounded-lg", className)} />
  );
}

function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
}

function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonClip() {
  return (
    <div className="glass rounded-xl p-3 flex items-center gap-4">
      <Skeleton className="w-24 h-14 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonList, SkeletonClip };
