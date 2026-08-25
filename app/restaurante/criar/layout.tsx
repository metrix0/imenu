"use client";

import CreationStepper from "@/components/restaurant-owner/configuracoes/CreationStepper";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "./mobile.css";

export default function CreationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { productSelectionCompleted } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const isConfirmationPage = pathname?.includes("/info/otp");
    const isProductSelection =
        pathname === "/restaurante/criar/localizacao" &&
        !productSelectionCompleted;

    useEffect(() => {
        const checkStatus = async () => {
            if (isConfirmationPage) {
                setIsLoading(false);
                return;
            }

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                router.replace("/restaurante/login");
                return;
            }

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("first_time")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (restaurant?.first_time === false) {
                router.replace("/painel");
                return;
            }

            setIsLoading(false);
        };

        void checkStatus();
    }, [isConfirmationPage, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full min-w-0 flex-col overflow-x-hidden bg-white">
            <header className="top-0 z-10 flex w-full items-center justify-between bg-white px-4 py-5 sm:px-2 sm:py-7 2xl:px-4 2xl:py-10">
                <div className="relative h-6 w-32 sm:ml-4 2xl:h-8 2xl:w-60">
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu Logo"
                        fill
                        className="object-contain object-left"
                    />
                </div>
            </header>

            {!isConfirmationPage && !isProductSelection && (
                <CreationStepper />
            )}

            <div
                className="creation-mobile-content min-w-0 flex-1"
                data-creation-path={pathname || "/restaurante/criar"}
            >
                {children}
            </div>
        </div>
    );
}
