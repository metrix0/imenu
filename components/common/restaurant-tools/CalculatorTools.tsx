"use client";

import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBoxOpen,
    faCalculator,
    faCalendarDays,
    faCashRegister,
    faChartLine,
    faClipboardList,
    faPercent,
    faPlus,
    faReceipt,
    faSliders,
    faTag,
    faTicket,
    faTrash,
    faWallet,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import {
    formatCurrency,
    formatNumber,
    formatPercent,
    Notice,
    NumberField,
    ResultGrid,
    ResultItem,
    ToolPanel,
} from "@/components/common/restaurant-tools/ToolUi";

export function CalculatorTool({ tool }: { tool: string }) {
    switch (tool) {
        case "calculadora-taxas-ifood":
            return <IfoodFeeCalculator />;
        case "calculadora-preco-de-venda":
            return <SalePriceCalculator />;
        case "calculadora-margem-delivery":
            return <DeliveryMarginCalculator />;
        case "calculadora-ticket-medio":
            return <AverageTicketCalculator />;
        case "calculadora-comissao-delivery":
            return <DeliveryCommissionCalculator />;
        case "calculadora-cmv":
            return <CmvCalculator />;
        case "calculadora-preco-combo":
            return <ComboPriceCalculator />;
        default:
            return null;
    }
}

type IfoodPlan = "basico" | "entrega" | "personalizado";

const IFOOD_PLANS: Record<
    Exclude<IfoodPlan, "personalizado">,
    { commission: number; paymentFee: number; monthlyFee: number }
> = {
    basico: { commission: 12, paymentFee: 3.2, monthlyFee: 110 },
    entrega: { commission: 23, paymentFee: 3.2, monthlyFee: 150 },
};

