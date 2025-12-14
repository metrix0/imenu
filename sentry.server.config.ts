// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true") {
    Sentry.init({
        dsn: "https://264539c79a7886cbe1ad289277b3e9d8@o4510530476965888.ingest.us.sentry.io/4510530485813248",

        // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
        tracesSampleRate: 1,

        // Enable logs to be sent to Sentry
        enableLogs: true,

        // Enable sending user PII (Personally Identifiable Information)
        // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
        sendDefaultPii: true,
    });
}


