"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import ToggleInput from "@/components/ui/ToggleInput";
import Tabs from "@/components/ui/Tabs";
import Loader from "@/components/ui/Loader";
import ListLoader from "@/components/ui/ListLoader";
import BonusButton from "@/components/ui/BonusButton";
import Toast from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";

import Badge from "@/components/ui/Badge";
import ChoiceCardGroup from "@/components/ui/ChoiceCardGroup";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import ConfigurationCard from "@/components/ui/ConfigurationCard";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DataTable from "@/components/ui/DataTable";
import DateRangePicker from "@/components/ui/DateRangePicker";
import HybridModal from "@/components/ui/HybridModal";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import LoadingBar from "@/components/ui/LoadingBar";
import Modal from "@/components/ui/Modal";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import ModalFlowStep from "@/components/ui/ModalFlowStep";
import PageBadge from "@/components/ui/PageBadge";
import Pagination from "@/components/ui/Pagination";
import PanelAppearance from "@/components/ui/PanelAppearance";
import PanelFeatureCallout from "@/components/ui/PanelFeatureCallout";
import PanelShortcutPrompt from "@/components/ui/PanelShortcutPrompt";
import RecommendedBadge from "@/components/ui/RecommendedBadge";
import ShortcutDatePicker from "@/components/ui/ShortcutDatePicker";
import Switch from "@/components/ui/Switch";
import Textarea from "@/components/ui/Textarea";
import WarningBox from "@/components/ui/WarningBox";
import { CollapsibleChevron, CollapsibleContent } from "@/components/ui/CollapsibleSection";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PageLoader } from "@/components/ui/Loader";
import SaveStatus, { PageHeader, PageSaveStatusProvider, type SaveState } from "@/components/ui/SaveStatus";
import { TemplateEditor, VariablePicker, type TemplateEditorHandle } from "@/components/ui/WhatsAppTemplateEditor";
import OrderBadge from "@/components/restaurant-owner/pedidos/OrderBadge";
import { getDateRangeForDays } from "@/lib/utils/dateRange";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faCheck, faStar, faCircleInfo, faTriangleExclamation, faPlus, faArrowRight, faLock, faGear, faHouse, faCalendarDays } from "@fortawesome/free-solid-svg-icons";

