"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

export type TemplateVariable = {
    key: string;
    label: string;
    token: string;
    value: string;
};

export type TemplateEditorHandle = {
    insertVariable: (variable: TemplateVariable) => void;
};

const WHATSAPP_VARIABLES = [
    "NOME_DO_CLIENTE",
    "NUMERO_DO_PEDIDO",
    "STATUS_DO_PEDIDO",
    "LINK_DE_ACOMPANHAMENTO",
];

function isWhatsAppVariable(variable: TemplateVariable): boolean {
    return WHATSAPP_VARIABLES.includes(variable.key);
}

function getVariableTone(variable: TemplateVariable): string {
    return isWhatsAppVariable(variable)
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-brand/20 bg-brand/5 text-brand";
}

function createVariableBadge(variable: TemplateVariable): HTMLSpanElement {
    const badge = document.createElement("span");
    badge.contentEditable = "false";
    badge.dataset.variableToken = variable.token;
    badge.className =
        "group relative mx-0.5 inline-grid max-w-full cursor-default gap-0.5 align-middle text-xs";
    badge.style.fontWeight = "inherit";

    for (const line of variable.value.split("\n")) {
        const valueLine = document.createElement("span");
        valueLine.className = `block max-w-full whitespace-pre-wrap break-words rounded-sm border px-1.5 py-0.5 leading-5 ${getVariableTone(variable)}`;
        valueLine.textContent = line || "\u00A0";
        badge.append(valueLine);
    }

    const tooltip = document.createElement("span");
    tooltip.className =
        "pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100";
    tooltip.textContent = variable.token;

    badge.append(tooltip);
    return badge;
}

function appendNode(parent: HTMLElement, node: Node, bold: boolean) {
    if (!bold) {
        parent.append(node);
        return;
    }

    const strong = document.createElement("strong");
    strong.className = "font-bold";
    strong.append(node);
    parent.append(strong);
}

function appendFormattedText(
    parent: HTMLElement,
    text: string,
    initialBold: boolean
): boolean {
    let bold = initialBold;
    let buffer = "";

    const flush = () => {
        if (!buffer) return;
        appendNode(parent, document.createTextNode(buffer), bold);
        buffer = "";
    };

    for (const character of text) {
        if (character === "*") {
            flush();
            appendNode(parent, document.createTextNode("*"), true);
            bold = !bold;
            continue;
        }

        if (character === "\n") {
            flush();
            parent.append(document.createElement("br"));
            continue;
        }

        buffer += character;
    }

    flush();
    return bold;
}

function renderTemplateValue(
    editor: HTMLElement,
    value: string,
    variables: TemplateVariable[]
) {
    const variableByToken = new Map(
        variables.map((variable) => [variable.token, variable])
    );
    editor.replaceChildren();
    let bold = false;

    for (const part of value.split(/(\{\{[A-Za-z0-9_]+\}\})/g)) {
        if (!part) continue;
        const variable = variableByToken.get(part);
        if (variable) {
            appendNode(editor, createVariableBadge(variable), bold);
        } else {
            bold = appendFormattedText(editor, part, bold);
        }
    }
}

function serializeTemplateNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent || "").replace(/\u200B/g, "");
    }

    if (!(node instanceof HTMLElement)) return "";
    if (node.dataset.variableToken) return node.dataset.variableToken;
    if (node.tagName === "BR") return "\n";

    return Array.from(node.childNodes)
        .map((child) => serializeTemplateNode(child))
        .join("");
}

export const TemplateEditor = forwardRef<
    TemplateEditorHandle,
    {
        value: string;
        variables: TemplateVariable[];
        ariaLabel: string;
        onChange: (value: string) => void;
    }
