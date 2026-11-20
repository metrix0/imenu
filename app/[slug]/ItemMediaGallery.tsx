"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import type { PublicItemMedia } from "@/lib/menu/itemMedia";

export default function ItemMediaGallery({ name, image, media = [] }: {
    name: string;
    image?: string | null;
    media?: PublicItemMedia[];
}) {
    const cover = image || "/placeholders/item.png";
    const videoSlide = media.find(slide => slide.type === "video");
    const photos: PublicItemMedia[] = [{ type: "image", url: cover }, ...media.filter(slide => slide.type === "image")];
    const slides = videoSlide ? [videoSlide, ...photos] : photos;
    const firstPhotoIndex = videoSlide ? 1 : 0;
    const container = useRef<HTMLDivElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    const interacted = useRef(false);
    const [active, setActive] = useState(0);
    const [videoFailed, setVideoFailed] = useState(false);
    const activeVideoUrl = slides[active]?.type === "video" ? slides[active].url : null;

    const goTo = (index: number) => {
        const strip = container.current;
        if (!strip || !slides[index]) return;
        interacted.current = true;
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        strip.scrollTo({ left: index * strip.clientWidth, behavior });
    };

    useEffect(() => {
        const element = video.current;
        if (!element) return;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const updatePlayback = () => {
            if (activeVideoUrl && !document.hidden && (!reducedMotion.matches || interacted.current)) {
                element.play().catch(() => undefined);
            } else {
                element.pause();
            }
        };
        updatePlayback();
        document.addEventListener("visibilitychange", updatePlayback);
        return () => document.removeEventListener("visibilitychange", updatePlayback);
    }, [activeVideoUrl]);

    const coverClass = "object-cover md:rounded-br-4xl";
    if (slides.length === 1) {
        return <Image src={cover} alt={name} fill sizes="(min-width: 768px) 50vw, 100vw" className={coverClass} />;
    }

    return (
        <>
            <div
                ref={container}
                aria-label={`Mídias de ${name}`}
                className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] md:rounded-br-4xl"
                onPointerDown={() => { interacted.current = true; }}
                onWheel={event => { if (event.deltaX) interacted.current = true; }}
                onScroll={event => {
                    const strip = event.currentTarget;
                    if (strip.clientWidth) setActive(Math.round(strip.scrollLeft / strip.clientWidth));
                }}
            >
                {slides.map((slide, index) => (
                    <div key={index} className="relative h-full w-full shrink-0 snap-center">
                        {slide.type === "image" || videoFailed ? (
                            <Image src={slide.type === "image" ? slide.url : cover} alt={index > firstPhotoIndex ? `Foto ${index - firstPhotoIndex + 1} de ${name}` : name} fill sizes="(min-width: 768px) 50vw, 100vw" loading="eager" className="object-cover" draggable={false} />
                        ) : (
                            <video
                                ref={video}
                                src={slide.url}
                                poster={cover}
                                preload="auto"
                                muted
                                playsInline
                                loop
                                aria-label={`Vídeo de ${name}`}
                                className="pointer-events-none h-full w-full object-cover"
                                onError={() => setVideoFailed(true)}
                            />
                        )}
                    </div>
                ))}
            </div>
            {[-1, 1].map(direction => {
                const label = direction === -1 ? "Mídia anterior" : "Próxima mídia";
                return (
                    <button type="button" key={direction} aria-label={label} disabled={!slides[active + direction]} className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/50 text-sm text-white disabled:invisible ${direction === -1 ? "left-4" : "right-4"}`} onClick={() => goTo(active + direction)}>
                        <FontAwesomeIcon icon={direction === -1 ? icons.faChevronLeft : faChevronRight} />
                    </button>
                );
            })}
            <div className={`absolute right-4 flex items-center rounded-full bg-black/50 px-1 text-white ${slides[active]?.type === "video" ? "top-6" : "bottom-4"}`}>
                {slides.map((slide, index) => (
                    <button key={index} type="button" aria-label={slide.type === "video" ? "Ver vídeo" : `Ver foto ${index - firstPhotoIndex + 1}`} aria-current={active === index} className="grid h-7 w-5 cursor-pointer place-items-center" onClick={() => goTo(index)}>
                        <span className={`h-1.5 w-1.5 rounded-full bg-white ${active === index ? "" : "opacity-50"}`} />
                    </button>
                ))}
            </div>
        </>
    );
}
