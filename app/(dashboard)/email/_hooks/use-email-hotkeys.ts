"use client";

import { useEffect } from "react";

type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;

  const tag = (t.tagName || "").toLowerCase();
  const editable = (t as any).isContentEditable;

  return (
    editable ||
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    tag === "option"
  );
}

// supports single keys like "j", "k", "/" and combos like "shift+#" etc
function normalizeKey(e: KeyboardEvent) {
  const parts: string[] = [];
  if (e.shiftKey) parts.push("shift");
  if (e.ctrlKey) parts.push("ctrl");
  if (e.metaKey) parts.push("meta");
  if (e.altKey) parts.push("alt");

  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  parts.push(key);

  return parts.join("+");
}

export function useEmailHotkeys(map: HotkeyMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // don’t hijack shortcuts while user is typing in inputs/editor
      if (isTypingTarget(e.target)) return;

      // ignore if user is using browser/system shortcuts
      if (e.ctrlKey || e.metaKey) return;

      const key = normalizeKey(e);
      const handler = map[key] ?? map[e.key.toLowerCase()];
      if (!handler) return;

      handler(e);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [map, enabled]);
}
