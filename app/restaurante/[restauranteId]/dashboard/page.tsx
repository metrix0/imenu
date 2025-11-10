// Exemplo em: app/restaurante/[restauranteId]/dashboard/page.tsx
import PayoutsDashboard from "@/components/PayoutsDashboard";
import SalesDashboard from "@/components/SalesDashboard";


export default async function DashboardPage({ params }: { params: Promise<{ restauranteId: string }> }
) {
    const resolvedParams = await params;
    const id = resolvedParams.restauranteId; // It can be restaurant_id too
    
    console.log("SERVER LOG: Params resolvidos:", resolvedParams);
    console.log("SERVER LOG: ID a ser passado:", id);
    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            
            {/* Sales component, Graphs and Filters */}
            <SalesDashboard menuId={id} />

            {/* Payouts componentes */}
            <PayoutsDashboard menuId={id} />
        </div>
    );
}