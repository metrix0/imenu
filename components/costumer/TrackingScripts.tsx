"use client";

import Script from "next/script";

type Props = {
    ga4Id?: string | null;
    gtmId?: string | null;
    metaPixelId?: string | null;
};

const unique = (values: Array<string | null>) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))];

const extractFirst = (value: string, pattern: RegExp) =>
    value.toUpperCase().match(pattern)?.[0] ?? null;

const extractAll = (value: string, pattern: RegExp) =>
    unique(Array.from(value.toUpperCase().matchAll(pattern), (match) => match[0]));

export default function TrackingScripts({
    ga4Id,
    gtmId,
    metaPixelId,
}: Props) {
    // Accept clean IDs and also recover IDs from legacy rows where a complete
    // Google snippet was pasted into one of the fields.
    const googleSource = `${ga4Id ?? ""} ${gtmId ?? ""}`;

    const ga4MeasurementId = extractFirst(googleSource, /G-[A-Z0-9]+/);
    const gtmContainerId = extractFirst(googleSource, /GTM-[A-Z0-9]+/);
    const googleAdsIds = extractAll(googleSource, /AW-[0-9]+/g);

    const googleDestinationIds = unique([
        ga4MeasurementId,
        ...googleAdsIds,
    ]);

    const googleLoaderId = googleDestinationIds[0] ?? null;
    const cleanMetaPixelId = metaPixelId?.trim().match(/^[0-9]{5,25}$/)?.[0] ?? null;

    return (
        <>
            {/* Google Tag (GA4 and/or Google Ads). */}
            {googleLoaderId && (
                <>
                    <Script
                        id={`google-tag-loader-${googleLoaderId}`}
                        src={`https://www.googletagmanager.com/gtag/js?id=${googleLoaderId}`}
                        strategy="afterInteractive"
                    />
                    <Script
                        id={`google-tag-config-${googleDestinationIds.join("-")}`}
                        strategy="afterInteractive"
                    >
                        {`
                            window.dataLayer = window.dataLayer || [];
                            window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
                            window.gtag('js', new Date());
                            ${googleDestinationIds
                                .map((id) => `window.gtag('config', '${id}');`)
                                .join("\n")}
                        `}
                    </Script>
                </>
            )}

            {/* Complete official Google Tag Manager web-container installation. */}
            {gtmContainerId && (
                <>
                    <Script
                        id={`google-tag-manager-${gtmContainerId}`}
                        strategy="afterInteractive"
                    >
                        {`
                            (function(w,d,s,l,i){
                                w[l]=w[l]||[];
                                w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
                                var f=d.getElementsByTagName(s)[0],
                                    j=d.createElement(s),
                                    dl=l!='dataLayer'?'&l='+l:'';
                                j.async=true;
                                j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
                                f.parentNode.insertBefore(j,f);
                            })(window,document,'script','dataLayer','${gtmContainerId}');
                        `}
                    </Script>
                    <noscript>
                        <iframe
                            src={`https://www.googletagmanager.com/ns.html?id=${gtmContainerId}`}
                            height="0"
                            width="0"
                            style={{ display: "none", visibility: "hidden" }}
                            title="Google Tag Manager"
                        />
                    </noscript>
                </>
            )}

            {/* Meta / Facebook Pixel */}
            {cleanMetaPixelId && (
                <>
                    <Script
                        id={`meta-pixel-${cleanMetaPixelId}`}
                        strategy="afterInteractive"
                    >
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

                            fbq('init', '${cleanMetaPixelId}');
                            fbq('track', 'PageView');
                        `}
                    </Script>
                    <noscript>
                        <img
                            height="1"
                            width="1"
                            style={{ display: "none" }}
                            src={`https://www.facebook.com/tr?id=${cleanMetaPixelId}&ev=PageView&noscript=1`}
                            alt=""
                        />
                    </noscript>
                </>
            )}
        </>
    );
}
