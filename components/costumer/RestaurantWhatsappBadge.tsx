import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export type RestaurantWhatsapp = { href: string; formatted: string };

export default function RestaurantWhatsappBadge({ whatsapp }: { whatsapp: RestaurantWhatsapp }) {
    return (
        <a
            href={whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir WhatsApp da loja no número ${whatsapp.formatted}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--im-menu-border,#e5e7eb)] bg-[var(--im-menu-soft,#f9fafb)] px-3 py-2 text-sm font-medium text-[var(--im-menu-text-soft,#374151)] transition hover:border-[var(--im-menu-success-border,#bbf7d0)] hover:bg-[var(--im-menu-success-bg,#f0fdf4)] hover:text-[var(--im-menu-success-text,#15803d)] 2xl:text-lg"
        >
            <FontAwesomeIcon icon={faWhatsapp} className="text-lg text-[var(--im-menu-success-text,#16a34a)] 2xl:text-xl" />
            <span>{whatsapp.formatted}</span>
        </a>
    );
}
