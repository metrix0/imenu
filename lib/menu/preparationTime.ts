export const MIN_PREPARATION_TIME_GAP = 5;

export function getPreparationTimeValidation(min: number, max: number): string {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max <= 0) {
        return "Informe tempos válidos maiores que zero.";
    }

    if (max - min < MIN_PREPARATION_TIME_GAP) {
        return `O tempo máximo deve ser pelo menos ${MIN_PREPARATION_TIME_GAP} minutos maior que o mínimo.`;
    }

    return "";
}
