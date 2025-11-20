// app/restaurante/[restauranteId]/add-menu/page.tsx
import AddMenuClient from "./add-menu-client";

export default function Page({ params }: { params: { restauranteId: string } }) {
    // passa restauranteId (em português) para o cliente
    return <AddMenuClient restauranteId={params.restauranteId} />;
}