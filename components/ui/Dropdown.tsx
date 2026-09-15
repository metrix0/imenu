"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { usePanelAppearance } from "./PanelAppearance";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faCheck, faChevronDown } from "@fortawesome/free-solid-svg-icons";

export type DropdownOption = {
    value: string | number;
    label: string;
    disabled?: boolean;
};

type DropdownProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    options?: DropdownOption[];
    chevronClassName?: string;
    custom?: boolean;
};

const LegacyDropdown = React.forwardRef<HTMLSelectElement, DropdownProps>(function LegacyDropdown(
    {
        label,
        options = [],
        className = "",
        chevronClassName,
        custom = false,
        ...props
    },
    ref
) {
    const [open, setOpen] = React.useState(false);
    const selectRef = React.useRef<HTMLSelectElement>(null);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const listId = React.useId();

    React.useEffect(() => {
        if (!custom || !open) return;
        const closeOutside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", closeOutside);
        return () => document.removeEventListener("pointerdown", closeOutside);
    }, [custom, open]);

    const focusOption = (index: number) => {
        const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
        if (buttons?.length) buttons[(index + buttons.length) % buttons.length]?.focus();
    };

    React.useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement);

    const handleToggle = () => {
        setOpen((prev) => !prev);
        selectRef.current?.focus();
    };

    const isTablePicker =
        label === "Mesa" &&
        options.some(
            (option) => option.value === "" && option.label === "Selecione sua mesa"
        );

    if (isTablePicker || custom) {
        const selectedValue = props.value ?? props.defaultValue ?? (custom ? options[0]?.value : "") ?? "";
        const selectedOption = options.find(
            (option) => String(option.value) === String(selectedValue)
        );

        const handleSelect = (value: string | number) => {
            if (selectRef.current) {
                selectRef.current.value = String(value);
                selectRef.current.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }
            setOpen(false);
            if (custom) triggerRef.current?.focus();
        };

        return (
            <div ref={rootRef} data-ui="field" className={`flex flex-col gap-1.5 ${custom ? "min-w-0" : ""}`}
                onBlur={custom ? (event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
                } : undefined}
            >
                {label && (
                    <label data-ui="field-label" className="text-xs font-medium leading-[18px] text-[#1d1d1d]">
                        {label}
                    </label>
                )}

                <div className={`relative w-full ${open ? "z-[100]" : ""}`}>
                    <select
                        ref={selectRef}
                        className="sr-only"
                        tabIndex={-1}
                        {...props}
                    >
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <button
                        data-ui="dropdown-trigger"
                        ref={triggerRef}
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        aria-controls={custom ? listId : undefined}
                        aria-label={custom ? props["aria-label"] || label : undefined}
                        disabled={custom ? props.disabled : undefined}
                        onKeyDown={custom ? (event) => {
                            if (["ArrowDown", "ArrowUp"].includes(event.key)) {
                                event.preventDefault();
                                setOpen(true);
                                const index = Math.max(0, options.findIndex(option => String(option.value) === String(selectedValue)));
                                requestAnimationFrame(() => focusOption(index));
                            } else if (event.key === "Escape") setOpen(false);
                        } : undefined}
                        onClick={() => setOpen((prev) => !prev)}
                        className={`flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg border border-[#e2e5e9] bg-white px-3 py-2.5 text-left text-sm font-normal text-[#1d1d1d] outline-none transition-colors hover:bg-[#f7f8fa] focus:border-[#d93d00] disabled:cursor-not-allowed disabled:bg-[#f1f3f5] disabled:text-[#626973] ${custom ? className : ""}`}
                    >
                        <span
                            className={`truncate ${
                                selectedValue === ""
                                    ? "text-[#818994]"
                                    : "text-[#1d1d1d]"
                            }`}
                        >
                            {selectedOption?.label || (custom ? "Selecione" : "Selecione sua mesa")}
                        </span>
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className={`ml-3 shrink-0 text-xs text-[#626973] transition-transform duration-150 ${
                                open ? "rotate-180" : ""
                            }`}
                        />
                    </button>

                    <div
                        ref={listRef}
                        id={custom ? listId : undefined}
                        role="listbox"
                        aria-label={custom ? props["aria-label"] || label : undefined}
                        aria-hidden={custom ? !open : undefined}
                        inert={custom ? !open : undefined}
                        data-ui="dropdown-menu"
                        className={`absolute left-0 right-0 top-full z-[110] mt-1.5 origin-top overflow-hidden rounded-lg border bg-white shadow-[0_6px_20px_#1d1d1d12] transition-all duration-150 ease-out ${
                            open
                                ? "max-h-64 translate-y-0 scale-y-100 border-[#e2e5e9] opacity-100"
                                : "pointer-events-none max-h-0 -translate-y-1 scale-y-95 border-transparent opacity-0"
                        }`}
                    >
                        <div className="max-h-64 overflow-y-auto p-1.5">
                            {options.map((option, index) => {
                                const selected =
                                    String(option.value) === String(selectedValue);
                                const placeholder = option.value === "";

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        onKeyDown={custom ? (event) => {
                                            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                                                event.preventDefault();
                                                focusOption(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1));
                                            } else if (event.key === "Escape") {
                                                event.preventDefault();
                                                setOpen(false);
                                                triggerRef.current?.focus();
                                            }
                                        } : undefined}
                                        onClick={() => handleSelect(option.value)}
                                        className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-[5px] px-2.5 py-[9px] text-left text-sm font-normal transition-colors ${
                                            selected && !placeholder
                                                ? "bg-[#fff1ea] text-[#c43700]"
                                                : placeholder
                                                  ? "text-[#818994] hover:bg-[#f1f3f5]"
                                                  : "text-[#1d1d1d] hover:bg-[#f1f3f5]"
                                        }`}
                                    >
                                        <span className="truncate">{option.label}</span>
                                        {selected && !placeholder && (
                                            <FontAwesomeIcon
                                                icon={faCheck}
                                                className="shrink-0 text-xs text-[#c43700]"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div data-ui="field" className="flex flex-col gap-1.5">
            {label && <label data-ui="field-label" className="text-xs font-medium leading-[18px] text-[#1d1d1d]">{label}</label>}

            <div
                className="relative inline-block w-full cursor-pointer"
                onClick={handleToggle}
            >
                <select
                    ref={selectRef}
                    className={`min-h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#e2e5e9] bg-white px-3 py-2.5 pr-9 text-sm text-[#1d1d1d] outline-none transition-colors duration-150 hover:bg-[#f7f8fa] focus:border-[#d93d00] disabled:cursor-not-allowed disabled:bg-[#f1f3f5] disabled:text-[#626973] ${className}`}
                    onBlur={() => setOpen(false)}
                    {...props}
                >
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>

                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#626973] transition-transform duration-150 ${
                        open ? "rotate-180" : ""
                    } ${chevronClassName || ""}`}
                />
            </div>
        </div>
    );
});

const Dropdown = React.forwardRef<HTMLSelectElement, DropdownProps>(function Dropdown(props, ref) {
    const panel = usePanelAppearance();
    if (!panel && !props.options) {
        const { label, custom, chevronClassName, options, className = "", ...nativeProps } = props;
        return <select {...nativeProps} ref={ref} className={`min-h-11 w-full cursor-pointer rounded-lg border border-[#e2e5e9] bg-white px-3 py-2.5 text-sm text-[#1d1d1d] outline-none transition-colors hover:bg-[#f7f8fa] focus:border-[#d93d00] disabled:cursor-not-allowed disabled:bg-[#f1f3f5] disabled:text-[#626973] ${className}`} />;
    }
    const options = props.options ?? React.Children.toArray(props.children).flatMap(child => {
        if (!React.isValidElement<React.ComponentProps<"option">>(child) || child.type !== "option") return [];
        const label = String(child.props.children ?? "");
        return [{ value: String(child.props.value ?? label), label, disabled: child.props.disabled }];
    });
    return panel
        ? <PanelDropdown {...props} options={options} ref={ref} />
        : <LegacyDropdown {...props} options={options} ref={ref} />;
});

const PanelDropdown = React.forwardRef<HTMLSelectElement, DropdownProps>(function PanelDropdown(
    { label, options = [], className = "", chevronClassName, custom, children, ...props }, ref
) {
    const id = React.useId();
    const selectRef = React.useRef<HTMLSelectElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const restoreFocusRef = React.useRef(false);
    const [open, setOpen] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(props.defaultValue ?? options[0]?.value ?? "");
    const [mounted, setMounted] = React.useState(false);
    const [active, setActive] = React.useState(false);

    const closeMenu = React.useCallback((restoreFocus = false) => {
        restoreFocusRef.current = restoreFocusRef.current || restoreFocus;
        setActive(false);
        setOpen(false);
    }, []);

    React.useEffect(() => {
        if (open) {
            restoreFocusRef.current = false;
            setMounted(true);
            let secondFrame = 0;
            const frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => setActive(true)); });
            return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); };
        }

        setActive(false);
        const timer = window.setTimeout(() => {
            setMounted(false);
            if (restoreFocusRef.current) triggerRef.current?.focus();
            restoreFocusRef.current = false;
        }, 170);
        return () => window.clearTimeout(timer);
    }, [open]);

    const [position, setPosition] = React.useState<React.CSSProperties>({});
    const value = props.value ?? uncontrolledValue;
    const selected = options.find(option => String(option.value) === String(value));
    React.useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement);

    const focusOption = (index: number) => {
        const elements = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)');
        if (elements?.length) elements[(index + elements.length) % elements.length]?.focus();
    };

    React.useEffect(() => {
        if (!open) return;
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const below = window.innerHeight - rect.bottom - 12;
            const above = rect.top - 12;
            const upwards = below < Math.min(264, options.length * 44 + 12) && above > below;
            setPosition({ position: "fixed", left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: Math.min(rect.width, window.innerWidth - 16),
                top: upwards ? undefined : rect.bottom + 6, bottom: upwards ? window.innerHeight - rect.top + 6 : undefined,
                maxHeight: Math.max(44, Math.min(264, upwards ? above : below)) });
        };
        const closeOutside = (event: PointerEvent) => {
            if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) closeMenu();
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        document.addEventListener("pointerdown", closeOutside);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
            document.removeEventListener("pointerdown", closeOutside);
        };
    }, [closeMenu, open, options.length]);

    const closeOnBlur = (event: React.FocusEvent<HTMLElement>) => {
        if (!triggerRef.current?.contains(event.relatedTarget as Node) && !menuRef.current?.contains(event.relatedTarget as Node)) closeMenu();
    };
    const choose = (nextValue: string | number) => {
        if (selectRef.current) {
            selectRef.current.value = String(nextValue);
            selectRef.current.dispatchEvent(new Event("change", { bubbles: true }));
        }
        closeMenu(true);
    };

    return <div data-ui="field" className="panel-dropdown-field flex min-w-0 flex-col gap-1.5">
        {label && <label data-ui="field-label" htmlFor={`${id}-trigger`} className="block text-xs font-medium leading-[18px] text-[#1d1d1d]">{label}</label>}
        <select {...props} ref={selectRef} className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={event => { setUncontrolledValue(event.target.value); props.onChange?.(event); }}
            onInvalid={event => { props.onInvalid?.(event); triggerRef.current?.focus(); }}>
            {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>
        <button ref={triggerRef} id={`${id}-trigger`} type="button" data-ui="dropdown-trigger"
            aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
            aria-label={props["aria-label"] || label} aria-labelledby={props["aria-labelledby"]}
            aria-invalid={props["aria-invalid"]} disabled={props.disabled}
            className={`flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] border border-[#e2e5e9] bg-white px-3 py-2.5 text-left text-sm font-normal text-[#1d1d1d] outline-none transition-colors hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:bg-[#f1f3f5] disabled:text-[#626973] ${className}`}
            onClick={() => open ? closeMenu() : setOpen(true)} onBlur={closeOnBlur}
            onKeyDown={event => {
                if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                    event.preventDefault(); setOpen(true);
                    requestAnimationFrame(() => focusOption(event.key === "End" || event.key === "ArrowUp" ? -1 : 0));
                } else if (event.key === "Escape" && open) { event.stopPropagation(); closeMenu(true); }
            }}>
            <span className="min-w-0 truncate">{selected?.label ?? "Selecione"}</span>
            <FontAwesomeIcon icon={faChevronDown} className={`h-3.5 w-3.5 shrink-0 text-[#626973] transition-transform duration-150 ${open ? "rotate-180" : ""} ${chevronClassName || ""}`} />
        </button>
        {mounted && createPortal(<div className={`panel-essencial panel-dropdown-portal z-[1000] origin-top overflow-y-auto overscroll-contain rounded-[8px] border border-[#e2e5e9] bg-white p-[5px] shadow-[0_6px_20px_#1d1d1d12] transition-[opacity,transform] duration-[160ms] ease-out ${active ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"}`} style={position}
            data-state={active ? "open" : "closed"} aria-hidden={!open} inert={!open}
            ref={menuRef} id={`${id}-list`} role="listbox" aria-label={props["aria-label"] || label}
            data-ui="dropdown-menu" onBlur={closeOnBlur}>
            {options.map(option => {
                const optionSelected = String(option.value) === String(value);
                return <button key={option.value} type="button" role="option"
                aria-selected={optionSelected} disabled={option.disabled}
                className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-[5px] px-2.5 py-[9px] text-left text-sm transition-colors hover:bg-[#f1f3f5] focus-visible:bg-[#f1f3f5] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${optionSelected ? "bg-[#fff1ea] text-[#c43700]" : "text-[#1d1d1d]"}`}
                onClick={() => choose(option.value)}
                onKeyDown={event => {
                    const buttons = Array.from(menuRef.current?.querySelectorAll('[role="option"]:not(:disabled)') || []);
                    const index = buttons.indexOf(event.currentTarget);
                    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                        event.preventDefault(); focusOption(event.key === "Home" ? 0 : event.key === "End" ? -1 : index + (event.key === "ArrowDown" ? 1 : -1));
                    } else if (event.key === "Escape") {
                        event.preventDefault(); event.stopPropagation(); closeMenu(true);
                    }
                }}>
                <span>{option.label}</span>
                {optionSelected && <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />}
            </button>;
            })}
        </div>, document.body)}
    </div>;
});

export default Dropdown;
