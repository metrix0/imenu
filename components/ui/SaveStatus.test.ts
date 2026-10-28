import { aggregatePageSaveStatus as aggregate } from "./SaveStatus";
test("initial loaded data remains hidden", () => {
    expect(aggregate({a: {status: "saved", changed: false}})).toBe("idle");
});
test("success waits for every changed source", () => {
    expect(aggregate({a: {status: "saved", changed: true}, b: {status: "saving", changed: true}})).toBe("saving");
});
test("failures remain visible even while another source saves", () => {
    expect(aggregate({a: {status: "error", changed: true}, b: {status: "saving", changed: true}})).toBe("error");
});
test("success follows confirmed writes, never an idle reset", () => {
    expect(aggregate({a: {status: "saved", changed: true}})).toBe("saved");
    expect(aggregate({a: {status: "idle", changed: true}})).toBe("error");
});
