"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

export default function IntercambiosButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/intercambios"
      aria-label="Mis intercambios"
      title="Intercambios"
      className={`items-center justify-center p-2 rounded-full text-cyan-700 hover:text-cyan-600 hover:bg-white/5 transition-colors ${className}`}
    >
      <ArrowLeftRight size={28} strokeWidth={2} />
    </Link>
  );
}
