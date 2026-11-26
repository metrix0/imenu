import { renderToStaticMarkup } from "react-dom/server";
import ScrollLoading, { countGroupedItems, visibleGroups } from "./ScrollLoading";

describe("ScrollLoading", () => {
    test.each([10, 30])("mounts just %i rows and exposes the next batch sentinel", batchSize => {
        const data = Array.from({ length: 75 }, (_, i) => i);
        const html = renderToStaticMarkup(<ScrollLoading total={data.length} batchSize={batchSize}>{limit =>
            data.slice(0, limit).map(id => <span key={id} data-row={id} />)
        }</ScrollLoading>);
        expect((html.match(/data-row=/g) || []).length).toBe(batchSize);
        expect(html).toContain('data-ui="scroll-loading"');
    });

    test.each([0, 9, 10])("no sentinel when all %i rows fit", total => {
        const html = renderToStaticMarkup(<ScrollLoading total={total} batchSize={10}>{limit => <span>{limit}</span>}</ScrollLoading>);
        expect(html).toContain(`<span>${total}</span>`);
        expect(html).not.toContain("scroll-loading");
    });

    test("shares a budget across categories without truncating source data", () => {
        const groups = [{ items: Array(25).fill(0) }, { items: Array(16).fill(0) }, { items: [] }, { items: Array(30).fill(0) }];
        const size = (group: typeof groups[number]) => group.items.length;
        expect(countGroupedItems(groups, size)).toBe(72);
        const first = visibleGroups(groups, size, 30);
        expect(first.map(row => row.count)).toEqual([25, 5]);
        expect(first[1].group).toBe(groups[1]);
        expect(first[1].group.items.length).toBe(16);
        expect(visibleGroups(groups, size, 60).map(row => row.count)).toEqual([25, 16, 0, 18]);
        expect(visibleGroups(groups, size, 90).map(row => row.count)).toEqual([25, 16, 0, 30]);
        expect(visibleGroups(groups, size, 0)).toEqual([]);
    });
});
