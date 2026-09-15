
"use client";
import * as React from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
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
                data-ui="tabs"
                className={`flex gap-5 overflow-x-auto whitespace-nowrap border-b border-[#e2e5e9] ${className}`}
            >
                {tabs.map((tab) => (
                    <button
                        data-tab={tab}
                        key={tab}
                        onClick={() => onChange(tab)}
                        className={`shrink-0 cursor-pointer border-b-2 px-0 py-3 text-sm font-medium transition-colors ${childClassName} ${
                            active === tab
                                ? "border-[#d93d00] text-[#c43700]"
                                : "border-transparent text-[#626973] hover:text-[#1d1d1d]"
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
