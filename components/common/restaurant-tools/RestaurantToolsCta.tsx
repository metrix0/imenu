import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCheckCircle,
    faStore,
} from "@fortawesome/free-solid-svg-icons";

export default function RestaurantToolsCta({ title }: { title: string }) {
    return (
        <section className="relative overflow-hidden rounded-[2rem] border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-orange-100/70 shadow-[0_24px_70px_-36px_rgba(234,88,12,0.55)]">
            <div aria-hidden="true" className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
            <div aria-hidden="true" className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-orange-200/30 blur-3xl" />

            <div className="relative grid md:grid-cols-[1.08fr_0.92fr]">
                <div className="p-7 sm:p-9 md:p-11">
                    <div className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white/80 px-3 py-1.5 text-sm font-semibold text-brand shadow-sm backdrop-blur">
                        <FontAwesomeIcon icon={faStore} className="h-3.5 w-3.5" />
                        iMenu para restaurantes
                    </div>
                    <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-gray-950 md:text-4xl">
                        {title}
                    </h2>
                    <p className="mt-4 max-w-xl leading-7 text-gray-600">
                        Você também pode criar seu cardápio, receber pedidos e gerenciar
                        tudo gratuitamente no iMenu.
                    </p>

                    <div className="mt-6 grid gap-3 text-sm text-gray-700 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                        <span className="inline-flex items-center gap-2 rounded-xl border border-orange-100 bg-white/80 px-3 py-2.5 shadow-sm">
                            <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 shrink-0 text-brand" />
                            Cardápio digital profissional
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-xl border border-orange-100 bg-white/80 px-3 py-2.5 shadow-sm">
                            <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 shrink-0 text-brand" />
                            Pedidos em um só lugar
                        </span>
                    </div>

                    <Link
                        href="/"
                        data-seo-home-link
                        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-lg shadow-brand/20 transition hover:-translate-y-0.5 hover:bg-brand/90 hover:shadow-xl"
                    >
                        Conhecer o iMenu
                        <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4" />
                    </Link>
                </div>

                <div className="relative min-h-[350px] overflow-hidden border-t border-orange-100 bg-white md:min-h-full md:border-l md:border-t-0">
                    <video
                        src="/images/CellphoneVideo.webm"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-orange-50/20" />
                    <div className="absolute right-5 top-5 rounded-full border border-orange-100 bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-md backdrop-blur">
                        Pronto em 5 minutos
                    </div>
                </div>
            </div>
        </section>
    );
}
