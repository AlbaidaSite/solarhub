"use client";

import { forwardRef, useId } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

type CommonProps = {
  label?: string;
  icon?: ReactNode;
  error?: string;
  containerClassName?: string;
};

type InputProps = CommonProps &
  InputHTMLAttributes<HTMLInputElement> & {
    as?: "input";
  };

type SelectProps = CommonProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    as: "select";
    children: ReactNode;
  };

type AuroraFieldProps = InputProps | SelectProps;

/**
 * Reusable text-style input/select with a glowing underline.
 * - Transparent background, large bold text
 * - Underline fades to transparent at both ends
 * - Underline turns amber on focus
 * - Optional right-side icon (auto-injected for select)
 */
const AuroraField = forwardRef<
  HTMLInputElement | HTMLSelectElement,
  AuroraFieldProps
>(function AuroraField(props, ref) {
  const {
    label,
    icon,
    error,
    containerClassName = "",
    id,
    className = "",
    as = "input",
  } = props;

  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  // For selects, default the icon to a chevron unless one is passed explicitly
  const resolvedIcon =
    as === "select" ? icon ?? <ChevronDown size={20} strokeWidth={2.5} /> : icon;

  const sharedFieldClasses = `
    peer flex-1 bg-transparent outline-none border-none appearance-none
    text-base md:text-xl font-semibold text-white
    placeholder:text-white/90 placeholder:font-semibold
    py-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${className}
  `;

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block mb-1 text-sm font-medium text-zinc-400"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <div className="flex items-center gap-3">
          {as === "select" ? (
            <select
              ref={ref as React.Ref<HTMLSelectElement>}
              id={fieldId}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className={`${sharedFieldClasses} pr-1 cursor-pointer [&>option]:bg-zinc-900 [&>option]:text-white`}
              {...(props as SelectHTMLAttributes<HTMLSelectElement>)}
            >
              {(props as SelectProps).children}
            </select>
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              id={fieldId}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className={sharedFieldClasses}
              {...(props as InputHTMLAttributes<HTMLInputElement>)}
            />
          )}

          {resolvedIcon && (
            <span className="shrink-0 text-white peer-focus:text-amber-300 transition-colors duration-200">
              {resolvedIcon}
            </span>
          )}
        </div>

        {/* Underline: thin on left, thick on right (right-triangle wedge) */}
        <div
        aria-hidden
        className="
            absolute left-0 right-0 bottom-0 h-1.5
            bg-white peer-focus:bg-amber-300
            [clip-path:polygon(0_0,100%_100%,100%_0%)]
            transition-colors duration-200
        "
        />
      </div>

      {error && (
        <p id={errorId} className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export default AuroraField;