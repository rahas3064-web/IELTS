import { useEffect, useState, type RefObject } from "react";
import { isMobileWidth, timelineFromCenters, timelineKey, type Timeline } from "@/components/features/bandora/content";

export function useMobileWidth(): boolean {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1200 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobileWidth(width);
}

export function useBandoraMotion(
  rootRef: RefObject<HTMLElement | null>,
  setTimeline: (timeline: Timeline) => void,
) {
  useEffect(() => {
    let alive = true;
    let frame = false;
    let key = "";

    const onScroll = () => {
      if (frame) return;
      frame = true;
      requestAnimationFrame(() => {
        frame = false;
        if (!alive) return;
        const root = rootRef.current;
        if (!root) return;
        const dots = [...root.querySelectorAll<HTMLElement>("[data-stepdot]")];
        if (!dots.length) return;
        const cy = window.innerHeight * 0.55;
        const centers = dots.map((el) => {
          const rect = el.getBoundingClientRect();
          return rect.top + rect.height / 2;
        });
        const next = timelineFromCenters(centers, cy);
        const nextKey = timelineKey(next);
        if (nextKey === key) return;
        key = nextKey;
        setTimeline(next);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const scrollTimer = window.setTimeout(onScroll, 350);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let revealTimer = 0;
    let observer: IntersectionObserver | undefined;

    if (!reduce && "IntersectionObserver" in window) {
      revealTimer = window.setTimeout(() => {
        const root = rootRef.current;
        if (!root || !alive) return;
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const target = entry.target as HTMLElement;
              target.style.opacity = "1";
              target.style.transform = "none";
              observer?.unobserve(target);
            });
          },
          { threshold: 0.08 },
        );
        root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight) return;
          el.style.opacity = "0";
          el.style.transform = "translateY(18px)";
          el.style.transition = "opacity .8s ease, transform .8s ease";
          observer?.observe(el);
        });
      }, 300);
    }

    return () => {
      alive = false;
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollTimer);
      window.clearTimeout(revealTimer);
      observer?.disconnect();
    };
  }, [rootRef, setTimeline]);
}
