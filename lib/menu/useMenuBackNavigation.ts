"use client";

import { useLayoutEffect, useRef } from "react";
import { createMenuBackHistory, type MenuBackLayer } from "./navigationHistory";

export function useMenuBackNavigation(scope: string, layers: MenuBackLayer[]) {
    const navigation = useRef<ReturnType<typeof createMenuBackHistory> | null>(null);

    useLayoutEffect(() => {
        const url = window.location.href;
        const controller = createMenuBackHistory(window.history, url, String(Date.now()) + Math.random());
        navigation.current = controller;
        const onPop = (event: PopStateEvent) => {
            if (window.location.href === url) controller.pop(event.state);
        };
        window.addEventListener("popstate", onPop);
        return () => {
            window.removeEventListener("popstate", onPop);
            navigation.current = null;
        };
    }, [scope]);

    useLayoutEffect(() => {
        navigation.current?.sync(layers);
    });
}
