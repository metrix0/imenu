// Explicit breakpoints are supported by GPT-5.6 and GPT-6 models.
export function supportsExplicitPromptCache(model: string): boolean {
    return /^gpt-(?:5\.6|6(?:\.\d+)?)(?:-|$)/.test(model);
}

export const explicitPromptCache = { prompt_cache_options: { mode: "explicit" } } as const;

export function cacheDeveloperInstructions(instructions: string, context: string) {
    return {
        role: "developer" as const,
        content: [
            { type: "input_text" as const, text: instructions, prompt_cache_breakpoint: { mode: "explicit" as const } },
            ...(context ? [{ type: "input_text" as const, text: context }] : []),
        ],
    };
}
