'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { StarBackground } from '@/components/StarBackground';
import { DesktopNavbar } from '@/components/DesktopNavbar';
import { MobileMenu } from '@/components/MobileMenu';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { MENU_ITEMS } from '@/constants/navigation';
import { usePathname } from 'next/navigation';

export default function AppLayout({children,}: {children: ReactNode}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const mainRef = useRef<HTMLElement | null>(null);
    const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
    const isNavbarVisible = useScrollDirection(scrollEl);
    const pathname = usePathname();

    // La portada ya enseña esas mismas cinco constelaciones a pantalla
    // completa, y la franja de arriba es donde sale el nombre de la que se
    // señala: repetir ahí el navbar sería enseñar el menú dos veces y
    // taparlo. El menú hamburguesa sí se queda, que en móvil la portada no
    // trae otra salida.
    const isHome = pathname === '/';

    const handleOpenMobileMenu = () => setIsMobileMenuOpen(true);
    const handleCloseMobileMenu = () => setIsMobileMenuOpen(false);

    useEffect(() => {
        setScrollEl(mainRef.current);
    }, [pathname]);

    return (
        <div className="h-dvh bg-black relative overflow-hidden">
            <StarBackground />

            {!isHome && <DesktopNavbar menuItems={MENU_ITEMS} isVisible={isNavbarVisible} />}

            <MobileMenu
            menuItems={MENU_ITEMS}
            isVisible={isNavbarVisible}
            isOpen={isMobileMenuOpen}
            onOpen={handleOpenMobileMenu}
            onClose={handleCloseMobileMenu}
            />
            
            {/* Main Content */}
            <main 
                key={pathname}
                ref={mainRef}
                className="relative z-10 h-full overflow-y-auto pt-32 px-3 flex flex-col">
                
                <div className="flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
};

