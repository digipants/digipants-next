"use client";

import * as React from "react";
import { motion } from "framer-motion";

// Take all motion.div props (except ref) and omit DOM animation/drag handlers that conflict
type MotionDivBase = Omit<
  React.ComponentProps<typeof motion.div>,
  | "ref"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragOver"
  | "onDragEnter"
  | "onDragLeave"
  | "onDrop"
>;

type AnimatedCardProps = MotionDivBase & {
  /** default y offset if caller doesn't pass `initial` */
  y?: number;
  /** default duration if caller doesn't pass `transition` */
  duration?: number;
  /** default: true, runs once when in view if caller doesn't pass `viewport` */
  once?: boolean;
  /** default: 0.15, how much must be visible to trigger (if no viewport passed) */
  amount?: number;
};

export default function AnimatedCard({
  children,
  className,
  y = 10,
  duration = 0.35,
  once = true,
  amount = 0.15,
  initial,
  whileInView,
  viewport,
  transition,
  ...rest
}: AnimatedCardProps) {
  const initialMerged = initial ?? { opacity: 0, y };
  const whileInViewMerged = whileInView ?? { opacity: 1, y: 0 };
  const viewportMerged = viewport ?? { once, amount };
  const transitionMerged = transition ?? { duration, ease: "easeOut" };

  return (
    <motion.div
      className={className}
      initial={initialMerged}
      whileInView={whileInViewMerged}
      viewport={viewportMerged}
      transition={transitionMerged}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
