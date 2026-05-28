import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Shared page-entrance wrapper. Slides + fades children in on mount; key
 * prop on the parent (route key) re-runs the animation on navigation so
 * each page change feels intentional rather than abrupt. Honours the user's
 * reduced-motion preference (renders statically when set).
 */
export function PageEnter({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered enter — children of this wrapper animate in one after another.
 * Pair with PageEnterItem on each direct child.
 */
export function PageEnterStagger({ children, gap = 0.06 }: { children: ReactNode; gap?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: gap } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function PageEnterItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.985 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * SubTabSwitch — wrap conditional sub-tab content so swapping panels
 * fades out → in instead of snapping. The `tabKey` prop must change
 * with the active tab so AnimatePresence sees a fresh React tree.
 */
export function SubTabSwitch({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
