"use client";

type Handler = () => void;

const queueHandlers = new Set<Handler>();
const statusHandlers = new Set<Handler>();

export function emitQueueChanged() {
  queueHandlers.forEach((h) => h());
}

export function onQueueChanged(handler: Handler) {
  queueHandlers.add(handler);
  return () => queueHandlers.delete(handler);
}

export function emitStatusChanged() {
  statusHandlers.forEach((h) => h());
}

export function onStatusChanged(handler: Handler) {
  statusHandlers.add(handler);
  return () => statusHandlers.delete(handler);
}