function IfoodFeeCalculator() {
    const [plan, setPlan] = useState<IfoodPlan>("basico");
    const [revenue, setRevenue] = useState(30000);
    const [ticket, setTicket] = useState(50);
    const [onlineShare, setOnlineShare] = useState(100);
    const [commission, setCommission] = useState(12);
    const [paymentFee, setPaymentFee] = useState(3.2);
    const [monthlyFee, setMonthlyFee] = useState(110);
    const [monthlyThreshold, setMonthlyThreshold] = useState(1800);

    const selectPlan = (value: IfoodPlan) => {
        setPlan(value);
        if (value === "personalizado") return;
        const preset = IFOOD_PLANS[value];
        setCommission(preset.commission);
        setPaymentFee(preset.paymentFee);
        setMonthlyFee(preset.monthlyFee);
    };

    const safeRevenue = Math.max(0, revenue);
    const commissionCost = safeRevenue * (Math.max(0, commission) / 100);
    const onlineRevenue = safeRevenue * (Math.min(100, Math.max(0, onlineShare)) / 100);
    const paymentCost = onlineRevenue * (Math.max(0, paymentFee) / 100);
    const chargedMonthlyFee = safeRevenue > Math.max(0, monthlyThreshold)
        ? Math.max(0, monthlyFee)
        : 0;
    const total = commissionCost + paymentCost + chargedMonthlyFee;
    const orders = ticket > 0 ? safeRevenue / ticket : 0;
    const effectiveRate = safeRevenue > 0 ? (total / safeRevenue) * 100 : 0;

    return (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <ToolPanel
                title="Dados da operação"
                description="Use os valores do seu contrato. Os presets são apenas uma referência editável."
                icon={faSliders}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Dropdown
                        label="Plano"
                        value={plan}
                        onChange={(event) => selectPlan(event.target.value as IfoodPlan)}
                        options={[
                            { value: "basico", label: "Plano Básico" },
                            { value: "entrega", label: "Plano Entrega" },
                            { value: "personalizado", label: "Meu contrato" },
                        ]}
                    />
                    <NumberField
                        label="Faturamento mensal no iFood"
                        value={revenue}
                        onChange={setRevenue}
                        prefix="R$"
                        step={100}
                    />
                    <NumberField
                        label="Ticket médio"
                        value={ticket}
                        onChange={setTicket}
                        prefix="R$"
                    />
                    <NumberField
                        label="Pedidos pagos no app"
                        value={onlineShare}
                        onChange={setOnlineShare}
                        suffix="%"
                        max={100}
                    />
                    <NumberField
                        label="Comissão"
                        value={commission}
                        onChange={(value) => {
                            setPlan("personalizado");
                            setCommission(value);
                        }}
                        suffix="%"
                        max={100}
                    />
                    <NumberField
                        label="Taxa de pagamento online"
                        value={paymentFee}
                        onChange={(value) => {
                            setPlan("personalizado");
                            setPaymentFee(value);
                        }}
                        suffix="%"
                        max={100}
                    />
                    <NumberField
                        label="Mensalidade"
                        value={monthlyFee}
                        onChange={(value) => {
                            setPlan("personalizado");
                            setMonthlyFee(value);
                        }}
                        prefix="R$"
                    />
                    <NumberField
                        label="Cobrar mensalidade acima de"
                        value={monthlyThreshold}
                        onChange={setMonthlyThreshold}
                        prefix="R$"
                        step={100}
                    />
                </div>
                <Notice>
                    Taxas e condições podem variar por contrato, região e campanha. Confirme os valores no Portal do Parceiro. Impostos, produção, embalagem, entrega e eventuais promoções não estão incluídos.
                </Notice>
            </ToolPanel>

            <ToolPanel title="Estimativa mensal" icon={faChartLine}>
                <ResultGrid>
                    <ResultItem label="Comissão" value={formatCurrency(commissionCost)} />
                    <ResultItem label="Pagamento online" value={formatCurrency(paymentCost)} />
                    <ResultItem
                        label="Mensalidade"
                        value={formatCurrency(chargedMonthlyFee)}
                        description={
                            chargedMonthlyFee === 0
                                ? "Abaixo do limite informado"
                                : "Aplicada conforme o limite informado"
                        }
                    />
                    <ResultItem
                        label="Custo por pedido"
                        value={orders > 0 ? formatCurrency(total / orders) : "—"}
                    />
                    <ResultItem
                        label="Custo total estimado"
                        value={formatCurrency(total)}
                        description={`${formatPercent(effectiveRate)} do faturamento`}
                        danger={total > safeRevenue && safeRevenue > 0}
                    />
                    <ResultItem
                        label="Líquido após as taxas"
                        value={formatCurrency(Math.max(0, safeRevenue - total))}
                        highlight
                    />
                </ResultGrid>
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-900">
                        Potencial preservado em pedidos diretos: {formatCurrency(total)} por mês
                    </p>
                    <p className="mt-1 text-xs leading-5 text-green-800">
                        Comparação apenas com a comissão e mensalidade de plataforma do iMenu, que são R$ 0. Meios de pagamento e logística, quando usados, continuam sendo custos da operação.
                    </p>
                </div>
            </ToolPanel>
        </div>
    );
}

function SalePriceCalculator() {
    const [recipeCost, setRecipeCost] = useState(120);
    const [yieldCount, setYieldCount] = useState(12);
    const [packaging, setPackaging] = useState(1.5);
    const [otherCost, setOtherCost] = useState(0.5);
    const [targetFoodCost, setTargetFoodCost] = useState(30);

    const ingredientCost = yieldCount > 0 ? recipeCost / yieldCount : 0;
    const unitCost = ingredientCost + Math.max(0, packaging) + Math.max(0, otherCost);
    const suggestedPrice = targetFoodCost > 0
        ? unitCost / (Math.min(100, targetFoodCost) / 100)
        : 0;
    const grossProfit = Math.max(0, suggestedPrice - unitCost);
    const markup = unitCost > 0 ? suggestedPrice / unitCost : 0;

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <ToolPanel title="Ficha de custo" icon={faClipboardList}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label="Custo total da receita" value={recipeCost} onChange={setRecipeCost} prefix="R$" />
                    <NumberField label="Rendimento em porções" value={yieldCount} onChange={setYieldCount} suffix="un" step={1} />
                    <NumberField label="Embalagem por unidade" value={packaging} onChange={setPackaging} prefix="R$" />
                    <NumberField label="Outros custos por unidade" value={otherCost} onChange={setOtherCost} prefix="R$" />
                    <NumberField label="Meta de food cost" value={targetFoodCost} onChange={setTargetFoodCost} suffix="%" max={100} />
                </div>
                <Notice>
                    Esta conta é uma referência de preço pelo custo do produto. Valide também impostos, comissões, custos fixos, concorrência e valor percebido.
                </Notice>
            </ToolPanel>
            <ToolPanel title="Preço sugerido" icon={faTag}>
                <ResultGrid>
                    <ResultItem label="Ingredientes por porção" value={formatCurrency(ingredientCost)} />
                    <ResultItem label="Custo unitário total" value={formatCurrency(unitCost)} />
                    <ResultItem label="Preço de venda sugerido" value={formatCurrency(suggestedPrice)} highlight />
                    <ResultItem label="Sobra bruta por unidade" value={formatCurrency(grossProfit)} />
                    <ResultItem label="Markup sobre o custo" value={`${formatNumber(markup, 2)}x`} />
                    <ResultItem label="Food cost no preço" value={formatPercent(targetFoodCost)} />
                </ResultGrid>
            </ToolPanel>
        </div>
    );
}

