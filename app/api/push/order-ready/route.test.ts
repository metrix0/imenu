import { POST } from "./route";
import { notifyOrderReady } from "@/lib/push/server";

jest.mock("@/lib/push/server", () => ({ notifyOrderReady: jest.fn() }));

test("cached confirmation pages cannot trigger mobile pushes", async () => {
    const response = await POST();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ ok: false });
    expect(notifyOrderReady).not.toHaveBeenCalled();
});
