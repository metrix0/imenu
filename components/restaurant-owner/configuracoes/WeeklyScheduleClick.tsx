"use client";

import Dropdown from "@/components/ui/Dropdown";
import { useEffect, useRef, useState } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faPen, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";

export type TimeSlot = { open: string; close: string };
export type Availability = Record<string, TimeSlot[]>;

const DAYS = [
    { key: "0", label: "Domingo", blockLabel: "DOMINGO" },
    { key: "1", label: "Segunda", blockLabel: "SEGUNDA-FEIRA" },
    { key: "2", label: "Terça", blockLabel: "TERÇA-FEIRA" },
    { key: "3", label: "Quarta", blockLabel: "QUARTA-FEIRA" },
    { key: "4", label: "Quinta", blockLabel: "QUINTA-FEIRA" },
    { key: "5", label: "Sexta", blockLabel: "SEXTA-FEIRA" },
    { key: "6", label: "Sábado", blockLabel: "SÁBADO" },
];
const PX_PER_HOUR = 28;
const SNAP_MINUTES = 30;
const TOTAL_HEIGHT = 24 * PX_PER_HOUR;
const MINUTES_PER_DAY = 24 * 60;

const timeToMin = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};
const closeTimeToMin = (time: string) =>
    time === "00:00" || time === "24:00"
        ? MINUTES_PER_DAY - 1
        : timeToMin(time);
const minToTime = (minutes: number) => {
    const normalizedMinutes = Math.min(minutes, MINUTES_PER_DAY - 1);
    return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;
};
const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
const snap = (minutes: number) =>
    Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
const TIME_OPTIONS = [
    ...Array.from({ length: 96 }, (_, i) => minToTime(i * 15)),
    "23:59",
];
const timeOptionsFor = (time: string) =>
    TIME_OPTIONS.includes(time) ? TIME_OPTIONS : [...TIME_OPTIONS, time].sort();

type DragMode = "move" | "resize-start" | "resize-end";
type DragState = {
    dayKey: string;
    index: number;
    mode: DragMode;
    startY: number;
    originalStart: number;
    originalEnd: number;
    moved: boolean;
};

