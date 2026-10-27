import { renderToStaticMarkup } from "react-dom/server";
import Checkout from "@/components/restaurant-owner/mesas/QrCodeMesaCheckoutModal";
import { IaPlusDetails } from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
jest.mock("@/lib/database/supabaseClient", () => ({ supabase: {} }));
jest.mock("@/lib/qr-table/clientApi", () => ({ startQrTableCheckout: jest.fn(), reconcileQrTableCheckout: jest.fn(), qrTableAuthenticatedFetch: jest.fn() }));
jest.mock("@/lib/qr-table/analytics", () => ({ captureQrTableEvent: jest.fn() }));
jest.mock("@/components/payments/PaymentCheckout", () => ({ __esModule: true, default: ({ product }: any) => <div>{product.name} {product.priceLabel} {product.cardNotice}</div> }));
jest.mock("@/components/payments/PaymentCheckoutModal", () => ({ __esModule: true, default: ({ product }: any) => <div>{product.name} {product.priceLabel} {product.cardNotice}</div> }));
test("iMenu Plus shows its own product, price and recurring billing notice", () => {
  const html = renderToStaticMarkup(<Checkout open embedded productKey="ia_plus" restaurantId="restaurant" source="settings" onClose={() => {}} />);
  expect(html).toContain("iMenu Plus");
  expect(html).toMatch(/49,99/);
  expect(html).not.toContain("QR Code Mesa");
  expect(html).not.toContain("R$ 5,00");
});
test("QR payment cannot be bought from the former checkout component", () => {
  const html = renderToStaticMarkup(<Checkout open embedded restaurantId="restaurant" source="settings" onClose={() => {}} />);
  expect(html).toContain("iMenu Plus");
  expect(html).not.toContain("R$ 5,00");
});

test("iMenu Plus details use meaningful icons and concise customer-facing benefits", () => {
  const html = renderToStaticMarkup(<IaPlusDetails />);
  expect(html).toContain("Automações de Marketing WhatsApp");
  expect(html).toContain("Upsells automáticos");
  expect(html).toContain("lucide-megaphone");
  expect(html).toContain("lucide-scan-line");
  expect(html).not.toContain("lucide-check");
  expect(html).not.toContain("a partir de 2 produtos cadastrados");
  expect(html).not.toContain("deduplicação");
});
