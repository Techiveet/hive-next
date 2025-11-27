import * as React from "react"

import { cn } from "@/lib/utils"

function DataTableCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="datatable-card"
      className={cn(
        // Base card styles, but with gap-0 and overflow-hidden for tables
        "bg-card text-card-foreground flex flex-col gap-0 rounded-xl border shadow-sm overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function DataTableCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="datatable-card-header"
      className={cn(
        // Tighter padding for table headers, often with a bottom border
        "flex flex-col gap-1.5 px-6 py-4 border-b",
        className
      )}
      {...props}
    />
  )
}

function DataTableCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="datatable-card-title"
      className={cn("leading-none font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function DataTableCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="datatable-card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function DataTableCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="datatable-card-content"
      // p-0 is crucial here to allow the table to go edge-to-edge
      className={cn("p-0 flex-1", className)}
      {...props}
    />
  )
}

function DataTableCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="datatable-card-footer"
      // Added background contrast usually found in table footers
      className={cn("flex items-center px-6 py-4 border-t bg-muted/5", className)}
      {...props}
    />
  )
}

export {
  DataTableCard,
  DataTableCardHeader,
  DataTableCardFooter,
  DataTableCardTitle,
  DataTableCardDescription,
  DataTableCardContent,
}