import { OPENAI_FEATURES, openAiFeatureKey } from "./openAiFeatureKeys";

test("each feature selects its own key, with shared fallback during migration", () => {
    const original = process.env;
    try {
        process.env = { ...original, OPENAI_API_KEY: "shared-test" };
        for (const feature of Object.values(OPENAI_FEATURES)) delete process.env[feature.env];
        for (const feature of Object.keys(OPENAI_FEATURES) as (keyof typeof OPENAI_FEATURES)[]) {
            expect(openAiFeatureKey(feature)).toBe("shared-test");
            process.env[OPENAI_FEATURES[feature].env] = `  ${feature}-test  `;
        }
        for (const feature of Object.keys(OPENAI_FEATURES) as (keyof typeof OPENAI_FEATURES)[]) {
            expect(openAiFeatureKey(feature)).toBe(`${feature}-test`);
        }
    } finally { process.env = original; }
});
