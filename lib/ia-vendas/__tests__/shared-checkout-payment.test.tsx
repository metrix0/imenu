import { renderToStaticMarkup } from "react-dom/server";
import { faCoins, faCrown } from "@fortawesome/free-solid-svg-icons";
import PaymentCheckout, { type PaymentCheckoutProduct } from "@/components/payments/PaymentCheckout";

const product: PaymentCheckoutProduct = {
  name: "Créditos do Assistente IA",
  periodLabel: "Compra única",
  detail: "1.000.000 entrada + 60.000 saída",
  priceLabel: "R$ 1,64",
  icon: faCoins,
  pixDescription: "Pagamento único",
  cardDescription: "",
  pixNotice: "Os créditos serão adicionados após a confirmação do Pix.",
  cardNotice: "",
  pixConfirmationDescription: "Créditos liberados após confirmação.",
  cardConfirmationDescription: "",
};

const handlers = {
  onClose: () => {},
  startPayment: async () => ({
    active: false, paymentMethod: "pix" as const,
    paymentStatus: "pending", qrCodeText: "mock-pix",
  }),
  reconcilePayment: async () => ({ active: false, paymentStatus: "pending" }),
};

test("shared checkout displays the exact-cent AI recharge with Pix as its only payment option", () => {
  const html = renderToStaticMarkup(
    <PaymentCheckout product={product} pixOnly {...handlers} />,
  );
  expect(html).toContain("Finalizar pedido");
  expect(html).toContain("Créditos do Assistente IA");
  expect(html).toContain("R$ 1,64");
  expect(html).toContain("Pagar R$ 1,64");
  expect(html).toContain("Pagamento único");
  expect((html.match(/data-ui="choice"/g) || [])).toHaveLength(1);
});

test("the same checkout still supports both Pix and card for recurring Plus billing", () => {
  const plus = { ...product, name: "iMenu Plus", priceLabel: "R$ 49,99", periodLabel: "Mensal", icon: faCrown };
  const html = renderToStaticMarkup(
    <PaymentCheckout product={plus} {...handlers} />,
  );
  expect(html).toContain("iMenu Plus");
  expect(html).toContain("Pagar R$ 49,99");
  expect((html.match(/data-ui="choice"/g) || [])).toHaveLength(2);
  expect(html).toContain("Cartão de crédito");
});
