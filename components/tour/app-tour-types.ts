//app/components/tour/app-tour-types.ts
export type TourStep = {
  id: string;
  target: string; // CSS selector e.g. [data-tour="sidebar"]
  title: string;
  content: string;
  placement?: "top" | "right" | "bottom" | "left" | "center";
};
