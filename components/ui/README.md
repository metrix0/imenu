# Showcase and Usage
Access localhost:3000/dev/ui to see the Showcase of all UI Components and how to implement them.

Panel dialogs must declare their own `height` on `Modal` (pixels or a `dvh` value), e.g. `<Modal height={250} open={open} onClose={close}>…</Modal>` for a short category form. There is no default height or size preset. The viewport maximum and scrolling remain handled by `Modal`. `HybridModal` requires its existing viewport fraction, e.g. `height={0.9}`.
