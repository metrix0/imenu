import robots from "../robots";

const rules = robots().rules;
const groups = Array.isArray(rules) ? rules : [rules];

function groupFor(agent: string) {
    return groups.find(group =>
        (Array.isArray(group.userAgent) ? group.userAgent : [group.userAgent])
            .some(value => value?.toLowerCase() === agent.toLowerCase())
    );
}

test.each([
    "Googlebot",
    "Googlebot-Image",
    "Google-InspectionTool",
    "AdsBot-Google",
    "Mediapartners-Google",
    "GoogleOther",
    "OAI-SearchBot",
    "ChatGPT-User",
    "PerplexityBot",
    "Perplexity-User",
    "Claude-SearchBot",
    "Claude-User",
    "bingbot",
])("allows existing Google and search/user retrieval crawler %s", agent => {
    expect(groupFor(agent)?.allow).toBe("/");
});

test.each(["GPTBot", "ClaudeBot", "Google-Extended"])("explicitly blocks training crawler %s", agent => {
    expect(groupFor(agent)?.disallow).toBe("/");
});

test("keeps unknown bots blocked and the canonical sitemap unchanged", () => {
    expect(groupFor("*")?.disallow).toBe("/");
    expect(robots().sitemap).toBe("https://www.imenuapp.com.br/sitemap.xml");
});
