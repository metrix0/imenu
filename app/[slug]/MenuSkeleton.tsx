import ListLoader from "@/components/ui/ListLoader";

export default function MenuSkeleton() {
    return (
        <div className="min-h-screen bg-white text-gray-900 pb-10 animate-pulse">

            {/* ============================
                BANNER
            ============================ */}
            <div className="relative w-full h-[21vh] overflow-hidden">
                <div className="w-full h-full bg-gray-200" />
            </div>

            {/* ============================
                MAIN CARD
            ============================ */}
            <div className="relative -mt-8">

                {/* Logo circle */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 z-20">
                    <div className="w-17 h-17 rounded-full bg-gray-200 border-1 border-gray-300" />
                </div>

                <div className="bg-white mx-5 px-5 py-6 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] space-y-5">

                    {/* Restaurant title */}
                    <div className={"mt-7"}>
                        <ListLoader lines={2} />

                    </div>

                </div>
            </div>

            {/* ============================
                CATEGORY + ITEMS
            ============================ */}
            <div className="mt-10 px-4 space-y-12 pb-20">

                {[1,2].map((i) => (
                    <div key={i}>

                        {/* Category title */}
                        <div className="w-32 mb-4">
                            <ListLoader lines={1} />
                        </div>

                        <div className="grid grid-cols-3 gap-[4dvw]">

                            {[1, 2, 3].map((j) => (
                                <div key={j} className="space-y-2">

                                    {/* Item image */}
                                    <div className="w-full h-[29dvw] bg-gray-200 rounded-2xl shadow-sm" />

                                    {/* Item title + subtitle */}
                                    <ListLoader lines={1} />
                                </div>
                            ))}

                        </div>
                    </div>
                ))}

            </div>
        </div>
    );
}
