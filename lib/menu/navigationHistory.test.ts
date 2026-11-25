import { createMenuBackHistory, type MenuBackLayer } from "./navigationHistory";

function setup() {
    const entries: unknown[] = [{ external: true }, { __NA: true }];
    let index = 1;
    let queued = 0;
    const history = {
        get state() { return entries[index]; },
        pushState(state: unknown) { entries.splice(++index, entries.length, state); },
        replaceState(state: unknown) { entries[index] = state; },
        go(delta: number) { queued += delta; },
    };
    const nav = createMenuBackHistory(history, "/menu", "session");
    const closed: string[] = [];
    const layer = (name: string): MenuBackLayer => ({ close: () => { closed.push(name); } });
    function traverse(delta: number) { index += delta; nav.pop(history.state); }
    function flush() { const delta = queued; queued = 0; if (delta) traverse(delta); }
    return { nav, history, closed, layer, traverse, flush, index: () => index, queued: () => queued };
}

test("native Back closes nested overlays one by one and leaves the base unguarded", () => {
    const t = setup();
    t.nav.sync([t.layer("product"), t.layer("flavor")]);
    expect(t.index()).toBe(3);
    expect(t.history.state).toMatchObject({ __NA: true });
    t.traverse(-1);
    expect(t.closed).toEqual(["flavor"]);
    t.traverse(-1);
    expect(t.closed).toEqual(["flavor", "product"]);
    t.traverse(-1);
    expect(t.index()).toBe(0);
    expect(t.queued()).toBe(0);
});

test("cart steps retreat individually", () => {
    const t = setup();
    t.nav.sync([t.layer("cart")]);
    t.nav.sync([t.layer("cart"), t.layer("info")]);
    t.nav.sync([t.layer("cart"), t.layer("info"), t.layer("payment")]);
    t.traverse(-1);
    t.traverse(-1);
    t.traverse(-1);
    expect(t.closed).toEqual(["payment", "info", "cart"]);
});

test("manual close consumes entries without closing the newly opened overlay", () => {
    const t = setup();
    t.nav.sync([t.layer("cart"), t.layer("info"), t.layer("payment")]);
    t.nav.sync([]);
    expect(t.queued()).toBe(-3);
    t.nav.sync([t.layer("product")]);
    t.flush();
    expect(t.index()).toBe(2);
    expect(t.closed).toEqual([]);
    t.traverse(-1);
    expect(t.closed).toEqual(["product"]);
});

test("replacing search with a product does not create a phantom step", () => {
    const t = setup();
    t.nav.sync([t.layer("search")]);
    t.nav.sync([t.layer("product")]);
    expect(t.index()).toBe(2);
    t.traverse(-1);
    expect(t.closed).toEqual(["product"]);
});

test("manual step back and reopening do not accumulate entries", () => {
    const t = setup();
    t.nav.sync([t.layer("cart"), t.layer("info")]);
    t.nav.sync([t.layer("cart")]);
    t.flush();
    t.nav.sync([t.layer("cart"), t.layer("info")]);
    t.traverse(-1);
    t.traverse(-1);
    expect(t.closed).toEqual(["info", "cart"]);
    expect(t.index()).toBe(1);
});
