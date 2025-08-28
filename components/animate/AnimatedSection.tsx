"use client";

import * as React from "react";
import { motion } from "framer-motion";

type MotionSectionBase = Omit<
  React.ComponentProps<typeof motion.section>,
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

type AnimatedSectionProps = MotionSectionBase & {
  y?: number;
  duration?: number;
  once?: boolean;
  amount?: number;
};

export default function AnimatedSection({
  children,
  className,
  y = 12,
  duration = 0.45,
  once = true,
  amount = 0.2,
  initial,
  whileInView,
  viewport,
  transition,
  ...rest
}: AnimatedSectionProps) {
  const initialMerged = initial ?? { opacity: 0, y };
  const whileInViewMerged = whileInView ?? { opacity: 1, y: 0 };
  const viewportMerged = viewport ?? { once, amount };
  const transitionMerged = transition ?? { duration, ease: "easeOut" };

  return (
    <motion.section
      className={className}
      initial={initialMerged}
      whileInView={whileInViewMerged}
      viewport={viewportMerged}
      transition={transitionMerged}
      {...rest}
    >
      {children}
    </motion.section>
  );
}
