// app/restaurante/layout.tsx
"use client";

import Script from "next/script";
import SupportButton, {
    SupportButtonRef,
} from "@/components/common/SupportButton";
import { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";

export default function RestauranteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supportBtnRef = useRef<SupportButtonRef>(null);
    const [expanded] = useState(false);

    return (
        <>
            <Script id="ms-clarity" strategy="afterInteractive">
                {`
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "uk4ichh2nj");
              `}
            </Script>

            <div className="restaurant-responsive min-h-screen w-full min-w-0 max-w-full overflow-x-hidden">
                <div className="fixed z-[9999]">
                    <SupportButton
                        ref={supportBtnRef}
                        bottomClassName="bottom-24"
                    />
                </div>

                {children}

                <button
                    type="button"
                    onClick={() => supportBtnRef.current?.open()}
                    className={`group relative flex w-full cursor-pointer items-center py-3 text-gray-600 transition-all duration-200 hover:bg-gray-50 hover:text-gray-900 ${
                        expanded
                            ? "justify-start gap-3 px-5"
                            : "justify-center px-0"
                    }`}
                    title={!expanded ? "Ajuda" : ""}
                >
                    <div className="flex h-6 w-6 items-center justify-center 2xl:h-10 2xl:w-12">
                        <FontAwesomeIcon
                            icon={faCircleQuestion}
                            className="text-lg text-gray-400 transition-colors group-hover:text-gray-600 2xl:text-2xl"
                        />
                    </div>
                    <span
                        className={`overflow-hidden text-sm whitespace-nowrap transition-all duration-300 2xl:text-lg ${
                            expanded
                                ? "ml-0 w-auto opacity-100"
                                : "ml-0 w-0 opacity-0"
                        }`}
                    >
                        Ajuda
                    </span>
                </button>
            </div>
        </>
    );
}
