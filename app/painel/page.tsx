import { redirect } from "next/navigation";

export default function PainelHome({ params }: { params: { restauranteId: string } }) {
    const { restauranteId } = params;
    // redireciona para a página de pedidos do painel
    redirect(`/painel/${restauranteId}/pedidos`);
    // Não retorna UI, pois redirect faz navegação imediata
    return null;
}
