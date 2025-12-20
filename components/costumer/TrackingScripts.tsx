"use client";

import Script from "next/script";

type Props = {
    ga4Id?: string | null;
    gtmId?: string | null;
    metaPixelId?: string | null;
    enabled?: boolean;
};

export default function TrackingScripts({
                                            ga4Id,
                                            gtmId,
                                            metaPixelId,
                                            enabled = true,
                                        }: Props) {
    if (!enabled) return null;

    return (
        <>
            {/* Google Tag Manager */}
            {gtmId && (
                <Script
                    src={`https://www.googletagmanager.com/gtm.js?id=${gtmId}`}
                    strategy="afterInteractive"
                />
            )}

            {/* Google Analytics (GA4) — only if GTM is NOT used */}
            {ga4Id && !gtmId && (
                <>
                    <Script
                        src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
                        strategy="afterInteractive"
                    />
                    <Script id="ga4" strategy="afterInteractive">
                        {`
                            window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            gtag('js', new Date());
                            gtag('config', '${ga4Id}', {
                                anonymize_ip: true
                            });
                        `}
                    </Script>
                </>
            )}

            {/* Meta / Facebook Pixel */}
            {metaPixelId && (
                <Script id="meta-pixel" strategy="afterInteractive">
                    {`
                        !function(f,b,e,v,n,t,s){
                            if(f.fbq)return;
                            n=f.fbq=function(){
                                n.callMethod
                                    ? n.callMethod.apply(n,arguments)
                                    : n.queue.push(arguments)
                            };
                            if(!f._fbq)f._fbq=n;
                            n.push=n;
                            n.loaded=!0;
                            n.version='2.0';
                            n.queue=[];
                            t=b.createElement(e);
                            t.async=!0;
                            t.src=v;
                            s=b.getElementsByTagName(e)[0];
                            s.parentNode.insertBefore(t,s);
                        }(window, document,'script',
                        'https://connect.facebook.net/en_US/fbevents.js');

                        fbq('init', '${metaPixelId}');
                        fbq('track', 'PageView');
                    `}
                </Script>
            )}
        </>
    );
}
