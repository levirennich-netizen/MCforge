"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
}

function PageHeader({ title, subtitle, actions, backHref }: PageHeaderProps) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        {backHref && (
          <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
        )}
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageHeader };
