import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom";
}

function Tooltip({ content, children, position = "top" }: TooltipProps) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span
        className={cn(
          "absolute left-1/2 -translate-x-1/2 px-2 py-1",
          "bg-foreground text-background text-xs rounded whitespace-nowrap",
          "opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150",
          "z-10",
          position === "top" && "bottom-full mb-2",
          position === "bottom" && "top-full mt-2",
        )}
      >
        {content}
      </span>
    </span>
  );
}

export { Tooltip };
