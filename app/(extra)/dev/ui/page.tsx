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
import Popup from "@/components/ui/Popup";
import Toast from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

if (process.env.NODE_ENV === "production") {
    throw new Error("This page is for development only");
}

export default function UIShowcase() {
    const [checked, setChecked] = useState(false);
    const [tab, setTab] = useState("Hoje");

    // Popup + Toast state
    const [showPopup, setShowPopup] = useState(false);
    const [showToast, setShowToast] = useState(false);

    const dropdownOptions = [
        { value: "op1", label: "Opção 1" },
        { value: "op2", label: "Opção 2" },
    ];

    return (
        <div className="p-8 space-y-14">
            <h1 className="text-3xl font-bold text-brand mb-10 tracking-wide">
                UI Component Showcase
            </h1>

            {/* === BUTTON === */}
            <ComponentBlock
                title="components/ui/Button.tsx — Button"
                imports={`import Button from "@/components/ui/Button";`}
            >
                <div className="flex gap-5 mb-5">
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="primary" loading>
                        Loading
                    </Button>
                </div>
                <CodeBlock
                    code={`<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="primary" loading>Loading</Button>`}
                />
            </ComponentBlock>

            {/* === CARD === */}
            <ComponentBlock
                title="components/ui/Card.tsx — Card"
                imports={`import Card from "@/components/ui/Card";`}
            >
                <Card className="max-w-sm">Exemplo de Card com texto dentro.</Card>
                <CodeBlock code={`<Card className="max-w-sm">Exemplo de Card</Card>`} />
            </ComponentBlock>

            {/* === INPUTS === */}
            <ComponentBlock
                title="components/ui/Input.tsx — Input"
                imports={`import Input from "@/components/ui/Input";`}
            >
                <div className="space-y-4 max-w-sm">
                    <Input label="Input simples" placeholder="Digite algo..." />
                    <Input
                        label="Com ícone"
                        icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
                        placeholder="Buscar..."
                    />
                    <Input placeholder="Sem Label" />
                    <Input label="Numerical + Icon/Text on right" icon="R$" iconPosition="right" numeric />
                    <Input label="Numerical + Icon/Text on right" icon="R$" iconPosition="left" float />
                </div>
                <CodeBlock
                    code={`<Input label="Input simples" placeholder="Digite algo..." />
<Input label="Com ícone" icon={<FontAwesomeIcon icon={faMagnifyingGlass} />} placeholder="Buscar..." />
<Input placeholder="Sem Label" />
<Input label="Numerical + Icon/Text on right" icon="R$" iconPosition="right" numeric />
<Input label="Numerical + Icon/Text on right" icon="R$" iconPosition="left" float />
`}
                />
                <CodeBlock
                    code={`* To use the Font Awesome Search Icon:
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";`}
                />
            </ComponentBlock>

            {/* === DROPDOWN === */}
            <ComponentBlock
                title="components/ui/Dropdown.tsx — Dropdown"
                imports={`import Dropdown from "@/components/ui/Dropdown";`}
                setup={`const dropdownOptions = [
  { value: "op1", label: "Opção 1" },
  { value: "op2", label: "Opção 2" },
];`}
            >
                <div className="max-w-sm">
                    <Dropdown label="Dropdown" options={dropdownOptions} />
                </div>
                <CodeBlock
                    code={`<Dropdown label="Dropdown" options={dropdownOptions} />`}
                />
            </ComponentBlock>

            {/* === TOGGLE === */}
            <ComponentBlock
                title="components/ui/ToggleInput.tsx — ToggleInput"
                imports={`import ToggleInput from "@/components/ui/ToggleInput";`}
            >
                <ToggleInput
                    label="Ativo"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                />
                <CodeBlock
                    code={`<ToggleInput label="Ativo" checked={checked} onChange={(e) => setChecked(e.target.checked)} />`}
                />
            </ComponentBlock>

            {/* === TABS === */}
            <ComponentBlock
                title="components/ui/Tabs.tsx — Tabs / Filter"
                imports={`import Tabs from "@/components/ui/Tabs";`}
            >
                <div className="max-w-md">
                    <Tabs tabs={["Hoje", "Semana", "Mês"]} active={tab} onChange={setTab} />
                </div>
                <CodeBlock
                    code={`<Tabs tabs={["Hoje", "Semana", "Mês"]} active={tab} onChange={setTab} />`}
                />
            </ComponentBlock>

            {/* === LOADER === */}
            <ComponentBlock
                title="components/ui/Loader.tsx — Loader"
                imports={`import Loader from "@/components/ui/Loader";`}
            >
                <Loader />
                <CodeBlock code={`<Loader />`} />
            </ComponentBlock>

            {/* === LIST LOADER === */}
            <ComponentBlock
                title="components/ui/ListLoader.tsx — List Loader"
                imports={`import ListLoader from "@/components/ui/ListLoader";`}
            >
                <div className="max-w-md">
                    <ListLoader lines={4} />
                </div>
                <CodeBlock code={`<ListLoader lines={4} />`} />
            </ComponentBlock>

            {/* === BONUS BUTTON === */}
            <ComponentBlock
                title="components/ui/BonusButton.tsx — List Loader"
                imports={`import BonusButton from "@/components/ui/BonusButton";`}
            >
                <div className="flex gap-5 mb-5">
                    <BonusButton>Test</BonusButton>
                    <BonusButton color={"bg-red-500"} shimmer={false}>Test</BonusButton>
                </div>

                <CodeBlock code={`<BonusButton>Test</BonusButton>
<BonusButton color={"bg-red-500"} shimmer={false}>Test</BonusButton>
`} />
            </ComponentBlock>

            {/* === TOOLTIP === */}
            <ComponentBlock
                title="components/ui/Tooltip.tsx — Tooltip"
                imports={`import Tooltip from "@/components/ui/Tooltip";`}
            >
                <div className="flex gap-6">
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

                <CodeBlock
                    code={`<Tooltip text="Tooltip padrão">
  <Button variant="primary">Hover</Button>
</Tooltip>

<Tooltip text="Tooltip verde, embaixo e com padding" padding={"px-4 py-4"} position="bottom" color="bg-green-600">
  <Button variant="secondary">Hover</Button>
</Tooltip>

<Tooltip text={<>Size: O tooltip agora será cortado para manter seu tamanho médio. com <b>html</b></>} size={"medium"}>
    <Button variant="secondary">Hover</Button>
</Tooltip>
`}
                />
            </ComponentBlock>

            {/* === POPUP === */}
            <ComponentBlock
                title="components/Popup.tsx — Popup"
                imports={`import Popup from "@/components/ui/Popup";`}
                setup={`const [showPopup, setShowPopup] = useState(false);`}
            >
                <Button variant="primary" onClick={() => setShowPopup(true)}>
                    Abrir Popup
                </Button>

                <Popup open={showPopup} onClose={() => setShowPopup(false)}>
                    <div className="p-6 text-center">
                        <h2 className="text-xl font-bold mb-4">Exemplo de Popup</h2>
                        <p className="text-gray-700 mb-6">Esse é um popup simples.</p>

                        <Button variant="secondary" onClick={() => setShowPopup(false)}>
                            Fechar
                        </Button>
                    </div>
                </Popup>

                <CodeBlock
                    code={`<Popup open={showPopup} onClose={() => setShowPopup(false)}>
  Conteúdo aqui
</Popup>

<button onClick={() => setShowPopup(true)}>
  Abrir Popup
</button>`}
                />
            </ComponentBlock>

            {/* === TOAST === */}
            <ComponentBlock
                title="components/Toast.tsx — Toast"
                imports={`import Toast from "@/components/ui/Toast";`}
                setup={`const [showToast, setShowToast] = useState(false);`}
            >
                <Button variant="primary" onClick={() => setShowToast(true)}>
                    Mostrar Toast
                </Button>

                {showToast && (
                    <Toast
                        message="Alterações salvas com sucesso!"
                        type="success"
                        onClose={() => setShowToast(false)}
                    />
                )}

                <CodeBlock
                    code={`{showToast && (
  <Toast
    message="Alterações salvas com sucesso!"
    type="success"
    onClose={() => setShowToast(false)}
  />
)}

<button onClick={() => setShowToast(true)}>
  Mostrar Toast
</button>`}
                />
            </ComponentBlock>
        </div>
    );
}

/* ---------- helpers ---------- */

function ComponentBlock({
                            title,
                            imports,
                            setup,
                            children,
                        }: {
    title: string;
    imports?: string;
    setup?: string; // extra global snippet before examples
    children: React.ReactNode;
}) {
    return (
        <section className="border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            {imports && <CodeBlock code={imports} />}
            {setup && (
                <>
                    <h3 className="text-sm font-semibold text-gray-600">Setup</h3>
                    <CodeBlock code={setup} />
                </>
            )}
            <div>{children}</div>
        </section>
    );
}

function CodeBlock({ code }: { code: string }) {
    return (
        <pre className="mt-6 bg-gray-900 text-gray-100 text-sm rounded-md p-4 overflow-x-auto leading-6">
      <code>{code}</code>
    </pre>
    );
}
