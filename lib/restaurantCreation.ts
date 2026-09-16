export const CREATION_STEP_PATHS = {
    1: "/restaurante/criar/cardapio",
    2: "/restaurante/criar/disponibilidade",
    3: "/restaurante/criar/loja",
    4: "/restaurante/criar/localizacao",
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
