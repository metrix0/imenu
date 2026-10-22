"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

const StartingPriceContext = createContext<ReadonlySet<string>>(new Set());

export default function StartingPriceLabels({
  items,
  children,
}: {
  items: string[];
  children: ReactNode;
}) {
  const itemIds = useMemo(() => new Set(items), [items]);
  return <StartingPriceContext.Provider value={itemIds}>{children}</StartingPriceContext.Provider>;
}

export function StartingPriceLabel({ itemId }: { itemId: string }) {
  return useContext(StartingPriceContext).has(itemId) ? "A partir de " : null;
}
