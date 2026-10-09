import { type ReactElement, type ReactNode, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OrderCard, { type OrderData, type OrderStatus } from "../OrderCard";
import Button from "@/components/ui/Button";

jest.mock("react", () => ({
    ...jest.requireActual("react"),
    useEffect: jest.fn(),
    useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, jest.fn()],
}));
jest.mock("next/navigation", () => ({ useParams: () => ({}), usePathname: () => "/motoboy" }));
jest.mock("@/lib/database/supabaseClient", () => ({ supabase: {} }));
jest.mock("@/components/ui/Tooltip", () => ({ __esModule: true, default: ({ children }: { children: ReactNode }) => children }));

const order = (status: OrderStatus): OrderData => ({
    id: "test-order", created_at: "2026-10-09T12:00:00Z", status,
    customer_name: "Cliente", customer_address: "Rua 1", is_delivery: "entrega",
    delivery_cents: 500, total_cents: 1500, payment_method: "dinheiro", order_items: [],
});
const noop = () => {};

function findButton(node: ReactNode, label: string): ReactElement<{ onClick: () => Promise<void> }> | undefined {
    if (Array.isArray(node)) {
        for (const child of node) { const match = findButton(child, label); if (match) return match; }
        return;
    }
    if (!isValidElement<{ children?: ReactNode }>(node)) return;
    if (node.type === Button && node.props.children === label) return node as ReactElement<{ onClick: () => Promise<void> }>;
    return findButton(node.props.children, label);
}

test.each(["paid", "pending_physical_payment", "preparing", "done"] as OrderStatus[])("courier can view %s orders without production or rollback controls", (status) => {
    const html = renderToStaticMarkup(<OrderCard order={order(status)} deliveryOnly onStatusChange={noop} onViewOrder={noop} />);
    expect(html).toContain("Ver detalhes do pedido");
    expect(html).not.toContain("Voltar status anterior");
    expect(html).not.toMatch(/>Aceitar<|>Enviado<|>Entregue</);
});

test("courier delivery card labels the completion action Entregue", () => {
    const html = renderToStaticMarkup(<OrderCard order={order("delivering")} deliveryOnly onStatusChange={noop} onViewOrder={noop} />);
    expect(html).toContain(">Entregue<");
    expect(html).not.toContain("Voltar status anterior");
});

test.each([["paid", "Aceitar"], ["preparing", "Enviado"], ["delivering", "Concluir"]] as const)("default %s card preserves its action", (status, action) => {
    const html = renderToStaticMarkup(<OrderCard order={order(status)} onStatusChange={noop} />);
    expect(html).toContain(`>${action}<`);
    if (status !== "paid") expect(html).toContain("Voltar status anterior");
});

test("Entregue uses the existing status API and refreshes after success", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    const refresh = jest.fn();
    const tree = OrderCard({ order: order("delivering"), deliveryOnly: true, onStatusChange: refresh });
    await findButton(tree, "Entregue")!.props.onClick();
    expect(fetchMock).toHaveBeenCalledWith("/api/orders/test-order/status-order", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }),
    });
    expect(refresh).toHaveBeenCalledTimes(1);
});

test("failed completion does not report a delivery or refresh success", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Falha" }) });
    const alertMock = jest.fn();
    Object.assign(global, { alert: alertMock });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const refresh = jest.fn();
    const tree = OrderCard({ order: order("delivering"), deliveryOnly: true, onStatusChange: refresh });
    await findButton(tree, "Entregue")!.props.onClick();
    expect(refresh).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalled();
    errorSpy.mockRestore();
});
