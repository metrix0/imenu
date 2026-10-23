"use client";
import { useEffect, useState } from "react";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { crmRequest } from "@/lib/api/crm";
import { CUSTOMER_SEGMENTS, type PurchaseHabit } from "@/lib/services/crmRules";
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
import { formatPhone } from "@/lib/dev/dashboardFormat";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import PanelFeatureCallout from "@/components/ui/PanelFeatureCallout";

type Details = {
  customer: CustomerRow | null;
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
export default function ClientesPage() {
  const id = useCreationStore((s) => s.restaurantId);
  const [rows, setRows] = useState<CustomerRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [segment, setSegment] = useState(""),
    [sortKey, setSortKey] = useState("last"),
    [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc"),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<CustomerRow | null>(null),
    [orderPage, setOrderPage] = useState(0),
    [details, setDetails] = useState<Details | null>(null),
    [detailsLoading, setDetailsLoading] = useState(false),
    [detailsError, setDetailsError] = useState("");
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRows([]);
    const timer = setTimeout(() => {
      void crmRequest(
        `/api/customers?search=${encodeURIComponent(search)}&segment=${encodeURIComponent(segment)}&sort=${encodeURIComponent(`${sortKey}:${sortDirection}`)}&page=${page}`,
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
  }, [id, search, segment, sortKey, sortDirection, page]);
  useEffect(() => {
    setDetailsError("");
    if (!id || !selected) {
      setDetails(null);
      setDetailsLoading(false);
      return;
    }
    const controller = new AbortController();
    setDetailsLoading(true);
    void crmRequest(
      `/api/customers?phone=${encodeURIComponent(selected.phone)}&orderPage=${orderPage + 1}`,
      id,
      { signal: controller.signal },
    )
      .then(setDetails)
      .catch((e) => {
        if (!controller.signal.aborted) setDetailsError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });
    return () => controller.abort();
  }, [id, selected, orderPage]);
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
      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(180px,1fr)]">
        <div className="min-w-0">
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
        onRowClick={(customer) => {
          setDetails(null);
          setOrderPage(0);
          setSelected(customer);
        }}
        emptyMessage={
          search || segment
            ? "Nenhum cliente encontrado com estes filtros."
            : "Seus clientes aparecerão aqui automaticamente quando fizerem pedidos."
        }
        columns={[
          {
            key: "name",
            sortable: true,
            label: "Cliente",
            render: (r) => (
              <div className="flex items-center gap-3">
                <InitialsAvatar name={r.name} colorKey={r.phone} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {r.name || "Sem nome"}
                  </p>
                  <p className="mt-1 text-gray-500">{formatPhone(r.phone)}</p>
                </div>
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
                  r.segment === "Destaque"
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
      <PanelFeatureCallout feature="marketing" />
      <HybridModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        height={0.85}
        contentClassName="overflow-y-auto"
      >
        <div className="space-y-5 px-5 py-6">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={selected?.name} colorKey={selected?.phone} size="lg" />
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{selected?.name || "Cliente"}</h2>
              <p className="mt-1 text-sm text-gray-500">{formatPhone(selected?.phone || null)}</p>
            </div>
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
        </div>
      </HybridModal>
    </div>
  );
}
