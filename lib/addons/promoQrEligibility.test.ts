import {hasLegacyQrPurchase} from "./promoQrEligibility";
test("legacy payment history remains eligible after free QR activation and subscription cancellation",()=>{
 expect(hasLegacyQrPurchase([{amount_cents:500,status:"CONFIRMED"}])).toBe(true);
 expect(hasLegacyQrPurchase([{amount_cents:490,status:"APPROVED"}])).toBe(true);
 expect(hasLegacyQrPurchase([{amount_cents:500,status:"REFUNDED"}])).toBe(false);
 expect(hasLegacyQrPurchase([{amount_cents:0,status:"CONFIRMED"}])).toBe(false);
 expect(hasLegacyQrPurchase([])).toBe(false);
});
