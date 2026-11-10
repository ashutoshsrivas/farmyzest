"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

// Animated accordion. Height animates via the grid-template-rows 0fr→1fr
// trick (smoothly animatable, unlike auto height) plus a fade + slight slide
// on the body, and the chevron rotates. No JS height measurement needed.
export function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-nate-grey-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-sm font-medium text-nate-grey-800 group-hover:text-nate-grey-900 transition-colors">
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-nate-grey-500 transition-transform duration-300 ease-out ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Animated collapse region */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`pb-4 text-sm text-nate-grey-600 leading-relaxed transition-transform duration-300 ease-out ${
              open ? "translate-y-0" : "-translate-y-1"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
