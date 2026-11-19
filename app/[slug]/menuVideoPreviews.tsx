"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type RefObject } from "react";
import type { Category, Item, ItemsByCategory } from "@/lib/types/types";

const PREVIEW_DELAY = 4000;
const PREVIEW_SELECTOR = "[data-menu-preview]";
type Connection = { saveData?: boolean; effectiveType?: string };

export function useMenuVideoPreviews(
    menu: RefObject<HTMLDivElement | null>,
    categories: Category[],
    items: ItemsByCategory,
    search: string,
    enabled: boolean,
) {
    const [active, setActive] = useState<string | null>(null);
    const previewKey = useMemo(() => JSON.stringify(Object.entries(items).flatMap(([category, products]) =>
        products.filter(product => product.gallery_media?.some(media => media.type === "video"))
            .map(product => [category, product.id]),
    )), [items]);
    const warmKey = useMemo(() => JSON.stringify([...new Set(categories.slice(0, 3).flatMap(category =>
        (items[category.id] ?? []).flatMap(item =>
            item.gallery_media?.filter(media => media.type === "video").map(media => media.url) ?? [],
        ),
    ))]), [categories, items]);

    useEffect(() => {
        const container = menu.current;
        if (!container || !enabled) return;

        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
        const connection = (navigator as Navigator & { connection?: Connection }).connection;
        if (connection?.saveData) return;
        const previews = Array.from(container.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR));
        if (!previews.length) return;

        let frame = 0;
        let timeout = 0;
        let selected: HTMLElement | null = null;
        let pointer = { x: -1, y: -1 };
        const onScreen = new Set<HTMLElement>();

        const choose = () => {
            frame = 0;
            let next: HTMLElement | null = null;
            if (!document.hidden && !motion.matches) {
                if (finePointer.matches) {
                    const hovered = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLButtonElement>("button");
                    const focused = document.activeElement?.matches("button:focus-visible") ? document.activeElement : null;
                    for (const button of [hovered, focused]) {
                        const preview = button?.querySelector<HTMLElement>(PREVIEW_SELECTOR);
                        if (preview && onScreen.has(preview)) {
                            next = preview;
                            break;
                        }
                    }
                } else {
                    let nearest = Infinity;
                    for (const preview of onScreen) {
                        const rect = preview.getBoundingClientRect();
                        const distance = Math.hypot(rect.top + rect.height / 2 - window.innerHeight / 2, (rect.left + rect.width / 2 - window.innerWidth / 2) * 0.3);
                        if (distance >= nearest) continue;
                        nearest = distance;
                        next = preview;
                    }
                }
            }

            if (next === selected) return;
            selected = next;
            clearTimeout(timeout);
            setActive(null);
            const id = selected?.dataset.menuPreview;
            if (id) timeout = window.setTimeout(() => {
                if (!document.hidden && !motion.matches) setActive(id);
            }, PREVIEW_DELAY);
        };

        const schedule = () => { if (!frame) frame = requestAnimationFrame(choose); };
        const onPointerMove = (event: PointerEvent) => {
            pointer = { x: event.clientX, y: event.clientY };
            schedule();
        };
        const resetPointer = () => {
            pointer = { x: -1, y: -1 };
            schedule();
        };
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.intersectionRatio >= 0.65) onScreen.add(entry.target as HTMLElement);
                else onScreen.delete(entry.target as HTMLElement);
            }
            schedule();
        }, { threshold: 0.65 });

        previews.forEach(preview => observer.observe(preview));
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.documentElement.addEventListener("pointerleave", resetPointer);
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        container.addEventListener("focusin", schedule);
        container.addEventListener("focusout", schedule);
        document.addEventListener("visibilitychange", schedule);
        motion.addEventListener("change", schedule);

        return () => {
            observer.disconnect();
            window.removeEventListener("pointermove", onPointerMove);
            document.documentElement.removeEventListener("pointerleave", resetPointer);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            container.removeEventListener("focusin", schedule);
            container.removeEventListener("focusout", schedule);
            document.removeEventListener("visibilitychange", schedule);
            motion.removeEventListener("change", schedule);
            cancelAnimationFrame(frame);
            clearTimeout(timeout);
            setActive(null);
        };
    }, [menu, previewKey, search, enabled]);

    useEffect(() => {
        const connection = (navigator as Navigator & { connection?: Connection }).connection;
        if (connection?.saveData || /^(slow-)?2g$/.test(connection?.effectiveType ?? "") ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const urls: string[] = JSON.parse(warmKey);
        if (!urls.length) return;

        let idle = 0;
        let timer = 0;
        let pending: HTMLVideoElement | null = null;
        let stopped = false;
        const stopLoading = () => {
            clearTimeout(timer);
            if (!pending) return;
            pending.onloadedmetadata = null;
            pending.onerror = null;
            pending.removeAttribute("src");
            pending.load();
            pending = null;
        };
        const warmNext = () => {
            if (stopped) return;
            const url = urls.shift();
            if (!url) return;
            pending = document.createElement("video");
            pending.preload = "metadata";
            const next = () => {
                stopLoading();
                queueIdle();
            };
            pending.onloadedmetadata = next;
            pending.onerror = next;
            pending.src = url;
            pending.load();
            timer = window.setTimeout(next, 3000);
        };
        const queueIdle = () => {
            if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(warmNext);
            else timer = window.setTimeout(warmNext, 1000);
        };
        if (document.readyState === "complete") queueIdle();
        else window.addEventListener("load", queueIdle, { once: true });

        return () => {
            stopped = true;
            stopLoading();
            if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
            window.removeEventListener("load", queueIdle);
        };
    }, [warmKey]);

    return enabled ? active : null;
}

export function MenuCardMedia({ item, activeVideoId, className }: {
    item: Item;
    activeVideoId: string | null;
    className: string;
}) {
    const videoUrl = item.gallery_media?.find(media => media.type === "video")?.url;
    return (
        <div data-menu-preview={videoUrl ? item.id : undefined} className={`relative ${className}`}>
            <Image
                src={item.image_public_url || "/placeholders/item.png"}
                width={320}
                height={320}
                className="w-full h-full object-cover"
                alt={item.name}
            />
            {videoUrl && activeVideoId === item.id && <MenuVideoPreview key={videoUrl} url={videoUrl} />}
        </div>
    );
}

function MenuVideoPreview({ url }: { url: string }) {
    const [playing, setPlaying] = useState(false);
    return (
        <video
            src={url}
            autoPlay
            muted
            playsInline
            loop
            aria-hidden="true"
            onPlaying={() => setPlaying(true)}
            onError={() => setPlaying(false)}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${playing ? "" : "opacity-0"}`}
        />
    );
}
