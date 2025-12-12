import { Suspense } from "react";
import MenuSkeleton from "./loading";
import Script from "next/script"; // wherever you stored it

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<MenuSkeleton />}>
            <Script id="ms-clarity" strategy="afterInteractive">
                {`
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "uk4ichh2nj");
              `}
            </Script>
            {children}
        </Suspense>
    );
}