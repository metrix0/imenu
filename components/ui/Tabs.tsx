
"use client";
import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";

type TabsProps<T extends string = string> = {
    tabs: T[];
    active: T;
    onChange: (tab: T) => void;
    className?: string;
    childClassName?: string;
};

export default function Tabs<T extends string>({
                                                   tabs,
                                                   active,
                                                   onChange,
                                                   className = "",
                                                   childClassName= "",
                                               }: TabsProps<T>) {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [showRightHint, setShowRightHint] = React.useState(false);

    const updateRightHint = React.useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setShowRightHint(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    }, []);

    React.useEffect(() => {
        updateRightHint();
        const el = scrollRef.current;
        if (!el) return;

        el.addEventListener("scroll", updateRightHint, { passive: true });
        window.addEventListener("resize", updateRightHint);

        return () => {
            el.removeEventListener("scroll", updateRightHint);
            window.removeEventListener("resize", updateRightHint);
        };
    }, [tabs, updateRightHint]);

    return (
        <div className="relative">
            <div
                ref={scrollRef}
                className={`flex gap-2 border-b border-gray-200 overflow-x-auto whitespace-nowrap ${className}`}
            >
                {tabs.map((tab) => (
                    <button
                        data-tab={tab}
                        key={tab}
                        onClick={() => onChange(tab)}
                        className={`shrink-0 px-4 py-2 2xl:py-3 2xl:px-5 font-medium border-b-2 transition-all cursor-pointer 2xl:text-[1.18rem] ${childClassName} ${
                            active === tab
                                ? "border-brand text-brand"
                                : "border-transparent text-gray-600 hover:text-gray-800"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {showRightHint && (
                <button
                    type="button"
                    aria-label="Ver mais abas"
                    onClick={() => scrollRef.current?.scrollBy({ left: 160, behavior: "smooth" })}
                    className="md:hidden absolute inset-y-0 right-0 flex w-12 items-center justify-end pr-1 bg-gradient-to-l from-white via-white/90 to-transparent text-gray-500"
                >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm border border-gray-100">
                        <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                    </span>
                </button>
            )}
        </div>
    );
}
