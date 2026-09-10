"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faBurger,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import BonusButton from "@/components/ui/BonusButton";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import Footer from "@/components/common/Footer";
import SupportButton, {
    SupportButtonRef,
} from "@/components/common/SupportButton";
import BestSellers from "@/components/landing/BestSellers";
import SignupConfirmationHandler from "@/components/auth/SignupConfirmationHandler";
import "@/app/reveal.css";
import "@/app/landing.css";

const LOGOS = [
    {
        id: 1,
        name: "Restaurante 1",
        src: "/images/Menu_Mockup_Logo_3.png",
        secondSrc: "/images/Menu_Mockup_3.png",
    },
    {
        id: 2,
        name: "Restaurante 2",
        src: "/images/Menu_Mockup_Logo_2.png",
        secondSrc: "/images/Menu_Mockup_2.png",
    },
    {
        id: 3,
        name: "Restaurante 3",
        src: "/images/Menu_Mockup_Logo_1.png",
        secondSrc: "/images/Menu_Mockup_1.png",
    },
];

export default function LandingPage() {
    const router = useRouter();
    const supportBtnRef = useRef<SupportButtonRef>(null);
    const [selected, setSelected] = useState(1);
    const [autoRotate, setAutoRotate] = useState(true);
    const [restCount, setRestCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setLoading(false), 1000);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        void fetch("/api/restaurants/count")
            .then((response) => response.json())
            .then((payload) => {
                const totalBonus = 30;
                setRestCount(
                    Math.max(0, totalBonus - Number(payload?.count || 0))
                );
            })
            .catch(() => setRestCount(0));
    }, []);

    useEffect(() => {
        document.title = "iMenu - Cardápio Digital";
    }, []);

    useEffect(() => {
        const elements = document.querySelectorAll(".reveal");
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1 }
        );

        elements.forEach((element) => observer.observe(element));
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        LOGOS.forEach((logo) => {
            const image = new window.Image();
            image.src = logo.secondSrc;
        });
    }, []);

    useEffect(() => {
        if (!autoRotate) return;

        const timer = window.setInterval(() => {
            setSelected((current) => {
                const index = LOGOS.findIndex((logo) => logo.id === current);
                return LOGOS[(index + 1) % LOGOS.length].id;
            });
        }, 4500);

        return () => window.clearInterval(timer);
    }, [autoRotate]);

    return (
        <div className="landing-page">
            <SignupConfirmationHandler />
            <header className="landing-header flex w-full flex-col items-center justify-between gap-4 border-gray-200 bg-white px-8 py-7 md:flex-row md:gap-0 md:py-5 2xl:py-8">
                <div className="flex items-center gap-2 text-xl font-bold text-brand">
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu Logo"
                        width={200}
                        height={42}
                        className="ml-4 h-6 w-auto cursor-pointer 2xl:ml-8 2xl:h-10"
                        onClick={() => router.push("#")}
                    />
                </div>

                <nav aria-label="Navegação principal" className="z-30 flex items-center gap-8 text-sm font-medium md:z-auto 2xl:gap-11 2xl:text-[1.2rem]">
                    <a href="#" className="hidden transition hover:text-gray-500 md:block">
                        Home
                    </a>
                    <a
                        href="#recursos"
                        className="transition hover:text-gray-500"
                    >
                        Recursos
                    </a>

                    {restCount > 0 && (
                        <Tooltip
                            text={
                                <span>
                                    Para os próximos {restCount} restaurantes que se
                                    cadastrarem: Consultoria grátis de 30 minutos com
                                    time que já assessorou 1M+/mês.{" "}
                                    <u
                                        className="cursor-pointer"
                                        onClick={() =>
                                            router.push("/restaurante/registrar")
                                        }
                                    >
                                        Cadastre-se agora
                                    </u>
                                </span>
                            }
                            size="medium"
                            padding="p-4 2xl:p-6"
                            position="bottom"
                        >
                            <BonusButton>
                                <span className="inline-block">
                                    <span className="text-[0.8rem] 2xl:text-[1.1rem]">
                                        BÔNUS
                                    </span>{" "}
                                    <span className="font-light">
                                        para prox. {restCount} restaurantes
                                    </span>
                                </span>
                            </BonusButton>
                        </Tooltip>
                    )}

                    <div className="hidden h-6 w-px bg-gray-300 md:block 2xl:h-8" />

                    <button
                        type="button"
                        onClick={() => router.push("/restaurante/login")}
                        className="hidden cursor-pointer items-center gap-1 text-gray-600 transition hover:text-gray-500 md:flex"
                    >
                        <FontAwesomeIcon icon={icons.faUser} /> Login
                    </button>

                    <Button
                        className="!hidden md:!block"
                        onClick={() => router.push("/restaurante/registrar")}
                    >
                        Registrar Grátis
                    </Button>
                </nav>
            </header>

            <main id="conteudo">
            <section className="landing-hero landing-container">
                <div className="landing-hero-copy">
                    <span className="landing-eyebrow">Para restaurantes e delivery</span>
                    <h1>O novo Cardápio Digital.<br /><span>100% Gratuito.</span></h1>
                    <p className="landing-lead">Cardápio digital para Restaurantes e Delivery. Pronto em 5 minutos.</p>
                    <div className="landing-actions">
                        <Button onClick={() => router.push("/restaurante/registrar")}>
                            Registrar Grátis <FontAwesomeIcon icon={faArrowRight} />
                        </Button>
                        <button type="button" className="landing-login" onClick={() => router.push("/restaurante/login")}>
                            <FontAwesomeIcon icon={icons.faUser} /> Login
                        </button>
                    </div>
                    <p className="landing-reassurance"><FontAwesomeIcon icon={icons.faCheck} /> Sem taxas, sem pegadinhas. <a href="#recursos">Para sempre.</a></p>
                </div>
                <div className="landing-hero-media">
                    <video src="/images/CellphoneVideo.webm" autoPlay loop muted playsInline aria-label="Demonstração do cardápio digital iMenu" />
                    <span className="landing-media-caption"><FontAwesomeIcon icon={icons.faCheck} /> Seu cardápio, pronto para receber pedidos</span>
                </div>
            </section>

            <section className="landing-showcase landing-container">
                <div className="landing-section-heading reveal fade-up">
                    <span className="landing-eyebrow">Simples para você. Fácil para o cliente.</span>
                    <h2>Totalmente grátis.<br /><span>Sem taxas, sem pegadinhas.</span></h2>
                </div>
                <div className="landing-showcase-grid">
                    <div className="landing-menu-preview">
                        <div id="logos" aria-label="Exemplos de cardápio" className="landing-logo-options">
                            {LOGOS.map((logo) => (
                                <button key={logo.id} type="button" aria-label={`Mostrar ${logo.name}`} aria-pressed={selected === logo.id}
                                    onClick={() => { setSelected(logo.id); setAutoRotate(false); }}>
                                    <Image src={logo.src} alt={logo.name} width={56} height={56} />
                                </button>
                            ))}
                            <button type="button" className="landing-carousel-control" aria-label={autoRotate ? "Pausar exemplos automáticos" : "Retomar exemplos automáticos"}
                                onClick={() => setAutoRotate(!autoRotate)}>{autoRotate ? "Pausar" : "Retomar"}</button>
                        </div>
                        <div className="landing-phone-preview">
                            <Image src={LOGOS.find(logo => logo.id === selected)?.secondSrc || "/iMenu Menu.png"}
                                alt="Preview do cardápio digital" fill sizes="(max-width: 767px) 80vw, 320px" className="object-contain" />
                        </div>
                    </div>
                    <div className="landing-feature-content">
                        <div className="landing-feature-card">
                            <span className="landing-feature-icon"><FontAwesomeIcon icon={icons.faCheck} /></span>
                            <div><h3>Sem taxas</h3><p>Receba 100% do valor que você vendeu.</p></div>
                        </div>
                        <div className="landing-feature-card">
                            <span className="landing-feature-icon"><FontAwesomeIcon icon={faWandMagicSparkles} /></span>
                            <div><h3>Criado em 5 minutos</h3><p>A Inteligência Artificial reconhece a foto ou PDF do seu cardápio.</p></div>
                        </div>
                        <div className="landing-actions">
                            <Button onClick={() => router.push("/restaurante/registrar")}>Registrar Grátis <FontAwesomeIcon icon={faArrowRight} /></Button>
                            <Button variant="secondary" onClick={() => window.location.assign("https://www.imenuapp.com.br/pizzaria-la-grucia")}><FontAwesomeIcon icon={faBurger} /> Ver Exemplo</Button>
                        </div>
                        <div className="landing-monitor">
                            <Image src="/images/MonitorGraph.png" alt="Destaque do painel e resultados" width={1080} height={1920} sizes="(max-width: 767px) 90vw, 600px" />
                        </div>
                    </div>
                </div>
            </section>

            <BestSellers />

            <section
                id="recursos"
                className="landing-comparison landing-container"
            >
                <h2 className="reveal fade-left mb-3 text-center text-4xl font-extrabold text-brand md:text-left 2xl:text-[3.2rem]">
                    Venda mais <span className="hidden md:inline-block">com iMenu</span>
                    <br />
                    <span className="text-text">e lucre mais</span>
                </h2>
                <p className="landing-lead mb-8">
                    Compare os benefícios entre o iMenu e outros cardápios digitais:
                </p>

                <p className="mb-3 text-sm text-gray-500 md:hidden">Deslize a tabela para comparar todos os recursos.</p>
                <div className="landing-table-scroll" tabIndex={0} role="region" aria-label="Comparação de recursos">
                    <table className="m-auto w-auto min-w-[620px] border-collapse overflow-hidden rounded-sm md:w-[80%] 2xl:rounded-lg 2xl:text-[1.4rem]">
                        <thead className="border-b border-gray-200 text-left">
                            <tr className="bg-gray-100">
                                <th className="border-r border-gray-200 p-4 font-medium 2xl:p-6">
                                    Recursos
                                </th>
                                <th className="border-r border-gray-200 p-4 font-medium 2xl:p-6">
                                    <img
                                        src="/logos/CombinationMarkLogo_Black.png"
                                        alt="iMenu"
                                        className="w-18 opacity-70 2xl:w-24"
                                    />
                                </th>
                                <th className="p-4 font-medium 2xl:p-6">Concorrentes</th>
                            </tr>
                        </thead>
                        <tbody className="[&>tr>td]:p-4 [&>tr>td]:2xl:p-6 [&>tr:nth-child(even)]:bg-gray-50">
                            {restCount > 0 && (
                                <tr>
                                    <td className="border-r border-gray-200 text-sm md:text-[100%] md:font-light">
                                        <BonusButton className="hidden md:inline-flex">
                                            <span>
                                                <span className="font-medium">BÔNUS</span>{" "}
                                                <span className="font-light">
                                                    para os prox. {restCount} restaurantes
                                                </span>
                                            </span>
                                        </BonusButton>
                                        <span className="block md:hidden">
                                            <b>BÔNUS</b> para os prox. {restCount} restaurantes
                                        </span>
                                    </td>
                                    <td className="border-r border-gray-200 text-center text-xs leading-tight md:text-[100%]">
                                        Consultoria com time
                                        <br /> que já assessorou 1M+/mês
                                    </td>
                                    <td className="text-center">-</td>
                                </tr>
                            )}
                            {[
                                ["Totalmente grátis, para sempre", "check", "Mensalidade e taxas"],
                                ["Pedidos ilimitados", "check", "Cada vez mais caro"],
                                ["Robô WhatsApp", "check", "Taxas adicionais"],
                                ["Aplicativo para celular", "check", "Não"],
                                ["Converte o cliente", "check", "Baixa Conversão"],
                                ["Gestor de pedidos (balcão)", "check", "Limitado"],
                                ["Suporte humanizado", "Todos os dias", "Robô, fila ou e-mail"],
                                ["Impressão dos pedidos", "check", "Não"],
                                ["Seu domínio customizado", "check", "Não"],
                                ["SEO", "check", "Não otimizado"],
                                ["Acompanhamento do pedido", "Acompanhamento em tempo real via Página e Whatsapp", "Clientes ficam perdidos"],
                                ["Taxa por Transação", "0.99% *apenas para PIX Online*", "5%, 15%, 30%"],
                                ["Scan de Cardápio com IA", "Pronto em segundos", "Manual"],
                                ["Dados para análise", "Clicks, Visualizações do Cardápio, $ médio do Carrinho, Clicks por Plataforma, etc", "Limitado"],
                                ["Calcular Taxa de Entrega", "Pelo Raio", "Configurações confusas"],
                                ["Fotos em Alta qualidade", "check", "Baixa qualidade"],
                                ["Customização de opcionais", "check", "Limitado"],
                                ["Identidade visual personalizada", "check", "Limitado"],
                                ["Sem marca d'água", "check", "Com marca d'água"],
                                ["Link para WhatsApp e redes", "check", "Limitado"],
                                ["Painel Financeiro", "check", "Limitado"],
                                ["Sistema em nuvem", "check", "Não"],
                                ["Google Analytics Integrado", "check", "Limitado"],
                                ["Pixel Meta (Facebook/Instagram) Integrado", "check", "Limitado"],
                                ["Cupons de desconto", "check", "Pouca customização"],
                                ["Sistema disponível para celulares", "check", "Indisponível"],
                                ["Notificações no celular", "check", "Não"],
                                ["QR Code na mesa", "R$ 4,90 por mês", "R$ 99,90 por mês (muito mais caro)"],
                                ["App para garçom", "check", "Pago"],
                                ["Agendamento de pedido", "check", "Não"],
                                ["Sem bugs", "Correção garantida em 2 dias úteis", "Correção leva meses"],
                            ].map(([feature, imenu, competitor]) => (
                                <tr key={feature}>
                                    <td className="border-r border-gray-200">{feature}</td>
                                    <td className="border-r border-gray-200 text-center">
                                        {imenu === "check" ? (
                                            <FontAwesomeIcon
                                                icon={icons.faCheck}
                                                className="text-green"
                                            />
                                        ) : (
                                            imenu
                                        )}
                                    </td>
                                    <td className="text-center">{competitor}</td>
                                </tr>
                            ))}

                            {[
                                ["API Aberta", "-"],
                            ].map(([feature, competitor]) => (
                                <tr key={feature}>
                                    <td className="border-r border-gray-200">{feature}</td>
                                    <td className="border-r border-gray-200 text-center">
                                        <Tooltip
                                            text="Funcionalidade em desenvolvimento."
                                            color="bg-orange"
                                        >
                                            <FontAwesomeIcon
                                                icon={icons.faClock}
                                                className="text-orange"
                                            />
                                        </Tooltip>
                                    </td>
                                    <td className="text-center">{competitor}</td>
                                </tr>
                            ))}

                            {[
                                ["CRM", "Limitado"],
                            ].map(([feature, competitor]) => (
                                <tr key={feature}>
                                    <td className="border-r border-gray-200">{feature}</td>
                                    <td className="border-r border-gray-200 text-center">
                                        <Tooltip
                                            text="Não é uma prioridade no momento."
                                            color="bg-red"
                                        >
                                            <FontAwesomeIcon
                                                icon={icons.faClock}
                                                className="text-red"
                                            />
                                        </Tooltip>
                                    </td>
                                    <td className="text-center">{competitor}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="landing-cta landing-container">
                <div className="landing-cta-card">
                    <span className="landing-eyebrow"><FontAwesomeIcon icon={faWandMagicSparkles} /> 100% gratuito</span>
                    <h2>Seu cardápio pronto em 5 minutos <span>com IA.</span></h2>
                    <p>Crie uma experiência profissional, receba pedidos e gerencie tudo em um só lugar — sem mensalidade e sem pegadinhas.</p>
                    <div className="landing-benefits">
                        {["Pedidos ilimitados", "Cardápio Digital Completo", "Grátis para sempre"].map(benefit => (
                            <span key={benefit}><FontAwesomeIcon icon={icons.faCheck} /> {benefit}</span>
                        ))}
                    </div>
                    <Button onClick={() => router.push("/restaurante/registrar")}>Criar meu cardápio grátis <FontAwesomeIcon icon={faArrowRight} /></Button>
                </div>
            </section>
            </main>

            <Footer />
            <SupportButton
                ref={supportBtnRef}
                bottomClassName={`!transition-normal duration-300 ${
                    loading ? "-bottom-24" : "bottom-6"
                }`}
            />

        </div>
    );
}
