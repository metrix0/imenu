"use client";
import { useEffect, useState } from "react";
import { crmRequest } from "@/lib/api/crm";
import { normalizeCustomerPhone, type PurchaseHabit } from "@/lib/services/crmRules";
import type { CustomerRow } from "@/lib/services/crm";
import DataTable from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";
import HybridModal from "@/components/ui/HybridModal";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { formatPrice } from "@/lib/utils/formatPrice";
import { formatPhone } from "@/lib/dev/dashboardFormat";

type CustomerMetrics = Pick<CustomerRow, "order_count" | "spending_cents" | "average_ticket_cents">;
type CustomerSelection = Pick<CustomerRow, "phone" | "name"> & Partial<CustomerMetrics>;

type Details = {
  customer: Pick<CustomerRow, "phone" | "name" | "address" | "opted_out_at"> | null;
  metrics: CustomerMetrics;
  favorites: { item_id: string; name: string; quantity: number }[];
  habits: PurchaseHabit[];
  orderTotal: number;
  orders: {
    id: string;
    display_id: number;
    status: string;
    total_cents: number;
    created_at: string;
  }[];
};
const FAVORITES_PAGE_SIZE = 5;
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const weekdays: Record<string, string> = {
  Sun: "Domingo", Mon: "Segunda-feira", Tue: "Terça-feira",
  Wed: "Quarta-feira", Thu: "Quinta-feira", Fri: "Sexta-feira", Sat: "Sábado",
};
const statuses: Record<string, string> = {
  created: "Recebido",
  canceled: "Cancelado",
  pending_online_payment: "PIX pendente",
  pending_physical_payment: "Pagamento na entrega",
  paid: "Pago",
  preparing: "Preparando",
  delivering: "Em entrega",
  done: "Concluído",
};

export default function CustomerDetailsModal({ restaurantId, selected, onClose, onDelete }: {
  restaurantId: string;
  selected: CustomerSelection;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [favoritePage, setFavoritePage] = useState(0);
  const [orderPage, setOrderPage] = useState(0);
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState("");
  const phone = normalizeCustomerPhone(selected.phone);
  const metrics = details?.metrics ?? (
    selected.order_count !== undefined && selected.spending_cents !== undefined && selected.average_ticket_cents !== undefined
      ? { order_count: selected.order_count, spending_cents: selected.spending_cents, average_ticket_cents: selected.average_ticket_cents }
      : null
  );
  useEffect(() => {
    setDetailsError("");
    if (!phone) {
      setDetailsError("Número de WhatsApp inválido.");
      setDetailsLoading(false);
      return;
    }
    const controller = new AbortController();
    setDetailsLoading(true);
    void crmRequest(
      `/api/customers?phone=${encodeURIComponent(phone)}&orderPage=${orderPage + 1}`,
      restaurantId,
      { signal: controller.signal },
    )
      .then(data => { if (!controller.signal.aborted) setDetails(data); })
      .catch(e => { if (!controller.signal.aborted) setDetailsError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setDetailsLoading(false); });
    return () => controller.abort();
  }, [restaurantId, phone, orderPage]);

  return (
      <HybridModal
        open={true}
        onClose={onClose}
        height={0.85}
        contentClassName="overflow-y-auto"
      >
        <div className="space-y-5 px-5 py-6">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={(details?.customer?.name || selected.name)} colorKey={selected.phone} size="lg" />
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{(details?.customer?.name || selected.name) || "Cliente"}</h2>
              <p className="mt-1 text-sm text-gray-500">{formatPhone(selected.phone || null)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Card>
              <p className="text-gray-500">Pedidos</p>
              <strong>{metrics ? metrics.order_count : "—"}</strong>
            </Card>
            <Card>
              <p className="text-gray-500">Total gasto</p>
              <strong>{metrics ? formatPrice(metrics.spending_cents) : "—"}</strong>
            </Card>
            <Card>
              <p className="text-gray-500">Ticket médio</p>
              <strong>
                {metrics ? formatPrice(metrics.average_ticket_cents) : "—"}
              </strong>
            </Card>
          </div>
          {detailsError ? (
            <p role="alert" className="text-sm text-red-600">
              {detailsError}
            </p>
          ) : !details ? (
            <p className="text-sm text-gray-500">Carregando histórico...</p>
          ) : (
            <>
              {details.customer?.address ? (
                <Card>
                  <h3 className="font-semibold">Último endereço</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {details.customer.address.formatted ||
                      [
                        details.customer.address.rua,
                        details.customer.address.numero,
                        details.customer.address.bairro,
                        details.customer.address.cidade,
                        details.customer.address.estado,
                        details.customer.address.cep,
                        details.customer.address.complemento,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                  </p>
                </Card>
              ) : null}
              <div>
                <h3 className="mb-2 font-semibold">Hábitos de consumo</h3>
                <p className="mb-3 text-xs text-gray-500">
                  Compras em pelo menos 3 datas diferentes, no mesmo dia da semana e horário, nos últimos 90 dias.
                </p>
                {details.habits.length ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {details.habits.map((habit) => (
                      <div key={`${habit.weekday}-${habit.hour}`}
                        className="rounded-lg border border-[#e2e5e9] bg-[#f7f8fa] px-3 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {weekdays[habit.weekday] || habit.weekday} às {String(habit.hour).padStart(2, "0")}h
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {habit.count} dias com compras
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhum hábito recorrente identificado.</p>
                )}
              </div>
              <div>
                <h3 className="mb-3 font-semibold">Produtos favoritos</h3>
                <DataTable
                  rows={details.favorites.slice(favoritePage * FAVORITES_PAGE_SIZE, (favoritePage + 1) * FAVORITES_PAGE_SIZE)}
                  rowKey={(r) => r.item_id || r.name}
                  emptyMessage="Ainda sem produtos comprados."
                  columns={[
                    { key: "name", label: "Produto", render: (r) => r.name },
                    {
                      key: "qty",
                      label: "Quantidade comprada",
                      render: (r) => r.quantity,
                    },
                  ]}
                />
                {details.favorites.length > FAVORITES_PAGE_SIZE && (
                  <Pagination
                    page={favoritePage}
                    pageCount={Math.ceil(details.favorites.length / FAVORITES_PAGE_SIZE)}
                    onChange={setFavoritePage}
                  />
                )}
              </div>
              <div>
                <h3 className="mb-3 font-semibold">Últimos pedidos</h3>
                <DataTable
                  loading={detailsLoading}
                  rows={details.orders}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      key: "id",
                      label: "Pedido",
                      render: (r) => `#${r.display_id || r.id.slice(0, 8)}`,
                    },
                    {
                      key: "date",
                      label: "Data",
                      render: (r) => date(r.created_at),
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (r) => statuses[r.status] || r.status,
                    },
                    {
                      key: "value",
                      label: "Valor",
                      render: (r) => formatPrice(r.total_cents),
                    },
                  ]}
                />
                {details.orderTotal > 10 && (
                  <Pagination
                    page={orderPage}
                    pageCount={Math.ceil(details.orderTotal / 10)}
                    onChange={setOrderPage}
                    disabled={detailsLoading}
                  />
                )}
              </div>
            </>
          )}
          {onDelete && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={onDelete}
                className="text-red-600 hover:bg-red-50 border-red-200"
              >
                <PanelIcon icon={faTrash} className="mr-2" /> Excluir
              </Button>
            </div>
          )}
        </div>
      </HybridModal>
  );
}