function DeliveryMarginCalculator() {
    const [price, setPrice] = useState(50);
    const [foodCost, setFoodCost] = useState(15);
    const [packaging, setPackaging] = useState(3);
    const [commission, setCommission] = useState(12);
    const [paymentFee, setPaymentFee] = useState(3.2);
    const [tax, setTax] = useState(6);
    const [deliverySubsidy, setDeliverySubsidy] = useState(0);
    const [otherVariable, setOtherVariable] = useState(1);
    const [fixedCosts, setFixedCosts] = useState(5000);
    const [monthlyOrders, setMonthlyOrders] = useState(400);

    const percentageCosts = price * (Math.max(0, commission + paymentFee + tax) / 100);
    const variableCosts = foodCost + packaging + deliverySubsidy + otherVariable + percentageCosts;
    const contribution = price - variableCosts;
    const contributionMargin = price > 0 ? (contribution / price) * 100 : 0;
    const breakEven = contribution > 0 ? Math.ceil(fixedCosts / contribution) : 0;
    const monthlyResult = contribution * Math.max(0, monthlyOrders) - Math.max(0, fixedCosts);

    return (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <ToolPanel title="Custos por pedido" icon={faReceipt}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label="Preço de venda" value={price} onChange={setPrice} prefix="R$" />
                    <NumberField label="Ingredientes / CMV" value={foodCost} onChange={setFoodCost} prefix="R$" />
                    <NumberField label="Embalagem" value={packaging} onChange={setPackaging} prefix="R$" />
                    <NumberField label="Comissão" value={commission} onChange={setCommission} suffix="%" max={100} />
                    <NumberField label="Taxa de pagamento" value={paymentFee} onChange={setPaymentFee} suffix="%" max={100} />
                    <NumberField label="Impostos sobre a venda" value={tax} onChange={setTax} suffix="%" max={100} />
                    <NumberField label="Frete subsidiado pela loja" value={deliverySubsidy} onChange={setDeliverySubsidy} prefix="R$" />
                    <NumberField label="Outros custos variáveis" value={otherVariable} onChange={setOtherVariable} prefix="R$" />
                    <NumberField label="Custos fixos mensais" value={fixedCosts} onChange={setFixedCosts} prefix="R$" step={100} />
                    <NumberField label="Pedidos por mês" value={monthlyOrders} onChange={setMonthlyOrders} suffix="un" step={1} />
                </div>
            </ToolPanel>
            <ToolPanel title="Margem e ponto de equilíbrio" icon={faChartLine}>
                <ResultGrid>
                    <ResultItem label="Custos variáveis" value={formatCurrency(variableCosts)} />
                    <ResultItem
                        label="Margem por pedido"
                        value={formatCurrency(contribution)}
                        description={formatPercent(contributionMargin)}
                        highlight={contribution > 0}
                        danger={contribution <= 0}
                    />
                    <ResultItem
                        label="Ponto de equilíbrio"
                        value={contribution > 0 ? `${formatNumber(breakEven, 0)} pedidos` : "Sem equilíbrio"}
                    />
                    <ResultItem
                        label="Resultado mensal estimado"
                        value={formatCurrency(monthlyResult)}
                        description="Antes de investimentos e despesas não informadas"
                        highlight={monthlyResult >= 0}
                        danger={monthlyResult < 0}
                    />
                </ResultGrid>
                {contribution <= 0 && (
                    <Notice>Os custos variáveis são iguais ou maiores que o preço. Revise preço, porção, taxas ou subsídio antes de vender.</Notice>
                )}
            </ToolPanel>
        </div>
    );
}

