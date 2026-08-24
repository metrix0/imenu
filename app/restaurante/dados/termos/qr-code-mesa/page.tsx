import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Termos do iMenu QR Code Mesa",
    description:
        "Condições de contratação e uso do sistema iMenu QR Code Mesa.",
};

const SUPPORT_URL =
    "https://wa.me/5519988760900?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20os%20Termos%20do%20iMenu%20QR%20Code%20Mesa.";

export default function QrCodeMesaTermsPage() {
    return (
        <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
            <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                    Sistemas iMenu
                </p>
                <h1 className="mt-3 text-3xl font-bold text-gray-900">
                    Termos do iMenu QR Code Mesa
                </h1>
                <p className="mt-3 text-sm text-gray-500">
                    Última atualização: 24 de agosto de 2026
                </p>

                <div className="mt-8 space-y-8 text-sm leading-7 text-gray-700 sm:text-base">
                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            1. Objeto
                        </h2>
                        <p className="mt-2">
                            Estes termos regulam a contratação e o uso do iMenu
                            QR Code Mesa, sistema adicional ao iMenu Cardápio
                            Digital destinado ao recebimento de pedidos
                            identificados por mesa.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            2. Funcionalidades
                        </h2>
                        <p className="mt-2">
                            O sistema permite cadastrar mesas, gerar QR Codes e
                            links individuais ou universais, receber pedidos
                            identificados no painel e encaminhá-los para a
                            impressão configurada pelo restaurante.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            3. Preço e cobrança recorrente
                        </h2>
                        <p className="mt-2">
                            A assinatura custa R$ 4,90 por mês e é renovada
                            automaticamente no cartão cadastrado até o
                            cancelamento. O pagamento é processado pelo Asaas;
                            o iMenu não armazena os dados completos do cartão.
                            Qualquer alteração de preço será informada antes de
                            produzir efeitos em uma renovação futura.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            4. Ativação
                        </h2>
                        <p className="mt-2">
                            A ativação ocorre após a confirmação do pagamento.
                            Pagamentos pendentes, recusados, vencidos ou
                            estornados podem impedir ou suspender o acesso ao
                            sistema.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            5. Cancelamento
                        </h2>
                        <p className="mt-2">
                            A assinatura pode ser cancelada nas Configurações do
                            painel. O cancelamento interrompe as próximas
                            renovações e, quando houver período já pago, o acesso
                            poderá permanecer disponível até o fim desse
                            período.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            6. Direito de arrependimento
                        </h2>
                        <p className="mt-2">
                            Quando a legislação de consumo for aplicável, o
                            contratante poderá exercer o direito de
                            arrependimento no prazo legal de 7 dias contado da
                            contratação, solicitando o cancelamento e o estorno
                            pelos canais de atendimento do iMenu.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            7. Responsabilidades do restaurante
                        </h2>
                        <p className="mt-2">
                            O restaurante é responsável pelo cadastro correto
                            das mesas, pela instalação e conservação dos QR
                            Codes, pela configuração da impressão e pelo
                            atendimento dos pedidos recebidos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            8. Disponibilidade
                        </h2>
                        <p className="mt-2">
                            O funcionamento pode depender da conexão com a
                            internet, do dispositivo utilizado, da impressora e
                            de serviços de terceiros. O iMenu poderá realizar
                            manutenções e correções necessárias ao sistema.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            9. Privacidade
                        </h2>
                        <p className="mt-2">
                            O tratamento de dados segue a{" "}
                            <Link
                                href="/restaurante/dados/privacidade"
                                className="font-semibold text-brand underline underline-offset-2"
                            >
                                Política de Privacidade do iMenu
                            </Link>
                            .
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            10. Atendimento
                        </h2>
                        <p className="mt-2">
                            Dúvidas, cancelamentos e solicitações relacionadas à
                            assinatura podem ser enviados pelo{" "}
                            <a
                                href={SUPPORT_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-brand underline underline-offset-2"
                            >
                                atendimento do iMenu
                            </a>
                            .
                        </p>
                    </section>
                </div>
            </article>
        </main>
    );
}
