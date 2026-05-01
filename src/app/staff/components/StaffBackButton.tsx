import Link from "next/link";
import { ArrowBigLeftDash } from "lucide-react";

interface StaffBackButtonProps {
  href?: string;
  label?: string;
}

export default function StaffBackButton({
  href = "/staff",
  label = "Volver",
}: StaffBackButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center p-2 rounded-full text-white/70 hover:text-amber-300 hover:bg-white/5 transition-colors"
    >
      <ArrowBigLeftDash size={32} strokeWidth={2} />
    </Link>
  );
}
