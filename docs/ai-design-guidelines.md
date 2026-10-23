# iMenu — concise panel design reference for AI changes

This is a **navigation aid, not a new design system**. It summarizes `/design-system.html`, `/app/globals.css`, and actual components under `/components/ui/` on `preview`. Follow the affected page's established patterns first. Open the full `/design-system.html` when this guide is insufficient or when making a significant/new visual change; it remains authoritative.

## Default panel styling

| Token or pattern | Existing value / behavior |
| --- | --- |
| Brand | `#f14400` (`--color-brand`, `--im-brand`) |
| Primary panel action | `#d93d00` (`--im-action`); hover `#c43700` |
| Page/canvas | `#f7f8fa` in the design study; existing panels may have contextual backgrounds |
| Surface/card | White `#ffffff` |
| Soft surface | `#f1f3f5` |
| Borders/dividers | `#e2e5e9` |
| Text | `#1d1d1d` |
| Secondary text | `#626973` |
| Active navigation tint | `#fff1ea`, with accent text `#c43700` in the design study |
| Radius | Cards `10px`, most controls `8px` |
| Base spacing | Study tokens: `16px` gap, `18px` section padding; **follow the existing component's spacing when it differs** |
| Typography | App-wide `iFoodRCTextos` from `app/globals.css`. Preserve sizes/weights of neighboring controls |

The design study contains an optional `warm` direction, but the standard `#f7f8fa` / white / orange scheme above is the default; do not switch directions unless requested. Some colors have dark-mode equivalents in `design-system.html`; preserve any dark-mode behavior already present.

## Existing UI primitives — reuse before writing custom UI

- `components/ui/Button.tsx`: `primary` and `secondary` variants, built-in disabled/loading behavior; the panel primary action is `#d93d00`.
- `components/ui/Input.tsx`, `Textarea.tsx`, `Dropdown.tsx`: established field sizes, labels, outlines, and icon handling.
- `components/ui/Card.tsx`: `10px` radius, subtle border, white background, context-specific padding. Do not add a competing card shell.
- `components/ui/Loader.tsx`: reuse for page and section loading. Keep initial loading separate from saving so autosave does not hide or disable the form; use `SaveStatus.tsx` for persistence feedback.
- `components/ui/DataTable.tsx`: standard bordered table with `13px` text, soft header, consistent padding, loading/empty states.
- `components/ui/Modal.tsx`, `HybridModal.tsx`, `ConfirmModal.tsx`: reuse modal conventions; as documented in `components/ui/README.md`, `Modal` requires an explicit height and `HybridModal` uses a viewport fraction.
- `components/ui/Tabs.tsx`, `Badge.tsx`, `Switch.tsx`, `Tooltip.tsx`, `Toast.tsx`, `Pagination.tsx`: use the existing interactions and feedback patterns.
- Existing restaurant-owner screens live under `app/painel/` and `components/restaurant-owner/`. Inspect the matching page and its siblings before editing.

## Interaction and composition rules

- Settings save automatically by default; use `components/ui/SaveStatus.tsx` for “Salvando...”, “Tudo salvo”, and “Não salvo”. Follow the autosave interactions in `/app/painel/loja/page.tsx` and `/app/painel/disponibilidade/page.tsx`, not older screens with manual save buttons. Add a manual save button only when explicitly requested. Debounce text edits, serialize writes, and verify persistence without a save click; initial loading must not trigger a write.
- Preserve the page's existing navigation, sidebar, responsive widths, spacing, loading states, and semantics. The design study's shell is a visual reference, **not** a mandate to replace real page structure.
- Use the existing orange focus and selection treatments; keep disabled, hover, focus, error, and selected states consistent with the relevant primitive.
- In tables, cards, filters, and dialogs, prefer existing primitives over lookalike one-offs.
- For icon choices, use the icon library/pattern already employed by the affected page.
- Change only the requested area. When an existing page intentionally differs from the study, preserve that behavior unless the user asks to change it.

## Where to check details

- `/design-system.html` — authoritative full interactive design study (large HTML; open only when needed).
- `/app/globals.css` — current app-wide font and theme variables.
- `/components/ui/README.md` — component showcase at `/dev/ui` and modal sizing requirements.
- `/components/ui/*.tsx` — source of truth for actual UI component props and styles.
