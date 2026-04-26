import { useState } from 'react';
import type { MenuItem } from '@/types/navigation';

interface DesktopNavbarProps {
  menuItems: MenuItem[];
  isVisible: boolean;
}

export const DesktopNavbar = ({ menuItems, isVisible }: DesktopNavbarProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  

  const handleNavigation = (href?: string) => {
    if (href) {
      window.location.href = href;
    }
  };

  return (
    <nav
      className={`hidden nav:block fixed top-0 left-0 right-0 z-50 transition-transform duration-500 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {/* Single background container with blur and 84% opacity */}
      <div className="mx-auto max-w-max bg-black/77 backdrop-blur-md rounded-lg px-4">
        <div className="flex justify-center items-center gap-12 py-6">
          {menuItems.map((item, index) => (
            
            <div key={index} className="relative">
              <button
                className="relative w-[60px] h-[60px] rounded-full flex items-center justify-center group"
                aria-label={item.label}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleNavigation(item.href)}
              >
                {/* SVG for lines - visible when not hovering */}
                <svg
                  className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-200 ${
                    hoveredIndex === index ? 'opacity-0' : 'opacity-100'
                  }`}
                  style={{ overflow: 'visible' }}
                >
                  {item.dots?.map((dot, dotIndex) => 
                    dot.connectsTo?.map((targetIndex) => {
                      const targetDot = item.dots?.[targetIndex];
                      if (!targetDot) return null;
                      
                      return (
                        <line
                          key={`${dotIndex}-${targetIndex}`}
                          x1="50%"
                          y1="50%"
                          stroke="#9999dd"
                          strokeWidth="1"
                          style={{
                            transform: `translate(${dot.x}px, ${dot.y}px)`,
                          }}
                          x2={`calc(50% + ${targetDot.x - dot.x}px)`}
                          y2={`calc(50% + ${targetDot.y - dot.y}px)`}
                        />
                      );
                    })
                  )}
                </svg>

                {/* Dots - visible when not hovering */}
                {item.dots?.map((dot, dotIndex) => (
                  <div
                    key={dotIndex}
                    className={`absolute rounded-full bg-white transition-opacity duration-200 ${
                      hoveredIndex === index ? 'opacity-0' : 'opacity-100'
                    }`}
                    style={{
                      width: `${dot.size}px`,
                      height: `${dot.size}px`,
                      transform: `translate(calc(-50% + ${dot.x+2}px), calc(-50% + ${dot.y+2}px))`,
                    }}
                  />
                ))}

                {/* Icon - visible when hovering */}
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-100 ${
                    hoveredIndex === index
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-75'
                  }`}
                >
                  <item.icon
                    size={60}
                    className="text-white hover:text-gray-300 transition-colors"
                  />
                </div>
              </button>

              {/* Label - visible when hovering */}
              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-[-6] whitespace-nowrap transition-all duration-550 z-[-10] ${
                  hoveredIndex === index
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-2 pointer-events-none'
                }`}
              >
                <span className="text-white text-sm">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
};