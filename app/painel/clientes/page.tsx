"use client";
import { useEffect, useState } from "react";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { crmRequest } from "@/lib/api/crm";
import { CUSTOMER_SEGMENTS } from "@/lib/services/crmRules";
import type { CustomerRow } from "@/lib/services/crm";
import DataTable from "@/components/ui/DataTable";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import HybridModal from "@/components/ui/HybridModal";
import { formatPrice } from "@/lib/utils/formatPrice";

type Details = {
  customer: CustomerRow | null;
  favorites: { item_id: string; name: string; quantity: number }[];
  orders: {
    id: string;
    display_id: number;
    status: string;
    total_cents: number;
    created_at: string;
  }[];
};
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";
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
export default function ClientesPage() {
  const id = useCreationStore((s) => s.restaurantId);
  const [rows, setRows] = useState<CustomerRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [segment, setSegment] = useState(""),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<CustomerRow | null>(null),
    [details, setDetails] = useState<Details | null>(null),
    [detailsError, setDetailsError] = useState("");
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRows([]);
    const timer = setTimeout(() => {
      void crmRequest(
        `/api/customers?search=${encodeURIComponent(search)}&segment=${encodeURIComponent(segment)}&page=${page}`,
        id,
        { signal: controller.signal },
      )
        .then((data) => {
          setRows(data.customers);
          setTotal(data.total);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [id, search, segment, page]);
  useEffect(() => {
    setDetails(null);
    setDetailsError("");
    if (!id || !selected) return;
    const controller = new AbortController();
    void crmRequest(
      `/api/customers?phone=${encodeURIComponent(selected.phone)}`,
      id,
      { signal: controller.signal },
    )
      .then(setDetails)
      .catch((e) => {
        if (!controller.signal.aborted) setDetailsError(e.message);
      });
    return () => controller.abort();
  }, [id, selected]);
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-20 pt-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
        <p className="mt-2 text-sm text-gray-500">
          Conheça quem compra de você e acompanhe cada relacionamento.
        </p>
      </div>
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Input
            label="Buscar cliente"
            placeholder="Nome ou celular"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-56">
          <Dropdown
            label="Classificação"
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos os clientes" },
              ...CUSTOMER_SEGMENTS.map((x) => ({ value: x, label: x })),
            ]}
          />
        </div>
      </Card>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.phone}
        onRowClick={setSelected}
        emptyMessage={
          search || segment
            ? "Nenhum cliente encontrado com estes filtros."
            : "Seus clientes aparecerão aqui automaticamente quando fizerem pedidos."
        }
        columns={[
          {
            key: "name",
            label: "Cliente",
            render: (r) => (
              <div>
                <p className="font-medium text-gray-900">
                  {r.name || "Sem nome"}
                </p>
                <p className="mt-1 text-gray-500">+{r.phone}</p>
              </div>
            ),
          },
          {
            key: "segment",
            label: "Classificação",
            render: (r) => (
              <Badge
                variant={
                  r.segment === "VIP"
                    ? "brand"
                    : r.segment === "Em risco"
                      ? "warning"
                      : r.segment === "Inativo"
                        ? "neutral"
                        : "success"
                }
              >
                {r.segment}
              </Badge>
            ),
          },
          { key: "orders", label: "Pedidos", render: (r) => r.order_count },
          {
            key: "spent",
            label: "Total gasto",
            render: (r) => formatPrice(r.spending_cents),
          },
          {
            key: "ticket",
            label: "Ticket médio",
            render: (r) => formatPrice(r.average_ticket_cents),
          },
          {
            key: "last",
            label: "Última compra",
            render: (r) => date(r.last_purchase),
          },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <span>
          {total} cliente{total === 1 ? "" : "s"} · Página {page}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="secondary"
            disabled={page * 25 >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">
        Novo: até 2 pedidos · Frequente: 3 ou mais · VIP: 10 pedidos ou R$ 1.000
        em compras · Em risco: 30 dias sem comprar · Inativo: 60 dias. A
        inatividade tem prioridade. Pedidos cancelados e PIX pendentes não
        entram nas métricas.
      </p>
      <HybridModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        height={0.85}
        contentClassName="overflow-y-auto"
      >
        <div className="space-y-5 px-5 py-6">
          <div>
            <h2 className="text-xl font-bold">{selected?.name || "Cliente"}</h2>
            <p className="mt-1 text-sm text-gray-500">+{selected?.phone}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Card>
              <p className="text-gray-500">Pedidos</p>
              <strong>{selected?.order_count}</strong>
            </Card>
            <Card>
              <p className="text-gray-500">Total gasto</p>
              <strong>{formatPrice(selected?.spending_cents || 0)}</strong>
            </Card>
            <Card>
              <p className="text-gray-500">Ticket médio</p>
              <strong>
                {formatPrice(selected?.average_ticket_cents || 0)}
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
                <h3 className="mb-3 font-semibold">Produtos favoritos</h3>
                <DataTable
                  rows={details.favorites}
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
              </div>
              <div>
                <h3 className="mb-3 font-semibold">Últimos 50 pedidos</h3>
                <DataTable
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
              </div>
            </>
          )}
        </div>
      </HybridModal>
    </div>
  );
}
