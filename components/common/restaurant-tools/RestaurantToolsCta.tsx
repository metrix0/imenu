import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCheckCircle,
    faStore,
} from "@fortawesome/free-solid-svg-icons";

export default function RestaurantToolsCta({ title }: { title: string }) {
    return (
        <section className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-orange-50 via-white to-brand/10 p-7 md:p-10">
            <div aria-hidden="true" className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand/10 blur-2xl" />
            <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
                    <FontAwesomeIcon icon={faStore} className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-gray-950">{title}</h2>
                <p className="mt-3 max-w-2xl leading-7 text-gray-600">
                    Você também pode criar seu cardápio, receber pedidos e gerenciar
                    tudo gratuitamente no iMenu.
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-700">
                    <span className="inline-flex items-center gap-2">
                        <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 text-brand" />
                        Cardápio digital
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 text-brand" />
                        Gestão de pedidos
                    </span>
                </div>
                <Link
                    href="/"
                    data-seo-home-link
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand/90"
                >
                    Conhecer o iMenu
                    <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4" />
                </Link>
            </div>
        </section>
    );
}
