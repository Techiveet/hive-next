// components/ui/tabs.tsx
"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

type TabsRootProps = React.ComponentProps<typeof TabsPrimitive.Root>;
type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List>;
type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger>;
type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content>;

function makeIds(value: TabsTriggerProps["value"]) {
  if (typeof value !== "string" && typeof value !== "number") return {};
  const v = String(value);
  return {
    triggerId: `tabs-trigger-${v}`,
    contentId: `tabs-content-${v}`,
  };
}

function Tabs({ className, ...props }: TabsRootProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const { triggerId, contentId } = makeIds(value);

  return (
    <TabsPrimitive.Trigger
      id={triggerId}
      aria-controls={contentId}
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      value={value}
      {...props}
    />
  );
}

function TabsContent({ className, value, ...props }: TabsContentProps) {
  const { triggerId, contentId } = makeIds(value);

  return (
    <TabsPrimitive.Content
      id={contentId}
      aria-labelledby={triggerId}
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      value={value}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
