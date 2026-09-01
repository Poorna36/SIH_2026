import { useEffect } from 'react';

/**
 * useMagneticButtons — Lightweight delegated magnetic & reactive feel
 * Uses a single passive event listener with zero DOM observers or re-render overhead.
 */
export function useMagneticButtons() {
  useEffect(() => {
    let currentTarget: HTMLElement | null = null;
    let rafId: number | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest('button, [data-magnetic="true"]') as HTMLElement | null;

      if (!target) {
        if (currentTarget) {
          currentTarget.style.transform = '';
          currentTarget = null;
        }
        return;
      }

      currentTarget = target;
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) * 0.18;
      const deltaY = (e.clientY - centerY) * 0.18;

      const clampedX = Math.max(-5, Math.min(5, deltaX));
      const clampedY = Math.max(-5, Math.min(5, deltaY));

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (target) {
          target.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0px)`;
        }
      });
    };

    const handlePointerOut = () => {
      if (currentTarget) {
        currentTarget.style.transform = '';
        currentTarget = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerout', handlePointerOut, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerout', handlePointerOut);
    };
  }, []);
}
