"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// A shared budget for grouped lists. Empty categories also occupy a visible row.
// Keep the original group and its full items for ordering and bulk operations.
export function countGroupedItems<T>(groups: readonly T[], itemCount: (group: T) => number) {
    return groups.reduce((total, group) => total + Math.max(1, itemCount(group)), 0);
}

export function visibleGroups<T>(groups: readonly T[], itemCount: (group: T) => number, limit: number) {
    const visible: { group: T; count: number }[] = [];
    let remaining = limit;
    for (const group of groups) {
        if (remaining <= 0) break;
        const size = itemCount(group);
        visible.push({ group, count: Math.min(size, remaining) });
        remaining -= Math.max(1, size);
    }
    return visible;
}

/** Mount only the first batch, then append a batch when the end becomes visible.
 *  Use a key to reset when the list's filter or identity changes.
 */
export default function ScrollLoading({ total, batchSize, children }: {
    total: number;
    batchSize: number;
    children: (limit: number) => ReactNode;
}) {
    const [limit, setLimit] = useState(batchSize);
    const [observerUnavailable, setObserverUnavailable] = useState(false);
    const sentinel = useRef<HTMLDivElement>(null);
    const hasMore = total > limit;
    const loadMore = useCallback(() => {
        setLimit(current => current === limit ? current + batchSize : current);
    }, [limit, batchSize]);

    useEffect(() => {
        const target = sentinel.current;
        if (!hasMore || !target) return;
        if (typeof IntersectionObserver === "undefined") {
            setObserverUnavailable(true);
            return;
        }

        let active = true;
        const observer = new IntersectionObserver(entries => {
            if (!active || !entries.some(entry => entry.isIntersecting)) return;
            active = false;
            observer.disconnect();
            loadMore();
        });
        observer.observe(target);
        return () => {
            active = false;
            observer.disconnect();
        };
    }, [hasMore, loadMore]);

    return <>
        {children(Math.min(limit, total))}
        {hasMore && <div ref={sentinel} data-ui="scroll-loading" className="col-span-full min-h-px">
            <button type="button" onClick={loadMore} className={observerUnavailable ? "w-full cursor-pointer py-2 text-center text-sm text-brand" : "sr-only focus:not-sr-only focus:w-full focus:py-2 focus:text-sm focus:text-brand"}>
                Carregar mais
            </button>
        </div>}
    </>;
}
