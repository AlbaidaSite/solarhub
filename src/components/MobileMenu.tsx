'use client';

import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { StarBackground } from './StarBackground';
import type { MenuItem } from '../types/navigation';

interface MobileMenuProps {
  menuItems: MenuItem[];
  isVisible: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const MobileMenu = ({
  menuItems,
  isVisible,
  isOpen,
  onOpen,
  onClose,
}: MobileMenuProps) => {
  const router = useRouter();

  const handleNavigation = (href?: string) => {
    if (href) {
      router.push(href);
    }
    onClose();
  };

  return (
    <>
      {/* Hamburger Button */}
      <div
        className={`md:hidden fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex justify-end items-center p-6">
          <button
            onClick={onOpen}
            className="text-white hover:text-gray-300 transition-colors p-2"
            aria-label="Abrir menú"
          >
            <Menu size={32} />
          </button>
        </div>
      </div>

      {/* Fullscreen Menu */}
      <div
        className={`md:hidden fixed inset-0 z-100 bg-black transition-transform duration-300 overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <StarBackground />

        {/* Close button */}
        <div className="relative z-10 flex justify-end p-6">
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors p-2"
            aria-label="Cerrar menú"
          >
            <X size={32} />
          </button>
        </div>

        {/* Menu items */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-100px)] gap-12 py-8">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              className="text-white hover:text-gray-300 transition-all duration-200 flex flex-col items-center gap-4 p-4"
              aria-label={item.label}
            >
              <item.icon size={48} />
              <span className="text-2xl">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};