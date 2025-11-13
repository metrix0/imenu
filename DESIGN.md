# 1) Font

## Font family
- Already set globally in `globals.css`.

## Weights used
- **400 Regular** → body, inputs, dropdowns, sidebar labels
- **500 Medium** → section titles, tabs active
- **700 Bold** → page titles, highlighted labels

## Font sizes used
- **text-3xl** → Page titles
- **text-xl** → Section headers in the UI showcase
- **text-base** → Body default (inputs, dropdowns, sidebar, cards, menu items)
- **text-sm** → Helper text

## Letter spacing
- **normal** (default)
- Higher letter spacing may be used if needed (rare).

---

# 2) Colors

## Brand
`var(--color-brand)` (set in globals.css)  
Used for: sidebar active item, icons, text highlights, borders on active states.

## Gray neutrals used:
- **gray-100** → sidebar hover background
- **gray-200** → borders, separators
- **gray-300** → input/dropdown/card borders
- **gray-500** → default icon color
- **gray-700** → inactive sidebar text

## Background
- **white** (set globally)

---

# 3) Radius, Borders, Focus, Transitions

## Radius used:
- **rounded-md (6px)** → inputs, dropdowns, buttons
- **rounded-xl (12px)** → cards
- **rounded-full** → toggle knob, circular chevron button

## Borders:
- **1px gray-300** → inputs, dropdowns, cards, sidebar items

## Focus:
- **focus:ring-brand**
- **focus:border-brand**

## Transitions: 
```
transition-all duration-200 ease-in-out
```
Used for hover, color changes, sidebar width, icons.

---

# 4) Responsiveness

Current behavior:
- Components expand naturally to `w-full` on small screens (if applied)
- Cards and lists stack vertically by default (if applied)

Implement font scaling accordingly for all resolutions: Mobile, Monitor (1080x1920 and 1366x768)

# 5) Reference

1. Use iFood App and Website for both our Menu and Dashboards (respectively).
2. See **/app/dev/ui** for the showcase of all UI components (in **/components/ui**).
3. See **/app/painel/layout.tsx** for a short example of good UI.
4. Important: If any colors, spacings, font feels weird, use your own intuition/criteria to break rules. UI is easy to update if it's wrong.