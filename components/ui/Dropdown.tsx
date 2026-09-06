"use client";
import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronDown } from "@fortawesome/free-solid-svg-icons";

export type DropdownOption = {
    value: string | number;
    label: string;
};

type DropdownProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    options: DropdownOption[];
    chevronClassName?: string;
    custom?: boolean;
};

const Dropdown = React.forwardRef<HTMLSelectElement, DropdownProps>(function Dropdown(
    {
        label,
        options,
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
            <div ref={rootRef} className={`flex flex-col gap-1 2xl:gap-2 ${custom ? "min-w-0" : ""}`}
                onBlur={custom ? (event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
                } : undefined}
            >
                {label && (
                    <label className="text-xs font-medium 2xl:text-base">
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
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 outline-none transition hover:border-gray-400 focus:border-brand 2xl:px-5 2xl:py-4 2xl:text-lg ${custom ? className : ""}`}
                    >
                        <span
                            className={`truncate ${
                                selectedValue === ""
                                    ? "text-gray-400"
                                    : "text-gray-900"
                            }`}
                        >
                            {selectedOption?.label || (custom ? "Selecione" : "Selecione sua mesa")}
                        </span>
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className={`ml-3 shrink-0 text-xs text-brand transition-transform duration-200 ${
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
                        className={`absolute left-0 right-0 top-full z-[110] mt-2 origin-top overflow-hidden rounded-xl border bg-white shadow-lg transition-all duration-200 ease-out ${
                            open
                                ? "max-h-64 translate-y-0 scale-y-100 border-gray-200 opacity-100"
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
                                        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition 2xl:text-base ${
                                            selected && !placeholder
                                                ? "bg-brand/5 text-brand"
                                                : placeholder
                                                  ? "text-gray-400 hover:bg-gray-50"
                                                  : "text-gray-700 hover:bg-gray-50"
                                        }`}
                                    >
                                        <span className="truncate">{option.label}</span>
                                        {selected && !placeholder && (
                                            <FontAwesomeIcon
                                                icon={faCheck}
                                                className="shrink-0 text-xs text-brand"
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
        <div className="flex flex-col gap-1 2xl:gap-2">
            {label && <label className="text-xs font-medium 2xl:text-base">{label}</label>}

            <div
                className="relative inline-block w-full cursor-pointer"
                onClick={handleToggle}
            >
                <select
                    ref={selectRef}
                    className={`w-full appearance-none border border-gray-300 rounded-md px-3 py-3 pr-9 bg-white text-gray-900 outline-none transition-all duration-150 cursor-pointer 2xl:rounded-lg 2xl:px-4 2xl:py-4 2xl:pr-11 2xl:text-lg ${className}`}
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
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-transform duration-200 pointer-events-none 2xl:right-4 2xl:text-lg ${
                        open ? "rotate-180" : ""
                    } ${chevronClassName || ""}`}
                />
            </div>
        </div>
    );
});

export default Dropdown;
