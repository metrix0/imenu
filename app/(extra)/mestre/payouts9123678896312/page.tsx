"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {icons} from "@/lib/utils/fontawesome";

type RestaurantFinancial = {
    id: string;
    name: string;
    phone: string;
    payment_info: string;
    total_paid_cents: number;
    total_payouts_cents: number;
    value_to_pay_cents: number;
};

export default function AdminPayoutsPage() {
    const [restaurants, setRestaurants] = useState<RestaurantFinancial[]>([]);
    const [loading, setLoading] = useState(true);
    const [payingId, setPayingId] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);

        // 1️⃣ Get all restaurants
        const res = await fetch("/api/mestre/payouts");
        const restData = await res.json();



        const results: RestaurantFinancial[] = [];

        for (const restaurant of restData) {
            // 2️⃣ Sum orders (done + cartao/pix)
            const { data: ordersData } = await supabase
                .from("orders")
                .select("total_cents, payment_method")
                .eq("restaurant_id", restaurant.id)
                .neq("status", "pending_online_payment")
                .neq("status", "canceled")
                .in("payment_method", ["cartao", "pix"]);


            const totalPaid =
                ordersData?.reduce((acc, o: any) => {
                    let value = o.total_cents;

                    if (o.payment_method === "cartao") {
                        value = Math.round(value * 0.97);
                    }

                    if (o.payment_method === "pix") {
                        value = Math.round(value * 0.99);
                    }

                    return acc + value;
                }, 0) || 0;
            // 3️⃣ Sum payouts
            const { data: payoutsData } = await supabase
                .from("payouts")
                .select("amount_cents")
                .eq("restaurant_id", restaurant.id);

            const totalPayouts =
                payoutsData?.reduce((acc, p) => acc + p.amount_cents, 0) || 0;


            results.push({
                id: restaurant.id,
                name: restaurant.name,
                phone: restaurant.phone,
                payment_info: restaurant.payment_info,
                total_paid_cents: totalPaid,
                total_payouts_cents: totalPayouts,
                value_to_pay_cents: totalPaid - totalPayouts,
            });
            console.log(results)
        }

        setRestaurants(results);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleMarkAsPaid = async (restaurant: RestaurantFinancial) => {
        if (restaurant.value_to_pay_cents <= 0) return;

        setPayingId(restaurant.id);

        const { error } = await supabase.from("payouts").insert({
            restaurant_id: restaurant.id,
            amount_cents: restaurant.value_to_pay_cents,
            created_at: new Date().toISOString(),
        });

        if (error) {
            console.error("Erro ao criar payout:", error);
        }

        await fetchData();
        setPayingId(null);
    };

    const formatMoney = (cents: number) =>
        (cents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });

    const totalToPayAll = restaurants.reduce(
        (acc, r) => acc + r.value_to_pay_cents,
        0
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-10">
            <h1 className="text-3xl font-bold mb-8">Controle de Pagamentos</h1>

            <div className={"mb-8 text-2xl font-bold text-red-600 text-center"}>
                <FontAwesomeIcon icon={icons.faLock}/> ANALISAR PAGAMENTOS CANCELADOS ANTES E DELETAR OS PEDIDOS.
            </div>

            <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-xl text-center">
                <p className="text-sm text-gray-500">TOTAL A PAGAR (GERAL)</p>
                <p className="text-3xl font-bold text-green-700">
                    {formatMoney(totalToPayAll)}
                </p>
            </div>

            <div className="grid gap-6">
                {restaurants.sort((a, b) => b.value_to_pay_cents - a.value_to_pay_cents).map((r) => (
                    <div
                        key={r.id}
                        className="bg-white rounded-xl shadow border p-6 flex flex-col gap-4"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold">{r.name}</h2>
                                <p className="text-sm text-gray-500">📞 {r.phone}</p>
                                <p className="text-sm text-gray-500">
                                    💳 PIX: {r.payment_info}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {r.id}
                                </p>
                            </div>

                            <Button
                                onClick={() => handleMarkAsPaid(r)}
                                disabled={
                                    r.value_to_pay_cents <= 0 || payingId === r.id
                                }
                                className="bg-green-600 text-white hover:opacity-90 disabled:opacity-40"
                            >
                                {payingId === r.id ? "Processando..." : "PAID"}
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

                            <div>
                                <p className="text-sm text-gray-500">
                                    Total Já Pago ao Restaurante
                                </p>
                                <p className="text-lg font-bold">
                                    {formatMoney(r.total_payouts_cents)}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-500">
                                    Valor a Pagar Agora
                                </p>
                                <p className="text-lg font-bold text-green-600">
                                    {formatMoney(r.value_to_pay_cents)}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
