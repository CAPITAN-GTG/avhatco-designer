"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "gap-2 group/tabs flex flex-col data-[orientation=vertical]:flex-row",
        className
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "rounded-lg p-[3px] group-data-horizontal/tabs:h-8 data-[variant=line]:rounded-none group/tabs-list inline-flex w-fit items-center justify-center group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        line: "gap-1 bg-transparent text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium [&_svg:not([class*='size-'])]:size-4 relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap transition-colors duration-200 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        // Default (segmented) tab list — theme foreground
        "group-data-[variant=default]/tabs-list:text-foreground/60 group-data-[variant=default]/tabs-list:hover:text-foreground",
        "group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground group-data-[variant=default]/tabs-list:dark:text-muted-foreground group-data-[variant=default]/tabs-list:dark:hover:text-foreground",
        "group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:dark:data-[state=active]:border-input group-data-[variant=default]/tabs-list:dark:data-[state=active]:bg-input/30 group-data-[variant=default]/tabs-list:dark:data-[state=active]:text-foreground",
        "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm",
        // Line tab list — explicit zinc (dark panel); never use theme foreground / black hover
        "group-data-[variant=line]/tabs-list:text-zinc-400 group-data-[variant=line]/tabs-list:hover:bg-zinc-800/55 group-data-[variant=line]/tabs-list:hover:text-zinc-100",
        "group-data-[variant=line]/tabs-list:data-[state=active]:bg-zinc-900 group-data-[variant=line]/tabs-list:data-[state=active]:text-white",
        "group-data-[variant=line]/tabs-list:data-[state=active]:shadow-[inset_0_-2px_0_0] group-data-[variant=line]/tabs-list:data-[state=active]:shadow-sky-400/90",
        "group-data-[variant=line]/tabs-list:bg-transparent",
        // Underline indicator
        "after:absolute after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5",
        "group-data-[variant=default]/tabs-list:after:bg-foreground group-data-[variant=default]/tabs-list:data-[state=active]:after:opacity-100",
        "group-data-[variant=line]/tabs-list:after:bg-sky-400 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("text-sm flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