export default function UIShowcase() {
    const [checked, setChecked] = useState(false);
    const [tab, setTab] = useState("Hoje");

    // Toast state
    const [showToast, setShowToast] = useState<"success" | "error" | "info" | null>(null);
    const [choice, setChoice] = useState<"delivery" | "pickup">("delivery");
    const [switchOn, setSwitchOn] = useState(true);
    const [featureOn, setFeatureOn] = useState(true);
    const [page, setPage] = useState(2);
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [range, setRange] = useState(() => getDateRangeForDays(7));
    const [singleDate, setSingleDate] = useState(() => getDateRangeForDays(1));
    const [dialog, setDialog] = useState<"modal" | "fixed" | "hybrid" | "danger" | "primary" | "neutral" | "typed" | "success" | null>(null);
    const [step, setStep] = useState(0);
    const [prompt, setPrompt] = useState(false);
    const [template, setTemplate] = useState("Olá, {{NOME_DO_CLIENTE}}! Seu pedido está pronto.");
    const editor = useRef<TemplateEditorHandle>(null);
    const variables = [
        { key: "NOME_DO_CLIENTE", label: "Cliente", token: "{{NOME_DO_CLIENTE}}", value: "Maria" },
        { key: "STATUS_DO_PEDIDO", label: "Status", token: "{{STATUS_DO_PEDIDO}}", value: "Pronto" },
        { key: "PROMOCAO", label: "Promoção", token: "{{PROMOCAO}}", value: "10% de desconto" },
    ];
    const badgeVariants = ["brand", "neutral", "success", "warning", "notRecommended", "info", "danger", "orange", "purple"] as const;
    const columns = [
        { key: "name", label: "Produto", sortable: true, render: (row: { id: string; name: string; value: string }) => row.name },
        { key: "value", label: "Valor", render: (row: { id: string; name: string; value: string }) => row.value },
    ];
    const rows = [{ id: "1", name: "Pizza", value: "R$ 45,00" }, { id: "2", name: "Hambúrguer", value: "R$ 28,00" }];
    const closeDialog = () => setDialog(null);

    const dropdownOptions = [
        { value: "op1", label: "Opção 1" },
        { value: "op2", label: "Opção 2" },
    ];

    return (
        <div className="min-w-0 space-y-6">
            <h1 className="text-3xl font-bold text-brand mb-10 tracking-wide">
                UI Component Showcase
            </h1>

            {/* === BUTTON === */}
            <ComponentBlock
                title="Button"
            >
                <div className="flex flex-wrap gap-5">
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="primary" disabled>Desativado</Button>
                    <Button variant="secondary" disabled>Desativado</Button>
                    <Button leftIcon={<PanelIcon icon={faPlus} />}>Adicionar</Button>
                    <Button variant="secondary" rightIcon={<PanelIcon icon={faArrowRight} />}>Continuar</Button>
                    <Button variant="primary" loading>
                        Loading
                    </Button>
                </div>
            </ComponentBlock>

            {/* === CARD === */}
            <ComponentBlock
                title="Card"
            >
                <Card className="max-w-sm">Exemplo de Card com texto dentro.</Card>
            </ComponentBlock>

            {/* === INPUTS === */}
            <ComponentBlock
                title="Input"
            >
                <div className="space-y-4 max-w-sm">
                    <Input label="Input simples" placeholder="Digite algo..." />
                    <Input
                        label="Com ícone"
                        icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
                        placeholder="Buscar..."
                    />
                    <Input placeholder="Sem Label" />
                    <Input label="Desativado" disabled defaultValue="Exemplo" />
                    <Input label="Bloqueado" locked defaultValue="Exemplo" />
                    <Input label="Inline" inline defaultValue="Exemplo" />
                    <Input label="Numerical + Icon/Text on right" icon="R$" iconPosition="right" numeric />
                    <Input label="Numerical + Icon/Text on right" icon="R$" iconPosition="left" float />
                </div>
            </ComponentBlock>

            {/* === DROPDOWN === */}
            <ComponentBlock
                title="Dropdown"
            >
                <div className="max-w-sm">
                    <div className="space-y-3"><Dropdown label="Dropdown" options={dropdownOptions} /><Dropdown label="Personalizado" custom options={dropdownOptions} /><Dropdown label="Desativado" disabled options={dropdownOptions} /><Dropdown label="Pesquisar" options={dropdownOptions} search={{ placeholder: "Buscar...", filter: (option, query) => option.label.toLowerCase().includes(query.toLowerCase()) }} /></div>
                </div>
            </ComponentBlock>

            {/* === TOGGLE === */}
            <ComponentBlock
                title="ToggleInput"
            >
                <ToggleInput
                    label="Ativo"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                />
            </ComponentBlock>

            {/* === TABS === */}
            <ComponentBlock
                title="Tabs"
            >
                <div className="max-w-md">
                    <Tabs tabs={["Hoje", "Semana", "Mês"]} active={tab} onChange={setTab} />
                </div>
            </ComponentBlock>

            {/* === LOADER === */}
            <ComponentBlock
                title="Loader"
            >
                <Loader /><PageLoader />
            </ComponentBlock>

            {/* === LIST LOADER === */}
            <ComponentBlock
                title="ListLoader"
            >
                <div className="max-w-md">
                    <ListLoader lines={4} />
                </div>
            </ComponentBlock>

            {/* === BONUS BUTTON === */}
            <ComponentBlock
                title="BonusButton"
            >
                <div className="flex flex-wrap gap-5">
                    <BonusButton>Test</BonusButton>
                    <BonusButton color={"bg-red-500"} shimmer={false}>Test</BonusButton>
                </div>
            </ComponentBlock>

            {/* === TOOLTIP === */}
            <ComponentBlock
                title="Tooltip"
            >
                <div className="flex flex-wrap gap-6">
                    <Tooltip text="Tooltip padrão">
                        <Button variant="primary">Hover</Button>
                    </Tooltip>

                    <Tooltip text="Tooltip verde, embaixo e com padding" padding={"px-4 py-4"} position="bottom" color="bg-green-600">
                        <Button variant="secondary">Hover</Button>
                    </Tooltip>

                    <Tooltip text={<>Size: O tooltip agora será cortado para manter seu tamanho médio. com <b>html</b></>} size={"medium"}>
                        <Button variant="secondary">Hover</Button>
                    </Tooltip>
                </div>
            </ComponentBlock>

            {/* === TOAST === */}
            <ComponentBlock
                title="Toast"
            >
                <div className="flex flex-wrap gap-3">
                    {(["success", "error", "info"] as const).map(type => <Button key={type} variant="secondary" onClick={() => setShowToast(type)}>{type}</Button>)}
                </div>
                {showToast && <Toast key={showToast} message={showToast === "success" ? "Alterações salvas!" : showToast === "error" ? "Não foi possível salvar." : "Informação"} type={showToast} onClose={() => setShowToast(null)} />}
            </ComponentBlock>

            <ComponentBlock title="Badge">
                {(["default", "pill", "page"] as const).map(mode => <div key={mode} className="space-y-2"><p className="text-sm text-gray-500">{mode}</p><div className="flex flex-wrap items-center gap-3">{badgeVariants.map(variant => <Badge key={variant} mode={mode} variant={variant}>{variant}</Badge>)}</div></div>)}
                <div className="flex flex-wrap items-center gap-3"><Badge preset="plusIncluded" /><Badge preset="featureAvailable" /></div>
            </ComponentBlock>
            <ComponentBlock title="RecommendedBadge"><div className="flex flex-wrap items-center gap-3"><RecommendedBadge /><RecommendedBadge infoText="Opção recomendada" /></div></ComponentBlock>
            <ComponentBlock title="OrderBadge">
                <div className="flex flex-wrap items-center gap-3">
                    {(["pending_online_payment", "pending_physical_payment", "paid", "preparing", "delivering", "done", "canceled"] as const).map(status => <OrderBadge key={status} status={status} />)}
                    <OrderBadge status="delivering" readyOnSite /><OrderBadge kind="ifood" /><OrderBadge kind="payment">Pix</OrderBadge><OrderBadge kind="paymentConfirmed">Pago</OrderBadge><OrderBadge kind="table">Mesa 1</OrderBadge><OrderBadge kind="count">3</OrderBadge><OrderBadge kind="scheduled">18:30</OrderBadge><OrderBadge kind="elapsed">10 min</OrderBadge>
                </div>
            </ComponentBlock>
            <ComponentBlock title="PageBadge"><div className="flex flex-wrap items-center gap-3">{(["inline", "button"] as const).flatMap(size => (["brand", "inherit"] as const).map(tone => <PageBadge key={size + tone} href="#page-badge" icon={faStar} size={size} tone={tone}>Assistente IA</PageBadge>))}<span id="page-badge" /></div></ComponentBlock>
            <ComponentBlock title="ChoiceCardGroup"><ChoiceCardGroup value={choice} onChange={setChoice} options={[{ value: "delivery", label: "Entrega", description: "Receba em casa" }, { value: "pickup", label: "Retirada", description: "Retire no local" }]} /></ComponentBlock>
            <ComponentBlock title="Switch"><div className="flex items-center gap-4"><Switch aria-label="Ativo ou inativo" checked={switchOn} onClick={() => setSwitchOn(!switchOn)} /><Switch aria-label="Inativo" checked={false} disabled /><Switch aria-label="Parcial" checked="mixed" onClick={() => setSwitchOn(!switchOn)} /><Switch aria-label="Desativado" checked disabled /></div></ComponentBlock>
            <ComponentBlock title="Textarea"><div className="space-y-3 max-w-md"><Textarea aria-label="Mensagem" className="w-full rounded-lg border border-gray-300 p-3" rows={3} placeholder="Digite uma mensagem..." /><Textarea aria-label="Desativado" className="w-full rounded-lg border border-gray-300 p-3" rows={2} disabled defaultValue="Desativado" /></div></ComponentBlock>
            <ComponentBlock title="CollapsibleSection">
                <CollapsibleSection title="Configurações" description="Opções adicionais" defaultOpen badge={<Badge variant="info">Novo</Badge>}><div className="py-3"><Input label="Nome" defaultValue="Exemplo" /></div></CollapsibleSection>
                <CollapsibleSection title="Ativar recurso" toggle={{ checked: featureOn, onChange: setFeatureOn }}><div className="py-3">Configuração do recurso</div></CollapsibleSection>
                <div className="flex items-center gap-3">{(["sm", "md", "default"] as const).map(size => <CollapsibleChevron key={size} size={size} expanded={false} />)}</div>
                <CollapsibleContent id="showcase-collapse" expanded><p>Conteúdo expandido</p></CollapsibleContent>
            </ComponentBlock>
            <ComponentBlock title="ConfigurationCard">
                <ConfigurationCard title="Modo Vitrine" description="Configuração do cardápio" checked={featureOn} onChange={setFeatureOn} configured={true} collapse={{ defaultOpen: true }}><Input label="Nome" defaultValue="Loja" /></ConfigurationCard>
                <ConfigurationCard title="Recurso Plus" plus={false} configured={false} collapse={{ defaultOpen: true }}><p>Configuração</p></ConfigurationCard>
                <ConfigurationCard title="Plano ativo" plus={true} checked={featureOn} onChange={setFeatureOn} disabled />
                <ConfigurationCard title="Opção compacta" embedded compact checked={featureOn} onChange={setFeatureOn} />
            </ComponentBlock>
            <ComponentBlock title="DataTable">
                <DataTable columns={columns} rows={sortDirection === "desc" ? rows : [...rows].reverse()} rowKey={row => row.id} sortKey="name" sortDirection={sortDirection} onSort={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")} />
                <DataTable columns={columns} rows={[]} rowKey={row => row.id} emptyMessage="Nenhum produto encontrado." />
                <DataTable columns={columns} rows={[]} rowKey={row => row.id} loading />
            </ComponentBlock>
            <ComponentBlock title="Pagination"><Pagination page={page} pageCount={10} onChange={setPage} /><Pagination page={0} pageCount={3} onChange={setPage} disabled /></ComponentBlock>
            <ComponentBlock title="DateRangePicker"><div className="flex flex-wrap items-center gap-3"><DateRangePicker value={range} onChange={setRange} /><DateRangePicker value={range} onChange={setRange} allowClear allowOpenEnd /><DateRangePicker value={singleDate} onChange={setSingleDate} singleDate allowFuture label="Data" /><DateRangePicker value={range} onChange={setRange} iconOnly /></div></ComponentBlock>
            <ComponentBlock title="ShortcutDatePicker"><ShortcutDatePicker value={range} onChange={setRange} /><ShortcutDatePicker value={singleDate} onChange={setSingleDate} singleDate /></ComponentBlock>
            <ComponentBlock title="InitialsAvatar"><div className="flex flex-wrap items-center gap-3">{["Maria Silva", "Ana Souza", "Pedro Lima", "Bruno Reis", "Lucas Alves", "Julia Costa"].map((name, index) => <InitialsAvatar key={name} name={name} colorKey={String(index)} />)}<InitialsAvatar name="Maria Silva" size="lg" /><InitialsAvatar name={null} /></div></ComponentBlock>
            <ComponentBlock title="LoadingBar"><LoadingBar progress={25} size="sm" /><LoadingBar progress={60} size="md" label="Progresso" showLabel /><LoadingBar progress={100} size="lg" colorClass="bg-green-500" /><LoadingBar indeterminate /><LoadingBar durationSeconds={10} targetProgress={90} showLabel /></ComponentBlock>
            <ComponentBlock title="Modal">
                <div className="flex flex-wrap gap-3"><Button onClick={() => setDialog("modal")}>Abrir modal</Button><Button variant="secondary" onClick={() => setDialog("fixed")}>Altura fixa</Button></div>
                <Modal height={300} open={dialog === "modal" || dialog === "fixed"} fixedHeight={dialog === "fixed"} onClose={closeDialog} showCloseButton><div className="p-5 space-y-4"><h3 className="font-semibold">Modal</h3><Input label="Nome" /><Button onClick={closeDialog}>Fechar</Button></div></Modal>
            </ComponentBlock>
            <ComponentBlock title="HybridModal"><Button onClick={() => setDialog("hybrid")}>Abrir modal</Button><HybridModal height={0.6} open={dialog === "hybrid"} onClose={closeDialog}><div className="space-y-4 p-5"><h3>HybridModal</h3><Button onClick={closeDialog}>Fechar</Button></div></HybridModal></ComponentBlock>
            <ComponentBlock title="ConfirmModal">
                <div className="flex flex-wrap gap-3">{(["danger", "primary", "neutral", "typed", "success"] as const).map(kind => <Button key={kind} variant="secondary" onClick={() => setDialog(kind)}>{kind}</Button>)}</div>
                <ConfirmModal open={dialog === "danger" || dialog === "primary" || dialog === "neutral" || dialog === "typed" || dialog === "success"} onClose={closeDialog} onConfirm={closeDialog} title="Confirmar ação" description="Deseja continuar?" variant={dialog === "primary" || dialog === "neutral" ? dialog : "danger"} confirmationText={dialog === "typed" ? "CONFIRMAR" : undefined} confirmTone={dialog === "success" ? "success" : undefined} />
            </ComponentBlock>
            <ComponentBlock title="ModalCloseButton"><div className="relative h-16 w-24 rounded-lg border border-gray-200"><ModalCloseButton onClose={() => setShowToast("info")} /></div></ComponentBlock>
            <ComponentBlock title="ModalFlowStep"><div className="overflow-hidden rounded-lg border border-gray-200 p-4"><ModalFlowStep key={step} animate reverse={step === 0}><p>Etapa {step + 1}</p></ModalFlowStep></div><Button variant="secondary" onClick={() => setStep(value => 1 - value)}>Alternar etapa</Button></ComponentBlock>
            <ComponentBlock title="PanelAppearance"><PanelAppearance><div className="flex flex-wrap items-end gap-3"><Input label="Campo" defaultValue="Exemplo" /><Button>Salvar</Button></div></PanelAppearance></ComponentBlock>
            <ComponentBlock title="PanelIcon"><div className="flex flex-wrap items-center gap-5 text-xl">{[faHouse, faMagnifyingGlass, faCheck, faStar, faCircleInfo, faTriangleExclamation, faPlus, faArrowRight, faLock, faGear, faCalendarDays].map(icon => <PanelIcon key={icon.iconName} icon={icon} />)}</div></ComponentBlock>
            <ComponentBlock title="PanelFeatureCallout">{(["nfce", "vendas-ia", "crm", "marketing"] as const).map(feature => <PanelFeatureCallout key={feature} feature={feature} />)}</ComponentBlock>
            <ComponentBlock title="PanelShortcutPrompt"><div className="relative min-h-64"><Button onClick={() => setPrompt(true)}>Mostrar</Button><PanelShortcutPrompt open={prompt} onAccept={() => setPrompt(false)} onDismiss={() => setPrompt(false)} className="!top-12" /></div></ComponentBlock>
            <ComponentBlock title="SaveStatus">{(["idle", "saving", "saved", "error"] as const).map(status => <SaveStatusExample key={status} status={status} />)}</ComponentBlock>
            <ComponentBlock title="PageHeader"><PageHeader title="Configurações" description="Gerencie sua loja" actions={<Button variant="secondary">Editar</Button>} /></ComponentBlock>
            <ComponentBlock title="WarningBox"><WarningBox icon={faTriangleExclamation}>Revise as informações antes de continuar.</WarningBox></ComponentBlock>
            <ComponentBlock title="WhatsAppTemplateEditor"><TemplateEditor ref={editor} value={template} variables={variables} ariaLabel="Mensagem de exemplo" onChange={setTemplate} /><VariablePicker open variables={variables} onSelect={variable => editor.current?.insertVariable(variable)} /></ComponentBlock>
            <a className="text-sm text-brand underline" href="/dev/ui/design-system">Design system · Painel</a>
        </div>
    );
}

/* ---------- helpers ---------- */

function ComponentBlock({
                            title,
                            children,
                        }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div>{children}</div>
        </section>
    );
}

function SaveStatusExample({ status }: { status: SaveState }) {
    const [state, setState] = useState<SaveState>(status === "idle" ? "idle" : "saving");
    useEffect(() => {
        if (status === "idle" || status === "saving") return;
        const timer = window.setTimeout(() => setState(status), 100);
        return () => window.clearTimeout(timer);
    }, [status]);
    return <PageSaveStatusProvider><PageHeader title={status} /><SaveStatus status={state} /></PageSaveStatusProvider>;
}
