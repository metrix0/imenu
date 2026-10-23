"use client";
import { useEffect, useState } from "react";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { crmRequest } from "@/lib/api/crm";
import { CUSTOMER_SEGMENTS } from "@/lib/services/crmRules";
import type { CustomerRow } from "@/lib/services/crm";
import DataTable from "@/components/ui/DataTable";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Pagination from "@/components/ui/Pagination";
import { Search } from "lucide-react";
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
    [orderFilter, setOrderFilter] = useState(""),
    [marketingFilter, setMarketingFilter] = useState(""),
    [sortKey, setSortKey] = useState("last"),
    [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc"),
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
        `/api/customers?search=${encodeURIComponent(search)}&segment=${encodeURIComponent(segment)}&orders=${encodeURIComponent(orderFilter)}&marketing=${encodeURIComponent(marketingFilter)}&sort=${encodeURIComponent(`${sortKey}:${sortDirection}`)}&page=${page}`,
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
  }, [id, search, segment, orderFilter, marketingFilter, sortKey, sortDirection, page]);
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
  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection(key === "name" || key === "segment" ? "asc" : "desc");
    }
    setPage(1);
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-20 pt-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
        <p className="mt-2 text-sm text-gray-500">
          Conheça quem compra de você e acompanhe cada relacionamento.
        </p>
      </div>
      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.3fr)_repeat(3,minmax(170px,1fr))]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Input
            label="Buscar cliente"
            placeholder="Nome ou celular"
            icon={<Search size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
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
        <Dropdown
          label="Pedidos"
          value={orderFilter}
          onChange={(e) => {
            setOrderFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "", label: "Qualquer quantidade" },
            { value: "none", label: "Nenhum pedido" },
            { value: "few", label: "1 a 2 pedidos" },
            { value: "regular", label: "3 a 9 pedidos" },
            { value: "tenPlus", label: "10 ou mais" },
          ]}
        />
        <Dropdown
          label="Marketing"
          value={marketingFilter}
          onChange={(e) => {
            setMarketingFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "", label: "Todos" },
            { value: "consented", label: "Autorizado" },
            { value: "notConsented", label: "Não autorizado" },
          ]}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <DataTable
        loading={loading}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        rows={rows}
        rowKey={(r) => r.phone}
        onRowClick={setSelected}
        emptyMessage={
          search || segment || orderFilter || marketingFilter
            ? "Nenhum cliente encontrado com estes filtros."
            : "Seus clientes aparecerão aqui automaticamente quando fizerem pedidos."
        }
        columns={[
          {
            key: "name",
            sortable: true,
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
            sortable: true,
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
          { key: "orders", label: "Pedidos", sortable: true, render: (r) => r.order_count },
          {
            key: "spent",
            sortable: true,
            label: "Total gasto",
            render: (r) => formatPrice(r.spending_cents),
          },
          {
            key: "ticket",
            sortable: true,
            label: "Ticket médio",
            render: (r) => formatPrice(r.average_ticket_cents),
          },
          {
            key: "last",
            sortable: true,
            label: "Última compra",
            render: (r) => date(r.last_purchase),
          },
        ]}
      />
      <div className="text-center text-sm text-gray-500">
        {total} cliente{total === 1 ? "" : "s"}
        {(total > 0 || page > 1) && (
          <Pagination
            page={page - 1}
            pageCount={Math.ceil(total / 25)}
            onChange={(nextPage) => setPage(nextPage + 1)}
            disabled={loading}
          />
        )}
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