function AverageTicketCalculator() {
    const [revenue, setRevenue] = useState(30000);
    const [orders, setOrders] = useState(600);
    const [targetTicket, setTargetTicket] = useState(55);
    const [upsellValue, setUpsellValue] = useState(8);
    const [acceptance, setAcceptance] = useState(20);

    const ticket = orders > 0 ? revenue / orders : 0;
    const targetRevenue = Math.max(0, orders) * Math.max(0, targetTicket);
    const targetDifference = targetRevenue - revenue;
    const expectedUpsell = upsellValue * (Math.min(100, Math.max(0, acceptance)) / 100);
    const projectedTicket = ticket + expectedUpsell;
    const projectedRevenue = projectedTicket * Math.max(0, orders);

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <ToolPanel title="Vendas do período" icon={faCashRegister}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label="Faturamento" value={revenue} onChange={setRevenue} prefix="R$" step={100} />
                    <NumberField label="Pedidos concluídos" value={orders} onChange={setOrders} suffix="un" step={1} />
                    <NumberField label="Meta de ticket médio" value={targetTicket} onChange={setTargetTicket} prefix="R$" />
                    <NumberField label="Valor do adicional sugerido" value={upsellValue} onChange={setUpsellValue} prefix="R$" />
                    <NumberField label="Aceitação estimada do adicional" value={acceptance} onChange={setAcceptance} suffix="%" max={100} />
                </div>
            </ToolPanel>
            <ToolPanel title="Ticket e simulações" icon={faTicket}>
                <ResultGrid>
                    <ResultItem label="Ticket médio atual" value={formatCurrency(ticket)} highlight />
                    <ResultItem label="Faturamento na meta" value={formatCurrency(targetRevenue)} />
                    <ResultItem
                        label="Diferença para a meta"
                        value={formatCurrency(Math.abs(targetDifference))}
                        description={targetDifference >= 0 ? "Receita adicional necessária" : "Meta já superada"}
                    />
                    <ResultItem label="Ticket com o adicional" value={formatCurrency(projectedTicket)} />
                    <ResultItem label="Faturamento simulado" value={formatCurrency(projectedRevenue)} />
                    <ResultItem
                        label="Impacto estimado"
                        value={formatCurrency(projectedRevenue - revenue)}
                        description="Mantendo a mesma quantidade de pedidos"
                    />
                </ResultGrid>
            </ToolPanel>
        </div>
    );
}

function DeliveryCommissionCalculator() {
    const [orderValue, setOrderValue] = useState(50);
    const [commission, setCommission] = useState(18);
    const [paymentFee, setPaymentFee] = useState(3.2);
    const [fixedFee, setFixedFee] = useState(0);
    const [deliveryCost, setDeliveryCost] = useState(0);
    const [desiredNet, setDesiredNet] = useState(40);

    const percentage = Math.max(0, commission + paymentFee) / 100;
    const percentageFees = orderValue * percentage;
    const totalFees = percentageFees + fixedFee + deliveryCost;
    const net = orderValue - totalFees;
    const effectiveRate = orderValue > 0 ? (totalFees / orderValue) * 100 : 0;
    const remainingRate = 1 - percentage;
    const requiredPrice = remainingRate > 0
        ? (desiredNet + fixedFee + deliveryCost) / remainingRate
        : 0;

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <ToolPanel title="Condições do canal" icon={faPercent}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label="Valor do pedido" value={orderValue} onChange={setOrderValue} prefix="R$" />
                    <NumberField label="Comissão" value={commission} onChange={setCommission} suffix="%" max={100} />
                    <NumberField label="Taxa de pagamento" value={paymentFee} onChange={setPaymentFee} suffix="%" max={100} />
                    <NumberField label="Taxa fixa por pedido" value={fixedFee} onChange={setFixedFee} prefix="R$" />
                    <NumberField label="Custo ou subsídio de entrega" value={deliveryCost} onChange={setDeliveryCost} prefix="R$" />
                    <NumberField label="Valor líquido desejado" value={desiredNet} onChange={setDesiredNet} prefix="R$" />
                </div>
            </ToolPanel>
            <ToolPanel title="Resultado por pedido" icon={faWallet}>
                <ResultGrid>
                    <ResultItem label="Taxas percentuais" value={formatCurrency(percentageFees)} />
                    <ResultItem label="Custo total do canal" value={formatCurrency(totalFees)} description={formatPercent(effectiveRate)} />
                    <ResultItem label="Valor líquido" value={formatCurrency(net)} highlight={net >= 0} danger={net < 0} />
                    <ResultItem
                        label="Preço para a meta líquida"
                        value={remainingRate > 0 ? formatCurrency(requiredPrice) : "Impossível"}
                        description="Preço mínimo considerando somente os custos informados"
                    />
                </ResultGrid>
                {remainingRate <= 0 && <Notice>A soma das taxas percentuais precisa ser menor que 100%.</Notice>}
            </ToolPanel>
        </div>
    );
}

