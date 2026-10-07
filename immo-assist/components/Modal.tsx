"use client";

import { useState, ReactNode } from "react";
import { X } from "lucide-react";

export default function Modal({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-pop my-auto">
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <h3 className="font-bold">{title}</h3>
              <button onClick={close} className="text-gray-400 hover:text-ink" aria-label="Fermer"><X size={18} /></button>
            </div>
            <div className="p-5">{typeof children === "function" ? children(close) : children}</div>
          </div>
        </div>
      )}
    </>
  );
}