>(function TemplateEditor({ value, variables, ariaLabel, onChange }, ref) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const lastSerializedRef = useRef<string | null>(null);
    const lastVariableSignatureRef = useRef("");
    const variableSignature = useMemo(
        () => variables.map((variable) => `${variable.token}:${variable.value}`).join("|"),
        [variables]
    );

    const saveSelection = () => {
        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
            savedRangeRef.current = range.cloneRange();
        }
    };

    const syncFromDom = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const next = Array.from(editor.childNodes)
            .map((node) => serializeTemplateNode(node))
            .join("");
        lastSerializedRef.current = next;
        onChange(next);
        saveSelection();
    };

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        if (
            value !== lastSerializedRef.current ||
            variableSignature !== lastVariableSignatureRef.current
        ) {
            renderTemplateValue(editor, value, variables);
            lastSerializedRef.current = value;
            lastVariableSignatureRef.current = variableSignature;
        }
    }, [value, variableSignature, variables]);

    useImperativeHandle(
        ref,
        () => ({
            insertVariable(variable: TemplateVariable) {
                const editor = editorRef.current;
                if (!editor) return;

                editor.focus();
                const selection = window.getSelection();
                let range = savedRangeRef.current?.cloneRange() || null;
                if (!range || !editor.contains(range.commonAncestorContainer)) {
                    range = document.createRange();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                }

                range.deleteContents();
                const badge = createVariableBadge(variable);
                range.insertNode(badge);
                range.setStartAfter(badge);
                range.collapse(true);
                selection?.removeAllRanges();
                selection?.addRange(range);
                savedRangeRef.current = range.cloneRange();
                syncFromDom();
            },
        }),
        [onChange]
    );

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();

        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection) return;

        let range = selection.rangeCount ? selection.getRangeAt(0) : null;
        if (!range || !editor.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }

        range.deleteContents();
        const lineBreak = document.createElement("br");
        const marker = document.createTextNode("\u200B");
        range.insertNode(lineBreak);
        lineBreak.parentNode?.insertBefore(marker, lineBreak.nextSibling);
        range.setStart(marker, 1);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        savedRangeRef.current = range.cloneRange();
        syncFromDom();
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={ariaLabel}
            aria-multiline="true"
            spellCheck
            onInput={syncFromDom}
            onBlur={saveSelection}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onKeyDown={handleKeyDown}
            onPaste={(event) => {
                event.preventDefault();
                document.execCommand(
                    "insertText",
                    false,
                    event.clipboardData.getData("text/plain")
                );
                window.requestAnimationFrame(syncFromDom);
            }}
            className="min-h-[148px] w-full whitespace-pre-wrap break-words rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/10"
        />
    );
});

export function VariablePicker({
    allowedVariables,
    variables,
    open,
    onSelect,
}: {
    allowedVariables?: string[];
    variables: TemplateVariable[];
    open: boolean;
    onSelect: (variable: TemplateVariable) => void;
}) {
    return (
        <div
            className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out ${
                open
                    ? "grid-rows-[1fr] translate-y-0 opacity-100"
                    : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"
            }`}
            aria-hidden={!open}
        >
            <div className="min-h-0 overflow-hidden">
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-medium text-gray-600">
                        Clique em uma variável para inserir na mensagem:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {variables
                            .filter((variable) => (!allowedVariables || allowedVariables.includes(variable.key)))
                            .map((variable) => (
                                <button
                                    key={variable.key}
                                    type="button"
                                    onClick={() => onSelect(variable)}
                                    className={`cursor-pointer border px-3 py-1.5 text-left text-xs transition-colors ${
                                        variable.value.includes("\n") ? "rounded-md" : "rounded-full"
                                    } ${
                                        isWhatsAppVariable(variable)
                                            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                            : "border-brand/20 bg-brand/5 text-brand hover:bg-brand/10"
                                    }`}
                                    title={variable.token}
                                >
                                    <span className="font-semibold">{variable.label}</span>
                                    <span className="ml-1 whitespace-pre-line opacity-75">
                                        ({variable.value})
                                    </span>
                                </button>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
