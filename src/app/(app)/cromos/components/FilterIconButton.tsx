"use client";

import Image from "next/image";

export type FilterIconSize = "sm" | "md" | "lg";

interface FilterIconButtonProps {
  iconUrl: string;
  label: string;
  active: boolean;
  size?: FilterIconSize;
  onClick: () => void;
}

const SIZE_CLASSES: Record<FilterIconSize, string> = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

const SIZE_HINTS: Record<FilterIconSize, string> = {
  sm: "32px",
  md: "40px",
  lg: "48px",
};

export default function FilterIconButton({
  iconUrl,
  label,
  active,
  size = "md",
  onClick,
}: FilterIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`relative ${SIZE_CLASSES[size]} cursor-pointer transition-all duration-200 ${
        active ? "opacity-100" : "opacity-60 hover:opacity-100"
      }`}
    >
      <Image
        src={iconUrl}
        alt={label}
        fill
        sizes={SIZE_HINTS[size]}
        className={`object-contain transition-[filter] duration-200 ${
          active ? "drop-shadow-[0_0_8px_rgba(168,85,247,0.95)]" : ""
        }`}
      />
    </button>
  );
}
