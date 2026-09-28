---
version: alpha
name: Tree Todo
description: 清爽、轻量的本地任务拆分工具；颜色和尺寸来自当前 Tailwind 样式，字体按默认系统无衬线字体记录。
colors:
  primary: "#2563EB"
  on-primary: "#FFFFFF"
  canvas: "#F8FAFC"
  surface: "#FFFFFF"
  surface-muted: "#F1F5F9"
  text-primary: "#0F172A"
  text-secondary: "#475569"
  text-muted: "#64748B"
  success-surface: "#D1FAE5"
  success-text: "#065F46"
  danger: "#DC2626"
typography:
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
  metadata:
    fontFamily: "ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  primary-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
  todo-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
  workspace-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
  muted-surface:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-secondary}"
  muted-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
  subtle-label:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
  completed-state:
    backgroundColor: "{colors.success-surface}"
    textColor: "{colors.success-text}"
  destructive-action:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
---

## Overview

Tree Todo is a clean productivity tool for breaking work into a navigable tree and acting on leaf tasks in a list. The interface uses a light slate canvas, white cards, and blue for primary actions and selection. Green marks completed work; red is reserved for destructive actions. Keep the interface calm and compact, with task content taking priority over decoration.

## Colors

The palette is taken from the Tailwind utility classes used by the current UI. Slate 50 (`#F8FAFC`) is the canvas, white is used for surfaces, slate 200 (`#E2E8F0`) for borders, and slate shades define the text hierarchy. Graph connections use slate 400 (`#94A3B8`). Blue 600 identifies primary actions and selected nodes. Completed-status text uses emerald 800 on emerald 100; completion icons use emerald 600. Red marks destructive controls. Tag colors are chosen by the user in settings and should remain data-driven.

## Typography

The app uses Tailwind's default system sans-serif stack; no external font is loaded. Most controls and task metadata use compact 12–14 px text. Headings use modest size changes and semibold weight rather than display typography. Dates and numeric importance/urgency values use a monospace stack for alignment.

## Layout

The top navigation is 56 px high. The list is centered and capped at a 56 rem width. Graph nodes are 270 px wide and arranged from left to right with d3-hierarchy spacing. On desktop, the task detail panel is 384 px wide; on screens below Tailwind's `md` breakpoint it fills the viewport. The graph canvas supports panning and zooming, including touch input. These dimensions are read from the current utility classes and layout constants.

## Elevation & Depth

Use subtle card shadows to separate white surfaces from the pale slate canvas. The detail drawer and confirmation dialog receive stronger shadows because they sit above the main view. Selected graph nodes use a blue border and a faint blue ring instead of a large shadow.

## Shapes

Most controls and task cards use 8 px corners; larger dialogs use 12 px corners. Small labels and icon controls use tighter 4–6 px corners. Circular shapes are reserved for status icons and tag-color swatches.

## Components

- Primary buttons use blue 600 with white text and an 8 px radius.
- Todo cards use a white surface, slate border, and consistent shape for both parent and leaf nodes. Completion state changes the status icon and text treatment, not the node layout.
- The detail panel is a right-side drawer on desktop and a full-screen panel on mobile.
- Confirmation dialogs use a centered white card. Destructive confirmations use red accents; the warning glyph sits on a pale red tint.
- Graph connections use a muted slate line. User-defined tag colors appear as compact tinted labels.

## Do's and Don'ts

- Do keep parent and leaf Todo cards visually consistent.
- Do use blue for the current selection and primary action, green for completion, and red for destructive actions.
- Do retain clear spacing and readable hierarchy on narrow screens.
- Don't add decorative gradients, large illustrations, or extra dashboard chrome to this task-focused interface.
- Don't assign a fixed palette to user-created tags; preserve each tag's chosen color.
