import { createMenuRequestCache } from "./requestCache";

afterEach(() => jest.useRealTimers());

it("shares pending and successful reads by key until the result expires", async () => {
    jest.useFakeTimers();
    const read = jest.fn(async (key: string) => key);
    const load = createMenuRequestCache(read);
    const pending = load("item-1");

    expect(load("item-1")).toBe(pending);
    await expect(pending).resolves.toBe("item-1");
    await expect(load("item-2")).resolves.toBe("item-2");
    jest.advanceTimersByTime(29_999);
    expect(load("item-1")).toBe(pending);
    jest.advanceTimersByTime(1);
    expect(load("item-1")).not.toBe(pending);
    expect(read.mock.calls).toEqual([["item-1"], ["item-2"], ["item-1"]]);
});

it("retries a failed request and caches an empty successful result", async () => {
    const read = jest.fn(async (_key: string): Promise<string[]> => [])
        .mockRejectedValueOnce(new Error("unavailable"));
    const load = createMenuRequestCache(read);

    await expect(load("item")).rejects.toThrow("unavailable");
    await expect(load("item")).resolves.toEqual([]);
    await expect(load("item")).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(2);
});
