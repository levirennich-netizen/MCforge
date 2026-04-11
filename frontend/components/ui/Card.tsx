import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  glow?: boolean;
}

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

function Card({ className, hover, glow, padding = "md", children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "glass rounded-xl transition-all duration-300",
        hover && "cursor-pointer hover:border-accent/30 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(16,185,129,0.08)]",
        glow && "border-accent/30 shadow-glow animate-glow-pulse",
        paddingStyles[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Card };
