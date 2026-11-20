"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Item, ItemsByCategory } from "@/lib/types/types";

const MOBILE_PREVIEW_DELAY_MS = 2000;
const FEATURED_PREVIEW_DURATION_MS = 5000;
const DESKTOP_HOVER_DELAY_MS = 200;
const DESKTOP_PREVIEW_CACHE_SIZE = 2;
const PREVIEW_SELECTOR = "[data-menu-preview]";
const NO_ACTIVE_PREVIEWS: readonly HTMLElement[] = [];
type Connection = { saveData?: boolean; effectiveType?: string };
type FeaturedPreviewTurn = { onPlaying: () => void; onFinished: () => void };
type ActivePreview = { target: HTMLElement; turn?: FeaturedPreviewTurn };

export function MenuVideoPreviews({ menu, visibleItems, enabled }: {
    menu: RefObject<HTMLDivElement | null>;
    visibleItems: ItemsByCategory;
    enabled: boolean;
}) {
    const [active, setActive] = useState<ActivePreview | null>(null);
    const [recentDesktopPreviews, setRecentDesktopPreviews] = useState(NO_ACTIVE_PREVIEWS);

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
        let selected = NO_ACTIVE_PREVIEWS;
        const onScreen = new Map<HTMLElement, number>();

        const playFeaturedPreview = (queue: readonly HTMLElement[], startIndex: number) => {
            if (selected !== queue || document.hidden || motion.matches) return;

            const index = queue.findIndex((target, i) =>
                i >= startIndex && target.isConnected && onScreen.get(target) === 1,
            );
            if (index === -1) {
                setActive(null);
                return;
            }

            let started = false;
            let finished = false;
            const isCurrentTurn = () => selected === queue && !finished;
            const onFinished = () => {
                if (!isCurrentTurn()) return;
                finished = true;
                clearTimeout(timeout);
                playFeaturedPreview(queue, index + 1);
            };
            const onPlaying = () => {
                if (!isCurrentTurn() || started) return;
                started = true;
                timeout = window.setTimeout(onFinished, FEATURED_PREVIEW_DURATION_MS);
            };
            setActive({ target: queue[index], turn: { onPlaying, onFinished } });
        };

        const choose = () => {
            frame = 0;
            let next: HTMLElement | null = null;
            const desktopHover = finePointer.matches;
            if (!document.hidden && !motion.matches) {
                if (desktopHover) {
                    const hovered = container.querySelector<HTMLButtonElement>("button:hover");
                    const preview = hovered?.querySelector<HTMLElement>(PREVIEW_SELECTOR);
                    if (preview && onScreen.has(preview)) next = preview;
                } else {
                    let nearest = Infinity;
                    const screenCenterY = window.innerHeight / 2;
                    for (const [preview, ratio] of onScreen) {
                        if (ratio < 1) continue;
                        const rect = preview.getBoundingClientRect();
                        const verticalDistance = rect.top + rect.height / 2 - screenCenterY;
                        if (Math.abs(verticalDistance) > screenCenterY / 2) continue;
                        const distance = Math.hypot(verticalDistance, (rect.left + rect.width / 2 - window.innerWidth / 2) * 0.3);
                        if (distance >= nearest) continue;
                        nearest = distance;
                        next = preview;
                    }
                }
            }

            let nextPreviews = next ? [next] : [];
            if (next && !desktopHover) {
                const featuredGrid = next.closest("[data-menu-featured-grid]");
                if (featuredGrid) {
                    const rowTop = next.getBoundingClientRect().top;
                    const row = Array.from(onScreen).flatMap(([preview, ratio]) =>
                        ratio === 1 && featuredGrid.contains(preview) &&
                        Math.abs(preview.getBoundingClientRect().top - rowTop) < 1 ? [preview] : [],
                    ).sort((left, right) =>
                        left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
                    );
                    const first = row.indexOf(next);
                    nextPreviews = [...row.slice(first), ...row.slice(0, first)];
                }
            }

            if (nextPreviews.length === selected.length && nextPreviews.every(preview => selected.includes(preview))) return;
            selected = nextPreviews;
            clearTimeout(timeout);
            setActive(null);
            if (!nextPreviews.length) return;

            timeout = window.setTimeout(() => {
                if (document.hidden || motion.matches) return;
                if (desktopHover && !next?.closest("button")?.matches(":hover")) return;

                if (nextPreviews.length > 1) {
                    playFeaturedPreview(nextPreviews, 0);
                    return;
                }

                const target = nextPreviews[0];
                if (!target.isConnected) return;
                setActive({ target });
                if (desktopHover) {
                    setRecentDesktopPreviews(current => current[0] === target
                        ? current
                        : [target, ...current.filter(preview => preview !== target)].slice(0, DESKTOP_PREVIEW_CACHE_SIZE),
                    );
                }
            }, desktopHover ? DESKTOP_HOVER_DELAY_MS : MOBILE_PREVIEW_DELAY_MS);
        };

        const schedule = () => { if (!frame) frame = requestAnimationFrame(choose); };
        const onPointerModeChange = () => {
            clearTimeout(timeout);
            selected = NO_ACTIVE_PREVIEWS;
            setActive(null);
            setRecentDesktopPreviews(NO_ACTIVE_PREVIEWS);
            schedule();
        };
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.intersectionRatio >= 0.65) onScreen.set(entry.target as HTMLElement, entry.intersectionRatio);
                else onScreen.delete(entry.target as HTMLElement);
            }
            schedule();
        }, { threshold: [0.65, 1] });

        previews.forEach(preview => observer.observe(preview));
        window.addEventListener("pointermove", schedule, { passive: true });
        document.documentElement.addEventListener("pointerleave", schedule);
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        document.addEventListener("visibilitychange", schedule);
        motion.addEventListener("change", schedule);
        finePointer.addEventListener("change", onPointerModeChange);

        return () => {
            observer.disconnect();
            window.removeEventListener("pointermove", schedule);
            document.documentElement.removeEventListener("pointerleave", schedule);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            document.removeEventListener("visibilitychange", schedule);
            motion.removeEventListener("change", schedule);
            finePointer.removeEventListener("change", onPointerModeChange);
            cancelAnimationFrame(frame);
            clearTimeout(timeout);
            selected = NO_ACTIVE_PREVIEWS;
            setActive(null);
            setRecentDesktopPreviews(NO_ACTIVE_PREVIEWS);
        };
    }, [menu, visibleItems, enabled]);

    if (!enabled) return null;

    const previewTargets = new Set(recentDesktopPreviews);
    if (active) previewTargets.add(active.target);
    return Array.from(previewTargets, target => {
        const url = target.dataset.menuPreview;
        if (!url || !target.isConnected) return null;
        const isActive = active?.target === target;
        return createPortal(
            <MenuVideoPreview url={url} active={isActive} turn={isActive ? active.turn : undefined} />,
            target,
            target.dataset.previewItemId,
        );
    });
}

