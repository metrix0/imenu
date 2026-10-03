import { renderToStaticMarkup } from "react-dom/server";
import Checkout from "@/components/restaurant-owner/mesas/QrCodeMesaCheckoutModal";
jest.mock("@/lib/database/supabaseClient", () => ({ supabase: {} }));
jest.mock("@/lib/qr-table/clientApi", () => ({ startQrTableCheckout: jest.fn(), reconcileQrTableCheckout: jest.fn(), qrTableAuthenticatedFetch: jest.fn() }));
jest.mock("@/lib/qr-table/analytics", () => ({ captureQrTableEvent: jest.fn() }));
jest.mock("@/components/payments/PaymentCheckout", () => ({ __esModule: true, default: ({ product }: any) => <div>{product.name} {product.priceLabel} {product.cardNotice}</div> }));
jest.mock("@/components/payments/PaymentCheckoutModal", () => ({ __esModule: true, default: ({ product }: any) => <div>{product.name} {product.priceLabel} {product.cardNotice}</div> }));
test("IA Plus shows its own product, price and recurring billing notice", () => {
  const html = renderToStaticMarkup(<Checkout open embedded productKey="ia_plus" restaurantId="restaurant" source="settings" onClose={() => {}} />);
  expect(html).toContain("iMenu IA Plus");
  expect(html).toMatch(/49,99/);
  expect(html).not.toContain("QR Code Mesa");
  expect(html).not.toContain("R$ 5,00");
});
test("the existing QR checkout keeps its original name and price", () => {
  const html = renderToStaticMarkup(<Checkout open embedded restaurantId="restaurant" source="settings" onClose={() => {}} />);
  expect(html).toContain("iMenu QR Code Mesa");
  expect(html).toContain("R$ 5,00");
  expect(html).not.toContain("iMenu IA Plus");
});