function CmvCalculator() {
    const [openingInventory, setOpeningInventory] = useState(10000);
    const [purchases, setPurchases] = useState(20000);
    const [closingInventory, setClosingInventory] = useState(8000);
    const [sales, setSales] = useState(50000);
    const [target, setTarget] = useState(30);

    const cmv = openingInventory + purchases - closingInventory;
    const cmvPercent = sales > 0 ? (cmv / sales) * 100 : 0;
    const grossProfit = sales - cmv;
    const targetValue = sales * (Math.max(0, target) / 100);
    const difference = cmv - targetValue;
    const averageInventory = (openingInventory + closingInventory) / 2;
    const turnover = averageInventory > 0 ? cmv / averageInventory : 0;

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <ToolPanel title="Dados do período" icon={faCalendarDays}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label="Estoque inicial" value={openingInventory} onChange={setOpeningInventory} prefix="R$" step={100} />
                    <NumberField label="Compras" value={purchases} onChange={setPurchases} prefix="R$" step={100} />
                    <NumberField label="Estoque final" value={closingInventory} onChange={setClosingInventory} prefix="R$" step={100} />
                    <NumberField label="Vendas líquidas" value={sales} onChange={setSales} prefix="R$" step={100} />
                    <NumberField label="Meta de CMV" value={target} onChange={setTarget} suffix="%" max={100} />
                </div>
            </ToolPanel>
            <ToolPanel title="CMV do período" icon={faCalculator}>
                <ResultGrid>
                    <ResultItem label="CMV" value={formatCurrency(cmv)} highlight={cmv >= 0} danger={cmv < 0} />
                    <ResultItem label="CMV percentual" value={formatPercent(cmvPercent)} />
                    <ResultItem label="Lucro bruto" value={formatCurrency(grossProfit)} />
                    <ResultItem label="CMV na meta" value={formatCurrency(targetValue)} />
                    <ResultItem
                        label={difference > 0 ? "Acima da meta" : "Abaixo da meta"}
                        value={formatCurrency(Math.abs(difference))}
                        danger={difference > 0}
                    />
                    <ResultItem label="Giro do estoque" value={`${formatNumber(turnover, 2)}x`} />
                </ResultGrid>
                {cmv < 0 && <Notice>CMV negativo normalmente indica datas de corte diferentes ou algum valor de estoque ou compras incorreto.</Notice>}
            </ToolPanel>
        </div>
    );
}

type ComboItem = { id: number; name: string; price: number; cost: number };

