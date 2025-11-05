import AddSubitemClient from "./add-subitem-client";

type Props = {
    params: Promise<{ id: string; itemId: string; subcatId: string }>;
};

export default async function Page({ params }: Props) {
    const { id: menuId, itemId, subcatId } = await params;

    return <AddSubitemClient menuId={menuId} itemId={itemId} subcatId={subcatId} />;
}
