'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';

const pageSpring = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 30,
};

export function PageTransition({ children, k }: { children: ReactNode; k: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        initial={{ opacity: 0, y: 8 }}
        key={k}
        transition={pageSpring}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return <PageTransition k={pathname}>{children}</PageTransition>;
}

export const collapseSpring = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 30,
};
