// Same-document history for the public menu only. Never add a guard to the main screen.
export type MenuBackLayer = { close: () => void };

const KEY = "__imenuMenuBack";
type Marker = { scope: string; session: string; depth: number };
type HistoryPort = Pick<History, "state" | "pushState" | "replaceState" | "go">;

function readMarker(state: unknown, scope: string): Marker | null {
    const marker = (state as Record<string, Marker> | null)?.[KEY];
    return marker?.scope === scope && typeof marker.session === "string" &&
        Number.isInteger(marker.depth) && marker.depth >= 0 ? marker : null;
}

export function createMenuBackHistory(history: HistoryPort, scope: string, session: string) {
    const initial = readMarker(history.state, scope);
    const owner = initial?.session ?? session;
    let depth = initial?.depth ?? 0;
    let pending: number | null = null;
    let layers: MenuBackLayer[] = [];

    function write(method: "pushState" | "replaceState", nextDepth: number) {
        // Keep Next.js router state and any other history state intact.
        history[method]({ ...history.state, [KEY]: { scope, session: owner, depth: nextDepth } }, "");
    }

    function reconcile() {
        if (pending !== null) return;
        if (depth > layers.length) {
            pending = layers.length;
            history.go(pending - depth);
            return;
        }
        if (depth < layers.length && !readMarker(history.state, scope)) {
            write("replaceState", depth);
        }
        while (depth < layers.length) {
            write("pushState", ++depth);
        }
    }

    function closeTo(target: number) {
        const removed = layers.slice(target);
        layers = layers.slice(0, target);
        for (const layer of removed.reverse()) layer.close();
    }

    return {
        sync(next: MenuBackLayer[]) {
            layers = next;
            reconcile();
        },
        pop(state: unknown) {
            const marker = readMarker(state, scope);
            if (marker && marker.session !== owner) return;
            const previous = depth;
            const target = marker?.depth ?? 0;
            depth = target;

            if (pending !== null) {
                const intended = pending;
                pending = null;
                // A second native Back may have moved further than our own close.
                if (target < intended) closeTo(target);
                reconcile();
            } else if (target < previous) {
                closeTo(target);
                reconcile();
            } else if (target > previous) {
                // Do not reopen a stale product or bypass checkout validation via Forward.
                reconcile();
            }
        },
    };
}
