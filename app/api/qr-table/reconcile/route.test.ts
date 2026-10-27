import { POST } from "./route";
import { reconcileAddon } from "@/lib/addons/reconcile";

jest.mock("@/lib/addons/reconcile", () => ({ reconcileAddon: jest.fn() }));

it("does not charge or reconcile a paid QR plan after it becomes free", async () => {
    const response = await POST(new Request("https://example.com/api/qr-table/reconcile", { method: "POST" }));
    expect(response.status).toBe(410);
    expect(reconcileAddon).not.toHaveBeenCalled();
});
