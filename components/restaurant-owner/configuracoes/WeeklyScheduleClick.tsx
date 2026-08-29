"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faTrash } from "@fortawesome/free-solid-svg-icons";
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
    const openSlot = (
        event: React.MouseEvent,
        dayKey: string,
        index: number,
        slot: TimeSlot,
    ) => {
        event.stopPropagation();
        if (ignoreClickRef.current) return;
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
    const saveSlot = () => {
        const start = timeToMin(editModal.startTime);
        const end = closeTimeToMin(editModal.endTime);
        if (start >= end) {
            return alert("O horário de término deve ser depois do início.");
        }
        const slots = [...(value[editModal.dayKey] || [])];
        const nextSlot = {
            open: editModal.startTime,
            close:
                editModal.endTime === "00:00" || editModal.endTime === "24:00"
                    ? "23:59"
                    : editModal.endTime,
        };
        if (editModal.slotIndex === null) slots.push(nextSlot);
        else slots[editModal.slotIndex] = nextSlot;
        onChange({
            ...value,
            [editModal.dayKey]: slots.sort(
                (a, b) => timeToMin(a.open) - timeToMin(b.open),
            ),
        });
        setEditModal((prev) => ({ ...prev, isOpen: false }));
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

    return (
        <div className="relative flex min-w-[720px] flex-col select-none">
            <div className="flex pb-4">
                <div className="w-14 shrink-0" />
                {DAYS.map((day) => (
                    <div
                        key={day.key}
                        className="flex flex-1 flex-col gap-1 text-center"
                    >
                        <span className="text-lg font-bold text-gray-900">
                            {day.label}
                        </span>
                        <span
                            className={`text-sm font-medium ${(value[day.key] || []).length ? "text-brand" : "text-gray-400"}`}
                        >
                            {(value[day.key] || []).length
                                ? "Aberta"
                                : "Fechada"}
                        </span>
                    </div>
                ))}
            </div>
            <div className="relative flex">
                <div className="relative w-14 shrink-0 border-r border-transparent">
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
                                            <span className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-80">
                                                {day.blockLabel}
                                            </span>
                                        )}
                                        {height >= 26 && (
                                            <span className="text-center text-sm font-bold leading-tight min-[1800px]:text-lg">
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
            <Modal
                open={editModal.isOpen}
                onClose={() =>
                    setEditModal((prev) => ({ ...prev, isOpen: false }))
                }
            >
                <div className="p-6 text-left">
                    <h3 className="mb-6 text-xl font-bold text-gray-900">
                        {dayName(editModal.dayKey)}
                    </h3>
                    <div className="mb-8 flex items-end gap-4">
                        <div className="flex-1">
                            <label className="mb-1 block text-sm font-medium text-gray-500">
                                Das
                            </label>
                            <div className="relative">
                                <select
                                    value={editModal.startTime}
                                    onChange={(e) =>
                                        setEditModal((p) => ({
                                            ...p,
                                            startTime: e.target.value,
                                        }))
                                    }
                                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-3 pr-10"
                                >
                                    {TIME_OPTIONS.map((t) => (
                                        <option key={t}>{t}</option>
                                    ))}
                                </select>
                                <FontAwesomeIcon
                                    icon={faChevronDown}
                                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500"
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="mb-1 block text-sm font-medium text-gray-500">
                                Até
                            </label>
                            <div className="relative">
                                <select
                                    value={editModal.endTime}
                                    onChange={(e) =>
                                        setEditModal((p) => ({
                                            ...p,
                                            endTime: e.target.value,
                                        }))
                                    }
                                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-3 pr-10"
                                >
                                    {TIME_OPTIONS.map((t) => (
                                        <option key={t}>{t}</option>
                                    ))}
                                </select>
                                <FontAwesomeIcon
                                    icon={faChevronDown}
                                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500"
                                />
                            </div>
                        </div>
                        {editModal.slotIndex !== null && (
                            <button
                                type="button"
                                onClick={openDeleteModal}
                                className="flex h-[50px] w-[50px] shrink-0 cursor-pointer items-center justify-center rounded-full text-brand transition-colors hover:bg-red-50 hover:text-red-700"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        )}
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            onClick={() =>
                                setEditModal((p) => ({ ...p, isOpen: false }))
                            }
                        >
                            Cancelar
                        </Button>
                        <Button onClick={saveSlot}>
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
