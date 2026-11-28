"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface MotionRevealProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

/**
 * Progressive-enhancement scroll reveal:
 * - Renders visible in SSR HTML so content is never hidden if scripting fails.
 * - On hydration, only applies a subtle fade+rise to elements currently below the viewport fold.
 * - Immediately reveals when intersecting and respects prefers-reduced-motion.
 */
export function MotionReveal({
  children,
  delayMs = 0,
  className = "",
}: MotionRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"ssr" | "pending" | "visible">("ssr");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setState("visible");
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) {
      setState("visible");
      return;
    }

    setState("pending");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState("visible");
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stateClass =
    state === "pending"
      ? "cc-reveal cc-reveal-pending"
      : state === "visible"
        ? "cc-reveal cc-reveal-visible"
        : "";

  return (
    <div
      ref={ref}
      data-reveal-state={state}
      style={
        delayMs > 0 && state !== "ssr"
          ? { transitionDelay: `${delayMs}ms` }
          : undefined
      }
      className={`${stateClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

