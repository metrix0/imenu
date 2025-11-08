// app/restaurante/[restauranteId]/add-menu/page.tsx
import AddMenuClient from "./add-menu-client";

export default function Page({ params }: { params: { restauranteId: string } }) {
    // passa tanto restaurantId quanto restauranteId para ser resiliente
    return <AddMenuClient restaurantId={params.restauranteId} restauranteId={params.restauranteId} />;
}