export default function WeeklyScheduleClick({
    value,
    onChange,
}: {
    value: Availability;
    onChange: (newVal: Availability) => void | Promise<void>;
}) {
    const dragRef = useRef<DragState | null>(null);
    const ignoreClickRef = useRef(false);
    const [editModal, setEditModal] = useState({
        isOpen: false,
        dayKey: "0",
        slotIndex: null as number | null,
        startTime: "00:00",
        endTime: "01:00",
    });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedDays, setSelectedDays] = useState<string[] | null>(null);
    const [isSavingMobileSlot, setIsSavingMobileSlot] = useState(false);
    const [editorError, setEditorError] = useState("");

    useEffect(() => {
        const handleMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const delta = snap(
                ((event.clientY - drag.startY) / PX_PER_HOUR) * 60,
            );
            if (Math.abs(event.clientY - drag.startY) > 3) drag.moved = true;
            let start = drag.originalStart;
            let end = drag.originalEnd;
            const duration = end - start;
            if (drag.mode === "move") {
                start = clamp(start + delta, 0, MINUTES_PER_DAY - duration);
                end = start + duration;
            }
            if (drag.mode === "resize-start") {
                start = clamp(start + delta, 0, end - SNAP_MINUTES);
            }
            if (drag.mode === "resize-end") {
                end = clamp(
                    end + delta,
                    start + SNAP_MINUTES,
                    MINUTES_PER_DAY,
                );
            }
            const current = value[drag.dayKey] || [];
            onChange({
                ...value,
                [drag.dayKey]: current.map((slot, index) =>
                    index === drag.index
                        ? { open: minToTime(start), close: minToTime(end) }
                        : slot,
                ),
            });
        };
        const handleUp = () => {
            if (dragRef.current?.moved) {
                ignoreClickRef.current = true;
                window.setTimeout(() => {
                    ignoreClickRef.current = false;
                }, 0);
            }
            dragRef.current = null;
            document.body.style.userSelect = "";
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };
    }, [onChange, value]);

    const beginDrag = (
        event: React.PointerEvent,
        dayKey: string,
        index: number,
        slot: TimeSlot,
        mode: DragMode,
    ) => {
        if (
            event.pointerType === "touch" ||
            window.matchMedia("(max-width: 767px)").matches
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        dragRef.current = {
            dayKey,
            index,
            mode,
            startY: event.clientY,
            originalStart: timeToMin(slot.open),
            originalEnd: closeTimeToMin(slot.close),
            moved: false,
        };
        document.body.style.userSelect = "none";
    };

    const openEmpty = (event: React.MouseEvent, dayKey: string) => {
        setSelectedDays(null);
        setEditorError("");
        const rect = event.currentTarget.getBoundingClientRect();
        const start = clamp(
            snap(((event.clientY - rect.top) / PX_PER_HOUR) * 60),
            0,
            1380,
        );
        setEditModal({
            isOpen: true,
            dayKey,
            slotIndex: null,
            startTime: minToTime(start),
            endTime: minToTime(start + 60),
        });
    };
    const openMobileAdd = () => {
        setSelectedDays([]);
        setEditorError("");
        setEditModal({
            isOpen: true,
            dayKey: "0",
            slotIndex: null,
            startTime: "18:00",
            endTime: "23:00",
        });
    };
    const openSlot = (
        event: React.MouseEvent,
        dayKey: string,
        index: number,
        slot: TimeSlot,
        mobile = false,
    ) => {
        event.stopPropagation();
        if (ignoreClickRef.current) return;
        setSelectedDays(mobile ? [dayKey] : null);
        setEditorError("");
        setEditModal({
            isOpen: true,
            dayKey,
            slotIndex: index,
            startTime: slot.open,
            endTime:
                slot.close === "00:00" || slot.close === "24:00"
                    ? "23:59"
                    : slot.close,
        });
    };
    const saveSlot = async () => {
        if (isSavingMobileSlot || selectedDays?.length === 0) return;
        const start = timeToMin(editModal.startTime);
        const end = closeTimeToMin(editModal.endTime);
        if (start >= end) {
            const message = "O horário de término deve ser depois do início.";
            if (selectedDays) setEditorError(message);
            else alert(message);
            return;
        }
        const nextSlot = {
            open: editModal.startTime,
            close:
                editModal.endTime === "00:00" || editModal.endTime === "24:00"
                    ? "23:59"
                    : editModal.endTime,
        };
        const nextValue = { ...value };
        let changed = false;
        for (const dayKey of selectedDays ?? [editModal.dayKey]) {
            const slots = [...(value[dayKey] || [])];
            if (editModal.slotIndex === null) {
                if (selectedDays && slots.some((slot) => timeToMin(slot.open) === start && closeTimeToMin(slot.close) === end)) continue;
                slots.push(nextSlot);
            } else {
                slots[editModal.slotIndex] = nextSlot;
            }
            nextValue[dayKey] = slots.sort((a, b) => timeToMin(a.open) - timeToMin(b.open));
            changed = true;
        }
        setEditModal((prev) => ({ ...prev, isOpen: false }));
        if (!changed) return;
        if (!selectedDays) {
            void onChange(nextValue);
            return;
        }
        setIsSavingMobileSlot(true);
        try {
            await onChange(nextValue);
        } finally {
            setIsSavingMobileSlot(false);
        }
    };
    const openDeleteModal = () => {
        setEditModal((prev) => ({ ...prev, isOpen: false }));
        window.setTimeout(() => setIsDeleteModalOpen(true), 220);
    };
    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        window.setTimeout(
            () => setEditModal((prev) => ({ ...prev, isOpen: true })),
            220,
        );
    };
    const deleteSlot = async () => {
        if (editModal.slotIndex !== null) {
            const nextValue = {
                ...value,
                [editModal.dayKey]: (value[editModal.dayKey] || []).filter(
                    (_, i) => i !== editModal.slotIndex,
                ),
            };

            setIsDeleting(true);
            try {
                await onChange(nextValue);
            } finally {
                setIsDeleting(false);
            }
        }
        setIsDeleteModalOpen(false);
        setEditModal((prev) => ({ ...prev, isOpen: false }));
    };
    const gridHours = Array.from({ length: 12 }, (_, i) => i * 2);
    const dayName = (key: string) =>
        DAYS.find((day) => day.key === key)?.label || "Dia";
    const isMobileEditor = selectedDays !== null;
    const isMobileAdd = isMobileEditor && editModal.slotIndex === null;

    return (
        <div className="@container min-w-0">
            <div className="@min-[720px]:hidden">
                <div className="mb-4 flex justify-end">
                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={<FontAwesomeIcon icon={faPlus} />}
                        disabled={isSavingMobileSlot}
                        onClick={openMobileAdd}
                    >
                        Adicionar horário
                    </Button>
                </div>
                <ul className="divide-y divide-gray-200">
                    {DAYS.map((day) => {
                        const slots = value[day.key] || [];
                        return (
                            <li key={day.key} className="grid min-h-12 grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-1.5 py-2.5">
                                <span className="text-sm font-medium text-gray-900">{day.label}</span>
                                {slots.length ? (
                                    <div className="flex min-w-0 flex-wrap gap-1.5">
                                        {slots.map((slot, index) => (
                                            <Button
                                                key={`${slot.open}-${slot.close}-${index}`}
                                                type="button"
                                                variant="secondary"
                                                className="min-h-11 whitespace-nowrap border-transparent! bg-gray-50 px-2 py-1 text-gray-900 tabular-nums hover:bg-gray-100"
                                                aria-label={`Editar horário de ${day.label}, ${slot.open} às ${slot.close === "24:00" ? "00:00" : slot.close}`}
                                                rightIcon={<FontAwesomeIcon icon={faPen} className="text-xs" />}
                                                disabled={isSavingMobileSlot}
                                                onClick={(event) => openSlot(event, day.key, index, slot, true)}
                                            >
                                                {slot.open}–{slot.close === "24:00" ? "00:00" : slot.close}
                                            </Button>
                                        ))}
                                    </div>
                                ) : <span className="text-sm text-gray-500">Fechada</span>}
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div className="relative hidden select-none flex-col @min-[720px]:flex">
            <div className="flex pb-4">
                <div className="w-10 shrink-0" />
                {DAYS.map((day) => (
                    <div
                        key={day.key}
                        className="flex flex-1 flex-col gap-1 text-center"
                    >
                        <span className="text-sm font-bold text-gray-900">
                            {day.label}
                        </span>
                        <span
                            className={`text-xs font-medium ${(value[day.key] || []).length ? "text-brand" : "text-gray-400"}`}
                        >
                            {(value[day.key] || []).length
                                ? "Aberta"
                                : "Fechada"}
                        </span>
                    </div>
                ))}
            </div>
            <div className="relative flex">
                <div className="relative w-10 shrink-0 border-r border-transparent">
                    {gridHours.map((hour) => (
                        <div
                            key={hour}
                            className="absolute w-full -mt-2 pr-3 text-right text-[11px] font-medium text-gray-400 min-[1800px]:pr-5 min-[1800px]:text-base"
                            style={{ top: hour * PX_PER_HOUR }}
                        >
                            {String(hour).padStart(2, "0")}h
                        </div>
                    ))}
                </div>
                <div
                    className="relative flex flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white"
                    style={{ height: TOTAL_HEIGHT }}
                >
                    <div className="pointer-events-none absolute inset-0 z-0">
                        {gridHours.map((hour) => (
                            <div
                                key={hour}
                                className="absolute w-full border-b border-gray-100"
                                style={{ top: hour * PX_PER_HOUR }}
                            />
                        ))}
                    </div>
                    {DAYS.map((day) => (
                        <div
                            key={day.key}
                            onClick={(e) => openEmpty(e, day.key)}
                            className="relative z-10 flex-1 cursor-pointer border-r border-gray-100 transition-colors last:border-0 hover:bg-gray-50"
                        >
                            {(value[day.key] || []).map((slot, index) => {
                                const start = timeToMin(slot.open);
                                const end = closeTimeToMin(slot.close);
                                const height =
                                    ((end - start) / 60) * PX_PER_HOUR;
                                return (
                                    <div
                                        key={`${slot.open}-${slot.close}-${index}`}
                                        onClick={(e) =>
                                            openSlot(
                                                e,
                                                day.key,
                                                index,
                                                slot,
                                            )
                                        }
                                        onPointerDown={(e) =>
                                            beginDrag(
                                                e,
                                                day.key,
                                                index,
                                                slot,
                                                "move",
                                            )
                                        }
                                        className="group absolute left-1 right-1 z-10 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-gray-900 bg-gray-800 p-1 text-white shadow-sm transition-colors hover:bg-gray-700 sm:cursor-move"
                                        style={{
                                            top: (start / 60) * PX_PER_HOUR,
                                            height,
                                            minHeight: 24,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            aria-label="Alterar início"
                                            onPointerDown={(e) =>
                                                beginDrag(
                                                    e,
                                                    day.key,
                                                    index,
                                                    slot,
                                                    "resize-start",
                                                )
                                            }
                                            className="absolute inset-x-0 top-0 hidden h-2 cursor-ns-resize bg-white/0 transition-colors hover:bg-white/25 sm:block"
                                        />
                                        {height >= 60 && (
                                            <span className="mb-1 text-xs font-medium opacity-90">
                                                <span className="sm:hidden">
                                                    {day.label.toUpperCase()}
                                                </span>
                                                <span className="hidden sm:inline">
                                                    {day.blockLabel}
                                                </span>
                                            </span>
                                        )}
                                        {height >= 26 && (
                                            <span className="whitespace-nowrap text-center text-[13px] font-bold leading-tight sm:text-sm min-[1800px]:text-lg">
                                                {slot.open}–
                                                {slot.close === "24:00"
                                                    ? "00:00"
                                                    : slot.close}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            aria-label="Alterar término"
                                            onPointerDown={(e) =>
                                                beginDrag(
                                                    e,
                                                    day.key,
                                                    index,
                                                    slot,
                                                    "resize-end",
                                                )
                                            }
                                            className="absolute inset-x-0 bottom-0 hidden h-2 cursor-ns-resize bg-white/0 transition-colors hover:bg-white/25 sm:block"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            </div>
            <Modal height={isMobileAdd ? 370 : 290}
                open={editModal.isOpen}
                onClose={() =>
                    setEditModal((prev) => ({ ...prev, isOpen: false }))
                }
            >
                <div className="p-6 text-left">
                    <h3 className="mb-6 text-xl font-bold text-gray-900">
                        {isMobileAdd ? "Novo horário" : dayName(editModal.dayKey)}
                    </h3>
                    {isMobileAdd && (
                        <fieldset className="mb-5 min-w-0">
                            <legend className="mb-2 text-sm font-medium text-gray-500">Dias da semana</legend>
                            <div className="grid grid-cols-7 gap-1">
                                {DAYS.map((day) => {
                                    const checked = selectedDays.includes(day.key);
                                    return (
                                        <Button
                                            key={day.key}
                                            type="button"
                                            aria-label={day.label}
                                            aria-pressed={checked}
                                            variant={checked ? "primary" : "secondary"}
                                            className="min-h-11 min-w-0 px-0 py-1"
                                            onClick={() => setSelectedDays((days) => days?.includes(day.key)
                                                ? days.filter((key) => key !== day.key)
                                                : [...(days ?? []), day.key])}
                                        >
                                            {day.label.slice(0, 3)}
                                        </Button>
                                    );
                                })}
                            </div>
                        </fieldset>
                    )}
                    <div className={`flex items-end ${isMobileEditor ? "mb-5 gap-2" : "mb-8 gap-4"}`}>
                        <div className="min-w-0 flex-1">
                            <label className="mb-1 block text-sm font-medium text-gray-500">
                                Das
                            </label>
                            <div className="relative">
                                <Dropdown
                                    aria-label="Das"
                                    value={editModal.startTime}
                                    onChange={(event) => {
                                        setEditorError("");
                                        setEditModal((prev) => ({
                                            ...prev,
                                            startTime: event.target.value,
                                        }));
                                    }}
                                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-3 pr-10"
                                >
                                    {timeOptionsFor(editModal.startTime).map((t) => (
                                        <option key={t}>{t}</option>
                                    ))}
                                </Dropdown>
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <label className="mb-1 block text-sm font-medium text-gray-500">
                                Até
                            </label>
                            <div className="relative">
                                <Dropdown
                                    aria-label="Até"
                                    value={editModal.endTime}
                                    onChange={(event) => {
                                        setEditorError("");
                                        setEditModal((prev) => ({
                                            ...prev,
                                            endTime: event.target.value,
                                        }));
                                    }}
                                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-3 pr-10"
                                >
                                    {timeOptionsFor(editModal.endTime).map((t) => (
                                        <option key={t}>{t}</option>
                                    ))}
                                </Dropdown>
                            </div>
                        </div>
                        {editModal.slotIndex !== null && (
                            <button
                                type="button"
                                aria-label="Excluir horário"
                                onClick={openDeleteModal}
                                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-brand transition-colors hover:bg-red-50 hover:text-red-700"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        )}
                    </div>
                    {editorError && <p role="alert" className="mb-3 text-sm text-red-700">{editorError}</p>}
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            onClick={() =>
                                setEditModal((p) => ({ ...p, isOpen: false }))
                            }
                        >
                            Cancelar
                        </Button>
                        <Button onClick={saveSlot} disabled={isSavingMobileSlot || selectedDays?.length === 0}>
                            {editModal.slotIndex === null
                                ? "Adicionar"
                                : "Salvar"}
                        </Button>
                    </div>
                </div>
            </Modal>
            <ConfirmModal
                open={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={deleteSlot}
                title="Excluir horário?"
                description={`Excluir ${editModal.startTime}–${editModal.endTime} de ${dayName(editModal.dayKey)}?`}
                confirmLabel="Excluir"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
