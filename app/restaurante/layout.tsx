
// app/restaurante/layout.tsx
"use client"
import Script from "next/script";
import SupportButton, {SupportButtonRef} from "@/components/common/SupportButton";
import {useState, useRef} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCircleQuestion} from "@fortawesome/free-solid-svg-icons";

export default function RestauranteLayout({ children }: { children: React.ReactNode }) {
    const supportBtnRef = useRef<SupportButtonRef>(null);
    const [expanded, setExpanded] = useState(false);
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
            <div className={"w-screen min-h-screen overflow-x-hidden"}>
                <div className={"z-[9999] fixed"}>
                    <SupportButton ref={supportBtnRef} bottomClassName={"bottom-24"} />
                </div>

                {children}
                {/* === BOTÃO DE AJUDA/SUPORTE (Abre via Ref) === */}
                <button
                    onClick={() => supportBtnRef.current?.open()}
                    className={`group flex items-center relative py-3 cursor-pointer transition-all duration-200 w-full text-gray-600 hover:bg-gray-50 hover:text-gray-900 ${
                        expanded ? "justify-start px-5 gap-3" : "justify-center px-0"
                    }`}
                    title={!expanded ? "Ajuda" : ""}
                >
                    <div className="flex items-center justify-center w-6 h-6 2xl:w-12 2xl:h-10">
                        <FontAwesomeIcon
                            icon={faCircleQuestion}
                            className="text-lg 2xl:text-2xl text-gray-400 group-hover:text-gray-600 transition-colors"
                        />
                    </div>
                    <span className={`2xl:text-lg whitespace-nowrap overflow-hidden text-sm transition-all duration-300 ${expanded ? "w-auto opacity-100 ml-0" : "w-0 opacity-0 ml-0"}`}>
                                Ajuda
                            </span>
                </button>

            </div>
        </>
    );
}
