export type AppTourStep = {
  id: string;
  route: string;
  selector: string;
  title: string;
  description: string;
  side?: "left" | "right" | "top" | "bottom";
  align?: "start" | "center" | "end";
};

export const APP_TOUR_STEPS: AppTourStep[] = [
  {
    id: "sidebar",
    route: "/dashboard",
    selector: "[data-tour='sidebar']",
    title: "Navigation",
    description: "Use the sidebar to move through the app quickly.",
    side: "right",
    align: "center",
  },
  {
    id: "email",
    route: "/email",
    selector: "[data-tour='email:list']",
    title: "Emails",
    description: "Your messages appear here. Click one to read.",
    side: "right",
  },
];
