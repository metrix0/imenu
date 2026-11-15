import Link from "next/link";
import { faArrowRight, faBullhorn, faRocket } from "@fortawesome/free-solid-svg-icons";
import Card from "@/components/ui/Card";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";

const content = {
    "vendas-ia": {
        icon: faRocket,
        label: "Vendas IA",
        title: "Descubra oportunidades para vender mais",
        description: "O Vendas IA analisa seus pedidos e seu cardápio para recomendar melhorias em produtos, combinações e promoções.",
        href: "/painel/vendas-ia",
        action: "Abrir Vendas IA",
    },
    marketing: {
        icon: faBullhorn,
        label: "Automações de Marketing WhatsApp",
        title: "Transforme seus clientes em novos pedidos",
        description: "Com o iMenu Plus, reative clientes, incentive hábitos de compra e recupere carrinhos com mensagens automáticas pelo WhatsApp.",
        href: "/painel/marketing",
        action: "Abrir Marketing",
    },
} as const;

export default function PanelFeatureCallout({ feature }: { feature: keyof typeof content }) {
    const { icon, label, title, description, href, action } = content[feature];
    return (
        <Card className="overflow-hidden border-brand/20 bg-brand/5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-brand shadow-sm">
                        <FontAwesomeIcon icon={icon} />
                    </span>
                    <div className="min-w-0 max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                            {label}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-gray-900 2xl:text-xl">
                            {title}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-gray-600 2xl:text-base">
                            {description}
                        </p>
                    </div>
                </div>
                <Link
                    href={href}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                >
                    {action}
                    <FontAwesomeIcon icon={faArrowRight} />
                </Link>
            </div>
        </Card>
    );
}
