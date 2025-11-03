import Link from "next/link";

export default function ConfirmationPendingPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-5">
                <div className="flex flex-col items-center space-y-3">
                    
                    <h1 className="text-2xl font-semibold text-gray-900">Confirme seu e-mail</h1>
                </div>

                <p className="text-gray-700">
                    Enviamos um link de confirmação para o e-mail cadastrado.
                </p>
                <p className="text-gray-500 text-sm">
                    Por favor, verifique sua caixa de entrada ou a pasta de spam para completar seu cadastro.
                </p>

                <div className="pt-4">
                    <Link
                        href="/admin/login"
                        className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 transition-colors"
                    >
                        Ir para login
                    </Link>
                </div>
            </div>
        </div>
    );
}
