'use client';

import { useState, ReactNode } from 'react';
import dynamic from "next/dynamic";
import { DesktopNavbar } from './DesktopNavbar';
import { MobileMenu } from './MobileMenu';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { MENU_ITEMS } from '../constants/navigation';

const StarBackground = dynamic(
  () => import("./StarBackground").then(mod => mod.StarBackground),
  { ssr: false }
);

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isNavbarVisible = useScrollDirection();

  const handleOpenMobileMenu = () => setIsMobileMenuOpen(true);
  const handleCloseMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-black relative overflow-x-hidden">
      <StarBackground />

      <DesktopNavbar menuItems={MENU_ITEMS} isVisible={isNavbarVisible} />

      <MobileMenu
        menuItems={MENU_ITEMS}
        isVisible={isNavbarVisible}
        isOpen={isMobileMenuOpen}
        onOpen={handleOpenMobileMenu}
        onClose={handleCloseMobileMenu}
      />

      <main className="relative z-10 pt-32 px-8">
        {children}
      </main>
    </div>
  );
};
