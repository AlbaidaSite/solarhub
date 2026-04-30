import { useState, useEffect, useRef } from 'react';

export const useScrollDirection = (container?: HTMLElement | null) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastYRef = useRef(0);

  useEffect(() => {
    const THRESHOLD = 10; // altura desde la cual permitimos ocultar
    const DELTA = 1;      // mínima variación para evitar parpadeos

    const getY = () => (container ? container.scrollTop : window.scrollY);

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const current = getY();
        const diff = current - lastYRef.current;

        if (diff > DELTA && current > THRESHOLD) {
          setIsVisible(false);
        } else if (diff < -DELTA || current <= THRESHOLD) {
          setIsVisible(true);
        }

        lastYRef.current = current;
      });
    };

    lastYRef.current = getY();
    const target = container ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      target.removeEventListener('scroll', onScroll);
    };
  }, [container]);

  return isVisible;
};
