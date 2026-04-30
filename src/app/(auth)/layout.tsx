import { ReactNode } from 'react';
import { StarBackground } from '@/components/StarBackground';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh bg-black relative overflow-hidden">
      <StarBackground />
      <main className="relative z-10 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
