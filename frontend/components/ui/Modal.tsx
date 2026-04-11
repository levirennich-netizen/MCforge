"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-overlay-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
          "w-full max-w-md glass rounded-2xl p-6",
          "animate-fade-in-scale shadow-[0_24px_64px_rgba(0,0,0,0.5)]",
          "border-white/[0.08]",
          className,
        )}
      >
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        {description && <p className="text-sm text-muted mb-4 leading-relaxed">{description}</p>}
        {children}
        {footer && <div className="flex items-center justify-end gap-2 mt-6">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

export { Modal };
