import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeStyles = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
};

function PageContainer({ children, size = "lg" }: PageContainerProps) {
  return (
    <div className={cn("mx-auto px-6 py-8 animate-fade-in", sizeStyles[size])}>
      {children}
    </div>
  );
}

export { PageContainer };
