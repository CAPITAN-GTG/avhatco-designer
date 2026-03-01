"use client";

import * as React from "react";
import {
  Root as DropdownMenuRoot,
  DropdownMenuTrigger as TriggerPrimitive,
  DropdownMenuContent as ContentPrimitive,
  DropdownMenuItem as ItemPrimitive,
  DropdownMenuPortal,
  DropdownMenuGroup,
  DropdownMenuLabel as LabelPrimitive,
  DropdownMenuSeparator as SeparatorPrimitive,
} from "@radix-ui/react-dropdown-menu";

const DropdownMenu = DropdownMenuRoot;

const DropdownMenuTrigger = TriggerPrimitive;

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof ContentPrimitive>,
  React.ComponentPropsWithoutRef<typeof ContentPrimitive>
>(({ className = "", ...props }, ref) => (
  <DropdownMenuPortal>
    <ContentPrimitive
      ref={ref}
      className={
        "z-50 min-w-[14rem] max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto " +
        "rounded-md border border-[#e5e5e5] bg-white p-1 text-[#1a1a1a] shadow-md " +
        className
      }
      sideOffset={4}
      {...props}
    />
  </DropdownMenuPortal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof ItemPrimitive>,
  React.ComponentPropsWithoutRef<typeof ItemPrimitive>
>(({ className = "", ...props }, ref) => (
  <ItemPrimitive
    ref={ref}
    className={
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none " +
      "focus:bg-[#f0f0f0] data-[highlighted]:bg-[#f0f0f0] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
      className
    }
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive>
>(({ className = "", ...props }, ref) => (
  <LabelPrimitive
    ref={ref}
    className={"px-2 py-1.5 text-sm font-semibold text-[#555] " + className}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive>
>(({ className = "", ...props }, ref) => (
  <SeparatorPrimitive
    ref={ref}
    className={"-mx-1 my-1 h-px bg-[#e5e5e5] " + className}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
};
