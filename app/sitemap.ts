import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        { url: "https://www.imenuapp.com.br/", priority: 1 },
        { url: "https://www.imenuapp.com.br/cardapio-digital", priority: 0.9 },
        { url: "https://www.imenuapp.com.br/anota-ai", priority: 0.8 },
        { url: "https://www.imenuapp.com.br/cardapio-digital-gratuito", priority: 0.8 },
        { url: "https://www.imenuapp.com.br/saipos", priority: 0.7 },
        { url: "https://www.imenuapp.com.br/goomer", priority: 0.7 },
        { url: "https://www.imenuapp.com.br/gestor-de-pedidos", priority: 0.7 },
    ];
}