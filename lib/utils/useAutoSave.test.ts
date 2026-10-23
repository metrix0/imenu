import { createAutoSave } from "./useAutoSave";

const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
};

describe("settings autosave", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("does not write when initial data is loaded", async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const notify = jest.fn();
        const queue = createAutoSave(notify);
        queue.reset("saved");
        await jest.runAllTimersAsync();
        expect(save).not.toHaveBeenCalled();
        expect(queue.hasUnsavedChanges()).toBe(false);
    });

    it("coalesces typing into one write containing the latest edit", async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const notify = jest.fn();
        const queue = createAutoSave<string>(notify);
        queue.schedule("first", save);
        await jest.advanceTimersByTimeAsync(500);
        queue.schedule("latest", save);
        await jest.advanceTimersByTimeAsync(699);
        expect(save).not.toHaveBeenCalled();
        expect(queue.hasUnsavedChanges()).toBe(true);
        await jest.advanceTimersByTimeAsync(1);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith("latest");
        expect(notify).toHaveBeenLastCalledWith({ status: "saved", error: "" });
    });

    it("serializes writes and stays saving when edits arrive during a request", async () => {
        const first = deferred();
        const second = deferred();
        const save = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const notify = jest.fn();
        const queue = createAutoSave<string>(notify);
        queue.schedule("first", save);
        await jest.advanceTimersByTimeAsync(700);
        queue.schedule("intermediate", save);
        queue.schedule("latest", save);
        await jest.advanceTimersByTimeAsync(700);
        expect(save).toHaveBeenCalledTimes(1);
        first.resolve();
        await jest.advanceTimersByTimeAsync(0);
        expect(save.mock.calls).toEqual([["first"], ["latest"]]);
        expect(notify).toHaveBeenLastCalledWith({ status: "saving", error: "" });
        second.resolve();
        await jest.advanceTimersByTimeAsync(0);
        expect(notify).toHaveBeenLastCalledWith({ status: "saved", error: "" });
    });

    it("keeps a failed edit unsaved and retries it after connectivity returns", async () => {
        const save = jest.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(undefined);
        const notify = jest.fn();
        const queue = createAutoSave<string>(notify);
        queue.schedule("draft", save);
        await jest.advanceTimersByTimeAsync(700);
        expect(notify).toHaveBeenLastCalledWith({ status: "error", error: "Offline" });
        expect(queue.hasUnsavedChanges()).toBe(true);
        await jest.advanceTimersByTimeAsync(10000);
        expect(save).toHaveBeenCalledTimes(1);
        queue.retry();
        await jest.advanceTimersByTimeAsync(700);
        expect(save).toHaveBeenLastCalledWith("draft");
        expect(queue.hasUnsavedChanges()).toBe(false);
    });

    it("replaces a failed draft with a corrected edit instead of retrying stale data", async () => {
        const save = jest.fn().mockRejectedValueOnce(new Error("Invalid")).mockResolvedValue(undefined);
        const notify = jest.fn();
        const queue = createAutoSave<string>(notify);
        queue.schedule("invalid", save);
        await jest.advanceTimersByTimeAsync(700);
        queue.schedule("corrected", save);
        queue.retry();
        await jest.advanceTimersByTimeAsync(700);
        expect(save.mock.calls).toEqual([["invalid"], ["corrected"]]);
    });

    it("ignores an old restaurant's response and retains the new restaurant's callback", async () => {
        const first = deferred();
        const oldSave = jest.fn().mockReturnValue(first.promise);
        const newSave = jest.fn().mockResolvedValue(undefined);
        const notify = jest.fn();
        const queue = createAutoSave<string>(notify);
        queue.schedule("old restaurant", oldSave);
        await jest.advanceTimersByTimeAsync(700);
        queue.reset("saved");
        queue.schedule("new restaurant", newSave);
        await jest.advanceTimersByTimeAsync(700);
        first.resolve();
        await jest.advanceTimersByTimeAsync(0);
        expect(oldSave.mock.calls).toEqual([["old restaurant"]]);
        expect(newSave.mock.calls).toEqual([["new restaurant"]]);
        expect(notify).toHaveBeenLastCalledWith({ status: "saved", error: "" });
    });

    it("flushes a pending debounce on navigation, without duplicating the write", async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const queue = createAutoSave<string>(jest.fn());
        queue.schedule("last edit", save);
        await queue.flush();
        await jest.runAllTimersAsync();
        expect(save.mock.calls).toEqual([["last edit"]]);
    });

    it("retains the last edit when navigation happens during another save", async () => {
        const first = deferred();
        const save = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
        const queue = createAutoSave<string>(jest.fn());
        queue.schedule("first", save);
        await jest.advanceTimersByTimeAsync(700);
        queue.schedule("last edit", save);
        await queue.flush();
        first.resolve();
        await jest.advanceTimersByTimeAsync(0);
        expect(save.mock.calls).toEqual([["first"], ["last edit"]]);
    });
});
