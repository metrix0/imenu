export const CREATION_STEP_PATHS = {
    1: "/restaurante/criar/localizacao",
    2: "/restaurante/criar/tempo-e-taxa",
    3: "/restaurante/criar/disponibilidade",
    4: "/restaurante/criar/cardapio",
} as const;

export type CreationStep = keyof typeof CREATION_STEP_PATHS;

export function normalizeCreationStep(value: unknown): CreationStep {
    const parsed = Number(value);

    if (parsed === 2 || parsed === 3 || parsed === 4) {
        return parsed;
    }

    return 1;
}

export function getCreationStepPath(value: unknown): string {
    return CREATION_STEP_PATHS[normalizeCreationStep(value)];
}
