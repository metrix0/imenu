"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const steps = [
  "/restaurante/criar/localizacao",
  "/restaurante/criar/tempo-e-taxa",
  "/restaurante/criar/disponibilidade",
  "/restaurante/criar/cardapio",
];

export default function CreationStepper() {
  const pathname = usePathname();
  const currentStepIndex = steps.findIndex(step =>
    pathname.includes(step)
  );

  return (
    <div className="bg-white pb-10 flex w-full justify-center">
      <nav className="flex items-center w-full gap-2 mx-4">
        {steps.map((step, index) => {
          const isActive = index <= currentStepIndex;

          return (
            <Link
              key={step}
              href={step}
              className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-brand origin-left"
                style={{
                  transform: isActive ? "scaleX(1)" : "scaleX(0)",
                  transition: `
                    transform 500ms cubic-bezier(0.4,0,0.2,1)
                    ${index * 120}ms
                  `,
                }}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
