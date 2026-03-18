"use client"

import * as React from "react"
import { Menu } from "@base-ui/react/menu"
import { cn } from "@/lib/utils"

const DropdownMenu = Menu.Root
const DropdownMenuTrigger = Menu.Trigger

// ── Portal / Positioner (kept for explicit usage) ──────────────────────────
function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  return <Menu.Portal>{children}</Menu.Portal>
}

function DropdownMenuPositioner({
  className,
  ...props
}: Menu.Positioner.Props) {
  return (
    <Menu.Positioner className={cn("z-50", className)} {...props} />
  )
}

// ── Content — self-contained: wraps Portal + Positioner internally ─────────
function DropdownMenuContent({
  className,
  align = "start",
  side = "bottom",
  sideOffset = 6,
  ...props
}: Menu.Popup.Props & {
  align?: Menu.Positioner.Props["align"]
  side?: Menu.Positioner.Props["side"]
  sideOffset?: Menu.Positioner.Props["sideOffset"]
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50">
        <Menu.Popup
          className={cn(
            "min-w-[160px] max-h-[260px] overflow-y-auto rounded-xl border border-border bg-background p-1 shadow-lg outline-none",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
            "transition-[opacity,transform] duration-150 ease-out origin-top",
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  )
}

// ── Group ──────────────────────────────────────────────────────────────────
function DropdownMenuGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("py-0.5", className)} {...props} />
}

// ── Item ───────────────────────────────────────────────────────────────────
function DropdownMenuItem({
  className,
  ...props
}: Menu.Item.Props) {
  return (
    <Menu.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-foreground outline-none",
        "hover:bg-muted focus:bg-muted",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  )
}

// ── Separator ─────────────────────────────────────────────────────────────
function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

// ── Label ─────────────────────────────────────────────────────────────────
function DropdownMenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider",
        className
      )}
      {...props}
    />
  )
}

// ── Shortcut ──────────────────────────────────────────────────────────────
function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-[11px] text-muted-foreground tracking-widest", className)}
      {...props}
    />
  )
}

// ── Sub-menu stubs (not implemented, exported for API compat) ─────────────
const DropdownMenuSub       = Menu.Root
const DropdownMenuSubTrigger = Menu.Trigger
function DropdownMenuSubContent({ className, ...props }: Menu.Popup.Props) {
  return (
    <Menu.Portal>
      <Menu.Positioner className="z-50">
        <Menu.Popup
          className={cn(
            "min-w-[160px] rounded-xl border border-border bg-background p-1 shadow-lg outline-none",
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
