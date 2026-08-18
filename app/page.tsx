"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
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
            { threshold: 0.5 }
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
        <div className="w-full max-w-screen overflow-x-clip">
            <SignupConfirmationHandler />
            <header className="flex w-full flex-col items-center justify-between gap-4 border-gray-200 bg-white px-8 py-7 md:flex-row md:gap-0 md:py-5 2xl:py-8">
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

                <nav className="z-30 flex items-center gap-8 text-sm font-medium md:z-auto 2xl:gap-11 2xl:text-[1.2rem]">
                    <a href="#" className="hidden transition hover:text-gray-500 md:block">
                        Home
                    </a>
                    <a
                        href="#recursos"
                        className="hidden transition hover:text-gray-500 md:block"
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

            <section className="relative mx-auto grid h-full grid-cols-1 gap-10 px-6 py-0 text-center md:h-[89svh] md:grid-cols-2 md:px-15 md:py-20 md:text-left 2xl:px-20">
                <div className="-mt-10 flex flex-col justify-start md:mt-0 md:justify-center">
                    <div className="flex items-center justify-center md:hidden">
                        <div className="relative top-0 z-1 h-120 w-100 overflow-hidden">
                            <video
                                src="/images/CellphoneVideo.webm"
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                        </div>
                    </div>

                    <h1 className="mt-6 mb-2 text-2xl leading-tight font-extrabold text-brand md:-mt-4 md:text-5xl 2xl:text-[4rem]">
                        O novo Cardápio Digital
                        <br />
                        <span className="text-text">100% Gratuito</span>
                    </h1>
                    <h2 className="mt-4 leading-normal text-gray-500 md:mt-0 md:leading-15 2xl:text-[1.4rem]">
                        Cardápio digital para Restaurantes e Delivery. Pronto em 5
                        minutos.
                    </h2>
                    <div className="mt-5 hidden text-gray-500 md:block 2xl:text-[1.4rem]">
                        Sem taxas, sem pegadinhas.{" "}
                        <Tooltip
                            text="O iMenu é completamente grátis, para sempre."
                            position="right"
                        >
                            <a href="#recursos" className="cursor-pointer underline">
                                Para sempre.
                            </a>
                        </Tooltip>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-4 md:justify-start 2xl:mt-9 2xl:gap-6">
                        <Button
                            onClick={() => router.push("/restaurante/registrar")}
                            className="px-6 py-3 text-lg 2xl:px-10 2xl:py-4 2xl:text-[1.6rem]"
                        >
                            Registrar Grátis
                        </Button>
                        <div className="h-6 w-px bg-gray-300" />
                        <button
                            type="button"
                            onClick={() => router.push("/restaurante/login")}
                            className="flex cursor-pointer items-center gap-1 text-gray-600 transition hover:text-gray-500 2xl:text-xl"
                        >
                            <FontAwesomeIcon icon={icons.faUser} /> Login
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-center">
                    <div className="absolute top-0 hidden h-full w-100 overflow-hidden md:block">
                        <video
                            src="/images/CellphoneVideo.webm"
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    </div>
                </div>
            </section>

            <section className="h-auto px-8 py-16 md:min-h-[100vh] 2xl:py-26">
                <h2 className="reveal fade-up mb-4 text-center text-3xl font-extrabold text-brand md:mb-13 md:text-4xl 2xl:mb-20 2xl:text-[3.2rem]">
                    Totalmente Grátis
                    <br />
                    <span className="text-2xl text-text md:text-[100%]">
                        sem taxas, sem pegadinhas
                    </span>
                </h2>

                <div className="flex flex-col gap-4 md:mx-18 md:flex-row md:gap-12">
                    <div className="flex h-auto flex-1 flex-col items-center gap-8 md:flex-row md:items-start md:gap-10 2xl:gap-16">
                        <div
                            id="logos"
                            className="reveal fade-up flex h-full flex-row items-center justify-center gap-5 pt-4 md:flex-col 2xl:gap-8"
                        >
                            {LOGOS.map((logo) => (
                                <button
                                    key={logo.id}
                                    type="button"
                                    onClick={() => {
                                        setSelected(logo.id);
                                        setAutoRotate(false);
                                    }}
                                    className={`cursor-pointer rounded-full p-1 transition-transform duration-300 ${
                                        selected === logo.id
                                            ? "scale-125 opacity-100 md:scale-115"
                                            : "opacity-60"
                                    }`}
                                >
                                    <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-200 duration-200 hover:scale-110 2xl:h-20 2xl:w-20">
                                        <Image
                                            src={logo.src}
                                            alt={logo.name}
                                            width={80}
                                            height={80}
                                            className={`h-full w-full object-contain transition duration-300 ${
                                                selected === logo.id
                                                    ? "grayscale-0"
                                                    : "grayscale-75 md:grayscale-50"
                                            }`}
                                        />
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="delay-300 md:reveal md:fade-right relative z-50 flex h-full flex-1 flex-col gap-8 md:flex-row 2xl:gap-12">
                            <div className="w-full md:w-[45%] 2xl:w-[50%]">
                                <div className="relative mx-auto aspect-[9/16] h-full max-h-[65svh] w-full max-w-sm overflow-hidden">
                                    <div
                                        key={selected}
                                        className="absolute inset-0 animate-fadeUp"
                                    >
                                        <Image
                                            src={
                                                LOGOS.find(
                                                    (logo) =>
                                                        logo.id === selected
                                                )?.secondSrc ||
                                                "/iMenu Menu.png"
                                            }
                                            alt="Preview do cardápio digital"
                                            fill
                                            sizes="(max-width: 768px) 90vw, 35vw"
                                            priority
                                            className="rounded-xl object-contain drop-shadow-[0_5px_5px_rgba(0,0,0,0.1)] 2xl:rounded-2xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="z-40 mt-4 ml-0 flex w-full flex-col justify-center gap-12 text-center md:mt-0 md:ml-3 md:w-[43%] md:text-left 2xl:gap-20">
                                <div>
                                    <h3 className="mb-1 text-lg font-bold 2xl:text-[1.5rem]">
                                        Venda sem taxas
                                    </h3>
                                    <p className="text-gray-500 2xl:text-xl">
                                        Receba 100% do valor que você vendeu.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="mb-1 text-lg font-bold 2xl:text-[1.5rem]">
                                        Criado em 5 minutos
                                    </h3>
                                    <div className="z-50 text-gray-500 2xl:text-xl">
                                        A{" "}
                                        <Tooltip
                                            text="Nossa IA realiza o scan da foto ou PDF do seu cardápio."
                                            position="right"
                                        >
                                            <u className="cursor-pointer">
                                                Inteligência Artificial
                                            </u>
                                        </Tooltip>{" "}
                                        reconhece a foto do seu cardápio.
                                    </div>
                                </div>
                                <Button
                                    onClick={() =>
                                        router.push("/restaurante/registrar")
                                    }
                                    className="mb-3 px-6 py-3 text-lg 2xl:px-10 2xl:py-4 2xl:text-[1.6rem]"
                                >
                                    Registrar Grátis
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-1 mt-10 flex flex-1 items-center justify-center md:mt-0 md:h-[63svh]">
                        <div className="reveal fade-left delay-500 relative z-1 h-full w-full">
                            <Image
                                src="/images/MonitorGraph.png"
                                alt="Destaque do painel e resultados"
                                width={1080}
                                height={1920}
                                className="z-1 mt-0 ml-0 h-[105%] w-auto md:-mt-5 md:ml-7 2xl:-mt-10 2xl:ml-20"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <BestSellers />

            <section
                id="recursos"
                className="mx-0 px-4 pt-30 md:mx-24 md:px-8 md:py-20 2xl:mx-38"
            >
                <h2 className="reveal fade-left mb-3 text-center text-4xl font-extrabold text-brand md:text-left 2xl:text-[3.2rem]">
                    Venda mais <span className="hidden md:inline-block">com iMenu</span>
                    <br />
                    <span className="text-text">e lucre mais</span>
                </h2>
                <h2 className="reveal fade-left delay-200 mb-12 text-center text-gray-500 md:mb-18 md:text-left 2xl:mb-24 2xl:text-xl">
                    Compare os benefícios entre o iMenu e outros cardápios digitais:
                </h2>

                <div className="overflow-x-auto">
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
                                ["Converte o cliente", "check", "Baixa Conversão"],
                                ["Gestor de pedidos (balcão)", "check", "Limitado"],
                                ["Suporte humanizado", "Todos os dias", "Robô, fila ou e-mail"],
                                ["Acompanhamento do pedido", "Acompanhamento em tempo real via Página e Whatsapp", "Clientes ficam perdidos"],
                                ["Calcular Taxa de Entrega", "Pelo Raio", "Configurações confusas"],
                                ["Taxa por Transação", "0.99% apenas para PIX Online", "5%, 15%, 30%"],
                                ["Scan de Cardápio com IA", "Pronto em segundos", "Manual"],
                                ["Dados para análise", "Clicks, Visualizações do Cardápio, $ médio do Carrinho, Clicks por Plataforma, etc", "Limitado"],
                                ["Fotos e Vídeos dos produtos", "check", "Baixa qualidade"],
                                ["Customização de opcionais", "check", "Limitado"],
                                ["Identidade visual personalizada", "check", "Limitado"],
                                ["Sem marca d'água", "check", "Com marca d'água"],
                                ["Link para WhatsApp e redes", "check", "Limitado"],
                                ["Painel Financeiro", "check", "Limitado"],
                                ["Sistema em nuvem", "check", "Não"],
                                ["Google Analytics Integrado", "check", "Limitado"],
                                ["Pixel Meta (Facebook/Instagram) Integrado", "check", "Limitado"],
                                ["Impressão dos pedidos", "check", "Não"],
                                ["Cupons de desconto", "check", "Pouca customização"],
                                ["Sistema disponível para celulares", "check", "Indisponível"],
                                ["Notificações no celular", "check", "Não"],
                                ["Aplicativo para celular", "check", "Não"],
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
                                ["Agendamento de pedido", "Não"],
                                ["QR Code na mesa", "Nem sempre disponível"],
                                ["Pedidos via Instagram / Facebook", "Não"],
                                ["Rastreio de Motoboy", "Clientes ficam perdidos"],
                                ["Comanda Mobile", "Taxas adicionais"],
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

            <section className="relative mx-6 mt-20 md:mx-24 2xl:mx-38">
                <div aria-hidden="true" className="absolute inset-x-10 -bottom-5 h-16 rounded-full bg-brand/30 blur-2xl" />
                <div className="relative isolate overflow-hidden rounded-[2rem] border border-orange-300/60 bg-gradient-to-br from-[#ff7424] via-brand to-dark-brand px-6 py-14 text-center text-white shadow-[0_34px_90px_-34px_rgba(201,63,11,0.9)] md:px-12 md:py-18 2xl:py-24">
                    <div aria-hidden="true" className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
                    <div aria-hidden="true" className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-orange-200/25 blur-3xl" />
                    <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
                    <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
                    <div aria-hidden="true" className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

                    <div className="relative mx-auto max-w-4xl">
                        <span className="inline-flex items-center gap-2.5 rounded-full border border-white/25 bg-white/15 py-1.5 pl-1.5 pr-4 text-sm font-semibold shadow-lg shadow-orange-950/10 backdrop-blur-md 2xl:text-lg">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand shadow-sm 2xl:h-9 2xl:w-9">
                                <FontAwesomeIcon icon={faWandMagicSparkles} className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                            </span>
                            100% gratuito
                        </span>
                        <h2 className="mx-auto mt-6 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl 2xl:text-[4rem]">
                            Seu cardápio pronto em 5 minutos{" "}
                            <span className="relative inline-block whitespace-nowrap">
                                <span className="relative z-10">com IA.</span>
                                <span aria-hidden="true" className="absolute inset-x-0 bottom-1 h-3 -rotate-1 rounded-full bg-orange-200/35 2xl:bottom-2 2xl:h-4" />
                            </span>
                        </h2>
                        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/85 md:text-lg 2xl:text-2xl 2xl:leading-9">
                            Crie uma experiência profissional, receba pedidos e gerencie
                            tudo em um só lugar — sem mensalidade e sem pegadinhas.
                        </p>

                        <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-sm font-semibold text-white/95 sm:grid-cols-3 2xl:max-w-4xl 2xl:text-xl">
                            {["Pedidos ilimitados", "Cardápio Digital Completo", "Grátis para sempre"].map((benefit) => (
                                <span key={benefit} className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-lg shadow-orange-950/10 backdrop-blur-sm">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand 2xl:h-7 2xl:w-7">
                                        <FontAwesomeIcon icon={icons.faCheck} className="h-2.5 w-2.5 2xl:h-3.5 2xl:w-3.5" />
                                    </span>
                                    {benefit}
                                </span>
                            ))}
                        </div>

                        <Button
                            onClick={() => router.push("/restaurante/registrar")}
                            className="group mt-9 gap-3 !rounded-2xl !bg-white !px-6 !py-3 !text-base !font-bold !text-brand shadow-2xl shadow-orange-950/20 hover:!-translate-y-1 hover:!bg-orange-50 hover:!shadow-[0_24px_50px_-18px_rgba(92,28,5,0.65)] 2xl:!px-9 2xl:!py-4 2xl:!text-2xl"
                        >
                            Criar meu cardápio grátis
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white transition-transform group-hover:translate-x-0.5 2xl:h-10 2xl:w-10">
                                <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                            </span>
                        </Button>
                    </div>
                </div>
            </section>

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