function ComboPriceCalculator() {
    const [items, setItems] = useState<ComboItem[]>([
        { id: 1, name: "Hambúrguer", price: 32, cost: 11 },
        { id: 2, name: "Batata", price: 14, cost: 4 },
        { id: 3, name: "Refrigerante", price: 8, cost: 2.5 },
    ]);
    const [discount, setDiscount] = useState(10);
    const [fees, setFees] = useState(15);
    const [targetMargin, setTargetMargin] = useState(25);

    const totals = useMemo(
        () => items.reduce(
            (total, item) => ({
                price: total.price + Math.max(0, item.price),
                cost: total.cost + Math.max(0, item.cost),
            }),
            { price: 0, cost: 0 }
        ),
        [items]
    );
    const promotionalPrice = totals.price * (1 - Math.min(100, Math.max(0, discount)) / 100);
    const denominator = 1 - Math.max(0, fees + targetMargin) / 100;
    const minimumPrice = denominator > 0 ? totals.cost / denominator : 0;
    const recommendedPrice = Math.max(promotionalPrice, minimumPrice);
    const channelCost = recommendedPrice * (Math.max(0, fees) / 100);
    const contribution = recommendedPrice - totals.cost - channelCost;
    const actualMargin = recommendedPrice > 0 ? (contribution / recommendedPrice) * 100 : 0;
    const actualDiscount = totals.price > 0
        ? ((totals.price - recommendedPrice) / totals.price) * 100
        : 0;

    const updateItem = (id: number, field: keyof Omit<ComboItem, "id">, value: string | number) => {
        setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    };

    const addItem = () => {
        if (items.length >= 8) return;
        setItems((current) => [
            ...current,
            { id: Date.now(), name: `Item ${current.length + 1}`, price: 0, cost: 0 },
        ]);
    };

    return (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <ToolPanel title="Itens do combo" description="Informe preço avulso e custo unitário de cada item." icon={faBoxOpen}>
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={item.id} className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1fr_0.7fr_0.7fr_auto] sm:items-end">
                            <Input label={`Item ${index + 1}`} value={item.name} onChange={(event) => updateItem(item.id, "name", event.target.value)} />
                            <NumberField label="Preço avulso" value={item.price} onChange={(value) => updateItem(item.id, "price", value)} prefix="R$" />
                            <NumberField label="Custo" value={item.cost} onChange={(value) => updateItem(item.id, "cost", value)} prefix="R$" />
                            <Button
                                type="button"
                                variant="secondary"
                                className="h-[50px] px-3 text-red-600"
                                disabled={items.length === 1}
                                onClick={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))}
                                aria-label={`Remover ${item.name}`}
                            >
                                <FontAwesomeIcon icon={faTrash} className="mr-2 h-3.5 w-3.5" />
                                Remover
                            </Button>
                        </div>
                    ))}
                </div>
                <Button type="button" variant="secondary" className="mt-4" onClick={addItem} disabled={items.length >= 8}>
                    <FontAwesomeIcon icon={faPlus} className="mr-2 h-3.5 w-3.5" />
                    Adicionar item
                </Button>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <NumberField label="Desconto desejado" value={discount} onChange={setDiscount} suffix="%" max={100} />
                    <NumberField label="Taxas sobre a venda" value={fees} onChange={setFees} suffix="%" max={100} help="Comissão, pagamento e impostos." />
                    <NumberField label="Margem mínima" value={targetMargin} onChange={setTargetMargin} suffix="%" max={100} />
                </div>
            </ToolPanel>
            <ToolPanel title="Preço do combo" icon={faTag}>
                <ResultGrid>
                    <ResultItem label="Itens avulsos" value={formatCurrency(totals.price)} />
                    <ResultItem label="Custo total" value={formatCurrency(totals.cost)} />
                    <ResultItem label="Preço com desconto" value={formatCurrency(promotionalPrice)} />
                    <ResultItem label="Preço mínimo pela margem" value={denominator > 0 ? formatCurrency(minimumPrice) : "Impossível"} />
                    <ResultItem label="Preço recomendado" value={denominator > 0 ? formatCurrency(recommendedPrice) : "Revise os percentuais"} highlight={denominator > 0} />
                    <ResultItem
                        label="Margem no recomendado"
                        value={formatPercent(actualMargin)}
                        description={
                            actualDiscount >= 0
                                ? `${formatPercent(actualDiscount)} de desconto real`
                                : `${formatPercent(Math.abs(actualDiscount))} acima da soma avulsa`
                        }
                    />
                </ResultGrid>
                {minimumPrice > promotionalPrice && denominator > 0 && (
                    <Notice>O desconto desejado reduziria a margem abaixo da meta. O preço recomendado protege a rentabilidade e, por isso, oferece um desconto menor.</Notice>
                )}
                {denominator <= 0 && <Notice>A soma das taxas e da margem desejada precisa ser menor que 100%.</Notice>}
            </ToolPanel>
        </div>
    );
}
