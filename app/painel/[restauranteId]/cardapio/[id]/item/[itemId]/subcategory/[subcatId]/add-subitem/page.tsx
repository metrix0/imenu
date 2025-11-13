import AddSubitemClient from "./add-subitem-client";

type Props = {
    params: Promise<{ restauranteId: string; id: string; itemId: string; subcatId: string }>;
};

export default async function Page({ params }: Props) {
    const { restauranteId, id: menuId, itemId, subcatId } = await params;

    return <AddSubitemClient restauranteId={restauranteId} menuId={menuId} itemId={itemId} subcatId={subcatId} />;
}
