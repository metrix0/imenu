"use client";

import { useMemo, useState, useEffect } from "react";
import type { Category, ItemsByCategory, Item } from "@/lib/types/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { formatPrice, promotionPrice } from "@/lib/utils/formatPrice";
import Input from "@/components/ui/Input";
import DraggableModal from "@/components/ui/HybridModal";

interface SearchModalProps {
    categories: Category[];
    itemsByCategory: ItemsByCategory;
    onClose: () => void;
    onSelect: (item: Item) => void;
    flavorStep?: { current: number; total: number };
    getFinalPrice?: (item: Item) => { price?: number; error?: string };
}

const PAGE_SIZE = 10;

export default function SearchModal({ categories, itemsByCategory, onClose, onSelect, flavorStep, getFinalPrice }: SearchModalProps) {
    const [searchText, setSearchText] = useState("");
    const [openModal, setOpenModal] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchText.trim()); setVisibleCount(PAGE_SIZE); }, 300);
        return () => clearTimeout(timer);
    }, [searchText]);
    useEffect(() => { const frame = requestAnimationFrame(() => setOpenModal(true)); return () => cancelAnimationFrame(frame); }, []);
    const closeWithAnimation = () => { setOpenModal(false); setTimeout(onClose, 250); };

    const allItems = useMemo(() => {
        const orderedCategories = [...categories, ...Object.keys(itemsByCategory).filter(id => !categories.some(c => c.id === id)).map(id => ({ id, name: "Outros", position: 0 }))];
        return orderedCategories.flatMap(category => (itemsByCategory[category.id] || [])
            .filter(item => item.is_available && (!debouncedSearch || item.name.toLocaleLowerCase("pt-BR").includes(debouncedSearch.toLocaleLowerCase("pt-BR"))))
            .map(item => ({ item, category })));
    }, [categories, itemsByCategory, debouncedSearch]);
    const hasMore = visibleCount < allItems.length;
    useEffect(() => {
        // Desktop modals mount their portal after the parent effect runs.
        if (!sentinel || !hasMore || !openModal) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) setVisibleCount(count => count + PAGE_SIZE);
        }, { rootMargin: "100px" });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [sentinel, hasMore, openModal, visibleCount, debouncedSearch]);

    useEffect(() => {
        if (!openModal) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = original; };
    }, [openModal]);

    return <DraggableModal open={openModal} onClose={closeWithAnimation} height={1} handle>
        <div className="sticky top-0 z-10 w-full bg-white pb-3 pt-5">
            {flavorStep && <h2 className="mb-3 font-semibold">Escolha o sabor {flavorStep.current} de {flavorStep.total}</h2>}
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1"><Input icon={<FontAwesomeIcon icon={icons.faMagnifyingGlass} />} placeholder={flavorStep ? "Buscar sabores..." : "Buscar no cardápio..."} value={searchText} onChange={e => setSearchText(e.target.value)} /></div>
                <button className="shrink-0 text-brand" onClick={closeWithAnimation}>Cancelar</button>
            </div>
            {flavorStep && <p className="mt-2 text-sm text-gray-500">Preço final com os sabores escolhidos e os complementos do primeiro sabor.</p>}
        </div>
        {!allItems.length && <p className="px-4 py-16 text-center text-gray-500">{debouncedSearch ? `Nenhum item encontrado para “${debouncedSearch}”.` : "Nenhum item disponível."}</p>}
        <div className="mt-3 pb-8">
            {allItems.slice(0, visibleCount).map(({ item, category }, index, visible) => {
                const quote = getFinalPrice?.(item);
                return <div key={item.id}>
                    {(index === 0 || visible[index - 1].category.id !== category.id) && <h3 className="mb-2 mt-5 text-lg font-semibold">{category.name}</h3>}
                    <button disabled={Boolean(quote?.error)} className="flex w-full items-center gap-3 border-b border-gray-200 py-3 text-left disabled:opacity-50" onClick={() => onSelect(item)}>
                        <img src={item.image_public_url || "/placeholders/item.png"} alt="" className="h-16 w-16 shrink-0 rounded object-cover" loading="lazy" />
                        <div className="min-w-0 flex-1"><p className="font-semibold">{item.name}</p>{item.description && <p className="line-clamp-2 text-sm text-gray-600">{item.description}</p>}{quote?.error && <p className="mt-1 text-xs text-gray-600">{quote.error}</p>}</div>
                        <div className="shrink-0 text-right">{getFinalPrice && <p className="text-xs text-gray-500">Preço Final</p>}<p className="font-semibold">{quote?.error ? "Indisponível" : formatPrice(quote?.price ?? promotionPrice(item) ?? item.price_cents)}</p></div>
                    </button>
                </div>;
            })}
            {hasMore && <div ref={setSentinel} className="py-4 text-center"><button className="text-brand" onClick={() => setVisibleCount(n => n + PAGE_SIZE)}>Carregar mais</button></div>}
        </div>
    </DraggableModal>;
}
