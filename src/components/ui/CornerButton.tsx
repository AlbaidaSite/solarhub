"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type CornerButtonProps = {
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const CornerButton = forwardRef<HTMLButtonElement, CornerButtonProps>(
  function CornerButton({ children, className = "", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={`
          group relative inline-flex items-center justify-center
          px-8 py-3 bg-transparent
          transition-transform duration-300 ease-out
          hover:scale-[1.05]
          focus:outline-none focus-visible:scale-[1.05]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
          ${className}
        `}
        {...props}
      >
        {/* Top-right corner */}
        <span
          aria-hidden
          className="
            pointer-events-none absolute top-0 right-0
            w-5 h-5
            border-t-5 border-r-5 border-white
            transition-all duration-300 ease-out
            group-hover:w-12 group-hover:h-7
            group-focus-visible:w-7 group-focus-visible:h-7
            filter-[drop-shadow(0_0_2px_#000)_drop-shadow(0_0_2px_#000)]
          "
        />

        {/* Bottom-left corner */}
        <span
          aria-hidden
          className="
            pointer-events-none absolute bottom-0 left-0
            w-5 h-5
            border-b-5 border-l-5 border-white
            transition-all duration-300 ease-out
            group-hover:w-12 group-hover:h-7
            group-focus-visible:w-7 group-focus-visible:h-7
            filter-[drop-shadow(0_0_2px_#000)_drop-shadow(0_0_2px_#000)]
          "
        />

        {/* Text with black outline */}
        <span
          className="
            relative text-2xl md:text-3xl font-bold text-white
            [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000,_0_0_8px_rgba(0,0,0,0.6)]
          "
        >
          {children}
        </span>
      </button>
    );
  }
);

export default CornerButton;