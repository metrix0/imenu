// app/restaurante/layout.tsx

import Script from "next/script";

export default function RestauranteLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <div className="fixed h-screen w-screen inset-0 z-[9999] flex items-center justify-center bg-white  text-black px-6 text-center overflow-hidden md:hidden">
                <p className="text-lg font-normal leading-relaxed">
                    O painel de administrador ainda não pode ser utilizado em celulares. <br /> <br />
                    Continue em um computador ou notebook.
                </p>
            </div>
            <Script id="ms-clarity" strategy="afterInteractive">
                {`
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "uk4ichh2nj");
              `}
            </Script>
            <div className={"w-screen h-screen overflow-x-hidden"}>
            {children}</div>
        </>
    );
}