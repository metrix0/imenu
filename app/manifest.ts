import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "iMenu — Painel do Restaurante",
        short_name: "iMenu",
        description: "Gerencie pedidos e seu cardápio pelo celular.",
        start_url: "/painel",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#f9fafb",
        theme_color: "#16a34a",
        icons: [
            {
                src: "/icons/appIcon.png",
                sizes: "any",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/appIcon.png",
                sizes: "any",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