export function MenuCardMedia({ item, className }: { item: Item; className: string }) {
    const videoUrl = item.gallery_media?.find(media => media.type === "video")?.url;
    return (
        <div data-menu-preview={videoUrl} data-preview-item-id={videoUrl ? item.id : undefined} className={`relative ${className}`}>
            <Image
                src={item.image_public_url || "/placeholders/item.png"}
                width={320}
                height={320}
                className="w-full h-full object-cover"
                alt={item.name}
            />
        </div>
    );
}

function MenuVideoPreview({ url, active, turn }: { url: string; active: boolean; turn?: FeaturedPreviewTurn }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);

    const finishTurn = turn?.onFinished;
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (!active) {
            video.pause();
            if (video.currentTime > 0) video.currentTime = 0;
            return;
        }

        let canceled = false;
        void video.play().catch(() => {
            if (!canceled) finishTurn?.();
        });
        return () => {
            canceled = true;
            if (finishTurn) video.pause();
        };
    }, [active, finishTurn, url]);

    return (
        <video
            ref={videoRef}
            src={url}
            muted
            playsInline
            loop={!turn}
            aria-hidden="true"
            onPlaying={() => {
                setPlaying(true);
                turn?.onPlaying();
            }}
            onPause={() => setPlaying(false)}
            onEnded={finishTurn}
            onError={() => {
                setPlaying(false);
                finishTurn?.();
            }}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${active && playing ? "" : "opacity-0"}`}
        />
    );
}
