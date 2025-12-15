"use client";

import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useAppTour } from "./app-tour-provider";

type Rect = { x: number; y: number; width: number; height: number };

function getScrollParents(el: Element | null) {
  const parents: Element[] = [];
  if (!el) return parents;

  let p: Element | null = el.parentElement;

  while (p) {
    const style = window.getComputedStyle(p);
    const oy = style.overflowY;
    const ox = style.overflowX;

    const scrollableY = oy === "auto" || oy === "scroll";
    const scrollableX = ox === "auto" || ox === "scroll";

    if (scrollableY || scrollableX) parents.push(p);
    p = p.parentElement;
  }

  parents.push(document.documentElement);
  return parents;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

function getViewport() {
  const el = document.documentElement;
  return { w: el.clientWidth, h: el.clientHeight };
}

/**
 * ✅ FIX: clamp highlight so it never overflows viewport
 */
function getRect(selector: string, pad = 10, margin = 18): Rect | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;

  const { w: vw, h: vh } = getViewport();
  const r = el.getBoundingClientRect();

  let x = r.left - pad;
  let y = r.top - pad;

  let width = r.width + pad * 2;
  let height = r.height + pad * 2;

  const maxW = vw - margin * 2;
  const maxH = vh - margin * 2;

  width = Math.min(width, maxW);
  height = Math.min(height, maxH);

  x = clamp(x, margin, vw - margin - width);
  y = clamp(y, margin, vh - margin - height);

  return { x, y, width, height };
}

export function AppTourUI() {
  const { isOpen, steps, index, stop, next, back } = useAppTour();
  const step = steps[index];

  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  const tipRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const highlight = useMemo(() => rect, [rect]);

  useEffect(() => setMounted(true), []);

  const measure = () => {
    if (!isOpen || !step) return;

    const el = document.querySelector(step.selector) as HTMLElement | null;
    targetRef.current = el;

    const auto = getRect(step.selector, step.padding ?? 12);

    // merge fixed rect with auto (so top/y stays correct if you want auto y)
    // @ts-ignore
    if (step.rect && auto) {
      // @ts-ignore
      setRect({
        // @ts-ignore
        x: step.rect.x ?? auto.x,
        // @ts-ignore
        y: step.rect.y ?? auto.y,
        // @ts-ignore
        width: step.rect.width ?? auto.width,
        // @ts-ignore
        height: step.rect.height ?? auto.height,
      });
      return;
    }

    setRect(auto);
  };

  const scheduleMeasure = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      measure();
    });
  };

  useEffect(() => {
    if (!isOpen || !step) return;

    measure();

    const el = document.querySelector(step.selector) as HTMLElement | null;
    targetRef.current = el;

    if (el) {
      el.scrollIntoView({
        block: "center",
        inline: "center",
        behavior: "smooth",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, index, step?.selector]);

  useEffect(() => {
    if (!isOpen || !step) return;

    scheduleMeasure();

    const onResize = () => scheduleMeasure();
    window.addEventListener("resize", onResize);

    const parents = getScrollParents(targetRef.current);
    parents.forEach((p) =>
      p.addEventListener("scroll", scheduleMeasure, { passive: true })
    );

    const ro = new ResizeObserver(() => scheduleMeasure());
    if (targetRef.current) ro.observe(targetRef.current);

    return () => {
      window.removeEventListener("resize", onResize);
      parents.forEach((p) =>
        p.removeEventListener("scroll", scheduleMeasure as any)
      );
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, index, step?.selector]);

  useEffect(() => {
    if (!isOpen || !highlight || !tipRef.current || !step) return;

    const tip = tipRef.current;

    const virtualEl = {
      getBoundingClientRect: () =>
        ({
          x: highlight.x,
          y: highlight.y,
          left: highlight.x,
          top: highlight.y,
          right: highlight.x + highlight.width,
          bottom: highlight.y + highlight.height,
          width: highlight.width,
          height: highlight.height,
        }) as DOMRect,
    };

    computePosition(virtualEl as any, tip, {
      placement: step.placement ?? "bottom",
      middleware: [offset(12), shift({ padding: 12 }), flip()],
      strategy: "fixed",
    }).then(({ x, y }) => {
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    });
  }, [
    isOpen,
    highlight?.x,
    highlight?.y,
    highlight?.width,
    highlight?.height,
    index,
    step?.placement,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!mounted || !isOpen || !step || !highlight) return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* ✅ ONE overlay only */}
      <div className="absolute inset-0 bg-slate-950/35" />

      {/* ✅ Spotlight / highlight */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: highlight.x,
          top: highlight.y,
          width: highlight.width,
          height: highlight.height,
        }}
      >
        <div
          className="absolute inset-0 rounded-[28px]"
          style={{ boxShadow: "0 0 0 99999px rgba(2,6,23,0.55)" }}
        />
        <div className="absolute -inset-3 rounded-[34px] bg-emerald-400/10 blur-2xl" />
        <div
          className={cn(
            "absolute inset-0 rounded-[28px] border",
            "border-emerald-300/80",
            "shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_12px_34px_rgba(0,0,0,0.35),0_0_60px_rgba(16,185,129,0.18)]"
          )}
        />
        <div className="absolute inset-[2px] rounded-[26px] ring-1 ring-white/10" />
      </div>

      {/* Tooltip */}
      <div
        ref={tipRef}
        className={cn(
          "fixed z-[10000] w-[360px] max-w-[calc(100vw-24px)]",
          "rounded-2xl border border-white/10 bg-slate-950/95 text-slate-50 shadow-2xl backdrop-blur"
        )}
      >
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold">{step.title}</div>
              <div className="mt-1 text-xs text-slate-300">{step.body}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={stop}
            className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-slate-50"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <div className="text-[11px] text-slate-400">
            Step {index + 1} of {steps.length}
          </div>

          <div className="flex items-center gap-2">
            {/* ✅ Skip BEFORE Back */}
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-slate-50"
            >
              Skip
            </button>

            <button
              type="button"
              onClick={back}
              disabled={isFirst}
              className={cn(
                "inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs",
                isFirst ? "opacity-40" : "hover:bg-white/10"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            {!isLast ? (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={stop}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
