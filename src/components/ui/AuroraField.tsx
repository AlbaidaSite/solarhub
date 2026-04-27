"use client";

import { forwardRef, useId, useRef } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

type FieldSize = "sm" | "md";
type IconPosition = "left" | "right";

type CommonProps = {
  label?: string;
  icon?: ReactNode;
  iconPosition?: IconPosition;
  error?: string;
  containerClassName?: string;
  size?: FieldSize;
};

type InputProps = Omit<CommonProps & InputHTMLAttributes<HTMLInputElement>, "size"> &
  CommonProps & {
    as?: "input";
  };

type SelectProps = Omit<CommonProps & SelectHTMLAttributes<HTMLSelectElement>, "size"> &
  CommonProps & {
    as: "select";
    children: ReactNode;
  };

type AuroraFieldProps = InputProps | SelectProps;

/**
 * Reusable text-style input/select with a glowing underline.
 * - Transparent background, bold text
 * - Underline fades to amber on focus (via group-focus-within)
 * - Icon is clickable: focuses the input / opens the select picker
 * - `iconPosition` ('right' default | 'left') puts the icon before or after the field
 * - `size` ('md' default | 'sm' compact)
 */
const AuroraField = forwardRef<
  HTMLInputElement | HTMLSelectElement,
  AuroraFieldProps
>(function AuroraField(props, ref) {
  // Pull out AuroraField-specific props so they don't leak into the underlying
  // DOM element via the {...domProps} spread below.
  const {
    label,
    icon,
    iconPosition = "right",
    error,
    containerClassName = "",
    id,
    className = "",
    as = "input",
    size = "md",
    ...domProps
  } = props;

  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  const internalRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Combina ref interna (para que el botón del icono pueda activar el field)
  // con la ref que forwardea AuroraField hacia su consumidor.
  const setRef = (node: HTMLInputElement | HTMLSelectElement | null) => {
    internalRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<typeof node>).current = node;
    }
  };

  const isSm = size === "sm";
  const iconSize = isSm ? 16 : 20;
  const textClasses = isSm
    ? "text-xs md:text-sm"
    : "text-base md:text-xl";
  const paddingY = isSm ? "py-1" : "py-2";
  const underlineHeight = isSm ? "h-1" : "h-1.5";

  const resolvedIcon =
    as === "select"
      ? icon ?? <ChevronDown size={iconSize} strokeWidth={2.5} />
      : icon;

  const sharedFieldClasses = `
    flex-1 min-w-0 bg-transparent outline-none border-none appearance-none
    ${textClasses} font-semibold text-white
    placeholder:text-white/90 placeholder:font-semibold
    ${paddingY}
    disabled:opacity-50 disabled:cursor-not-allowed
    ${className}
  `;

  const handleIconClick = () => {
    const el = internalRef.current;
    if (!el) return;
    if (as === "select") {
      const sel = el as HTMLSelectElement & { showPicker?: () => void };
      if (typeof sel.showPicker === "function") {
        try {
          sel.showPicker();
          return;
        } catch {
          // showPicker can throw if the element isn't focused/visible; fall through to focus()
        }
      }
    }
    el.focus();
  };

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

      <div className="relative group/aurora">
        <div className="flex items-center gap-2">
          {resolvedIcon && iconPosition === "left" && (
            <IconButton onActivate={handleIconClick}>{resolvedIcon}</IconButton>
          )}

          {as === "select" ? (
            <select
              {...(domProps as SelectHTMLAttributes<HTMLSelectElement>)}
              ref={setRef as React.Ref<HTMLSelectElement>}
              id={fieldId}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className={`${sharedFieldClasses} pr-1 cursor-pointer [&>option]:bg-zinc-900 [&>option]:text-white`}
            >
              {(props as SelectProps).children}
            </select>
          ) : (
            <input
              {...(domProps as InputHTMLAttributes<HTMLInputElement>)}
              ref={setRef as React.Ref<HTMLInputElement>}
              id={fieldId}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className={sharedFieldClasses}
            />
          )}

          {resolvedIcon && iconPosition === "right" && (
            <IconButton onActivate={handleIconClick}>{resolvedIcon}</IconButton>
          )}
        </div>

        {/* Underline: thin on left, thick on right (right-triangle wedge) */}
        <div
          aria-hidden
          className={`
            absolute left-0 right-0 bottom-0 ${underlineHeight}
            bg-white group-focus-within/aurora:bg-amber-300
            [clip-path:polygon(0_0,100%_100%,100%_0%)]
            transition-colors duration-200
          `}
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

function IconButton({
  onActivate,
  children,
}: {
  onActivate: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // mousedown.preventDefault() evita el cambio de foco antes de que onClick reenfoque al field
      onMouseDown={(e) => e.preventDefault()}
      onClick={onActivate}
      tabIndex={-1}
      aria-hidden
      className="shrink-0 text-white group-focus-within/aurora:text-amber-300 transition-colors duration-200 cursor-pointer"
    >
      {children}
    </button>
  );
}
