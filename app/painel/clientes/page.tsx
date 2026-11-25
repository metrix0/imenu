"use client";
import { useEffect, useState } from "react";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { crmRequest } from "@/lib/api/crm";
import { CUSTOMER_SEGMENTS } from "@/lib/services/crmRules";
import type { CustomerRow } from "@/lib/services/crm";
import DataTable from "@/components/ui/DataTable";
import CustomerDetailsModal from "@/components/restaurant-owner/clientes/CustomerDetailsModal";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Pagination from "@/components/ui/Pagination";
import { Search } from "lucide-react";
import Badge from "@/components/ui/Badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Toast from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils/formatPrice";
import { formatPhone } from "@/lib/dev/dashboardFormat";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import PanelFeatureCallout from "@/components/ui/PanelFeatureCallout";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const weekdays: Record<string, string> = {
  Sun: "Domingo", Mon: "Segunda-feira", Tue: "Terça-feira",
  Wed: "Quarta-feira", Thu: "Quinta-feira", Fri: "Sexta-feira", Sat: "Sábado",
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
    [total, setTotal] = useState(0),
    [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
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
  }, [id, search, segment, sortKey, sortDirection, page, refreshKey]);
  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection(key === "name" || key === "segment" ? "asc" : "desc");
    }
    setPage(1);
  };
  const handleDeleteCustomer = async () => {
    if (!id || !customerToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await crmRequest(
        `/api/customers?phone=${encodeURIComponent(customerToDelete.phone)}`,
        id,
        { method: "DELETE" },
      );
      setCustomerToDelete(null);
      setToast({ message: "Cliente excluído.", type: "success" });
      if (page > 1 && rows.length === 1) {
        setPage(page - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Não foi possível excluir o cliente.",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
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
      <div className="[&_table]:table-fixed [&_table]:min-w-[1020px] [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:px-2 [&_td]:px-2">
      <DataTable
        loading={loading}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
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
            className: "w-[17%]",
            sortable: true,
            label: "Cliente",
            render: (r) => (
              <div className="flex items-center gap-3">
                <InitialsAvatar name={r.name} colorKey={r.phone} />
                <div className="min-w-0 max-w-[160px]">
                  <p className="truncate font-medium text-gray-900" title={r.name || "Sem nome"}>
                    {r.name || "Sem nome"}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-gray-500">{formatPhone(r.phone)}</p>
                </div>
              </div>
            ),
          },
          {
            key: "segment",
            className: "w-[12%]",
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
          { key: "orders", className: "w-[8%] px-1.5!", label: "Pedidos", sortable: true, render: (r) => r.order_count },
          {
            key: "spent",
            className: "w-[10%] px-1.5!",
            sortable: true,
            label: "Total gasto",
            render: (r) => formatPrice(r.spending_cents),
          },
          {
            key: "ticket",
            className: "w-[11%] px-1.5!",
            sortable: true,
            label: "Ticket médio",
            render: (r) => formatPrice(r.average_ticket_cents),
          },
          {
            key: "last",
            className: "w-[12%] px-1.5!",
            sortable: true,
            label: "Última compra",
            render: (r) => date(r.last_purchase),
          },
          {
            key: "habits",
            className: "w-[15%]",
            label: "Hábitos de consumo",
            render: (r) => {
              const summary = r.habits.map((habit) =>
                `${weekdays[habit.weekday] || habit.weekday} às ${String(habit.hour).padStart(2, "0")}h`
              ).join(" · ");
              return summary
                ? <span title={summary} className="block w-full truncate">{summary}</span>
                : <span className="text-gray-400">—</span>;
            },
          },
          {
            key: "favorite",
            className: "w-[15%]",
            label: "Favorito",
            render: (r) => r.favorite_product ? (
              <span title={r.favorite_product} className="block w-full truncate">
                {r.favorite_product}
              </span>
            ) : <span className="text-gray-400">—</span>,
          },
        ]}
      />
      </div>
      {(total > 0 || page > 1) && (
        <Pagination
          page={page - 1}
          pageCount={Math.ceil(total / 25)}
          onChange={(nextPage) => setPage(nextPage + 1)}
          disabled={loading}
        />
      )}
      <PanelFeatureCallout feature="marketing" />
      {id && selected && (
        <CustomerDetailsModal
          key={`${id}:${selected.phone}`}
          restaurantId={id}
          selected={selected}
          onClose={() => setSelected(null)}
          onDelete={() => {
            setCustomerToDelete(selected);
            setSelected(null);
          }}
        />
      )}
      <ConfirmModal
        open={customerToDelete !== null}
        onClose={() => { if (!isDeleting) setCustomerToDelete(null); }}
        onConfirm={() => void handleDeleteCustomer()}
        title="Excluir cliente?"
        description="O cadastro será removido da lista de clientes. O histórico de pedidos será preservado."
        confirmLabel="Excluir cliente"
        isLoading={isDeleting}
        variant="danger"
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
