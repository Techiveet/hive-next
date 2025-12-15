"use client";

import { useAppTour } from "@/components/tour/app-tour-provider";
import { useEffect } from "react";

export function AppTourMount() {
  const { start } = useAppTour();

  useEffect(() => {
    const handler = () => start();

    window.addEventListener("start-app-tour", handler);
    return () => window.removeEventListener("start-app-tour", handler);
  }, [start]);

  return null;
}
