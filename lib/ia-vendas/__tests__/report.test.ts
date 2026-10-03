import { DIMENSIONS, makeReport } from "../report";
const ctx = {
  coverage: { items: { loaded: 97, total: 97, complete: true } },
  sales: { start: "start", end: "end" },
};
const value = () => ({
  headline: "Mais bebidas",
  summary: "Priorize o carrinho.",
  inspection: Object.fromEntries(
    DIMENSIONS.map((d) => [d, { status: "inspected", note: "Verificado" }]),
  ),
  opportunities: [
    {
      title: "Bebidas",
      explanation: "Poucos pedidos com bebidas.",
      impact: "high",
      confidence: "high",
      effort: "low",
      risk: "low",
      evidence: [
        { source: "sales", detail: "1 de 43 pedidos", entity_ids: [] },
      ],
      action_ids: ["own", "foreign"],
    },
  ],
  review_items: [],
});
test("retains evidence and real snapshots, links only tenant actions, preserves unlinked proposals", () => {
  const report = makeReport(
    ctx,
    [
      { type: "measurement", results: [{ id: "measured" }] },
      { type: "potential", cents: 76300 },
    ],
    [
      { id: "own", run_id: "run" },
      { id: "unlinked", run_id: "run", title: "Imagem", reason: "Sem foto" },
    ],
    "run",
    value(),
  );
  expect(report.opportunities[0].action_ids).toEqual(["own"]);
  expect(report.opportunities[0].evidence[0].detail).toBe("1 de 43 pedidos");
  expect(report.review_items[0].action_ids).toEqual(["unlinked"]);
  expect(report.coverage.items).toEqual({
    loaded: 97,
    total: 97,
    complete: true,
  });
  expect(report.measurement_snapshot.results[0].id).toBe("measured");
  expect(report.potential_estimate.cents).toBe(76300);
});
test("partial report preserves proposals without claiming inspection or inventing sales impact", () => {
  const report = makeReport(
    ctx,
    [],
    [
      {
        id: "saved",
        run_id: "run",
        title: "Bebidas",
        reason: "Proposta preparada",
      },
    ],
    "run",
  );
  expect(report.status).toBe("partial");
  expect(report.review_items[0].action_ids).toEqual(["saved"]);
  expect(report.inspection.images.status).toBe("not_inspected");
  expect(report.potential_estimate.available).toBe(false);
});
test("rejects reports missing an inspection dimension", () => {
  const invalid = value();
  delete (invalid.inspection as any).pricing;
  expect(() => makeReport(ctx, [], [], "run", invalid)).toThrow("formato");
});

test("failed photo loads cannot be reported as complete visual inspection", () => {
  const photoContext = {
    ...ctx,
    image_review: { loaded: 9, unavailable: 1 },
    coverage: { ...ctx.coverage, image_photos: { loaded: 9, total: 10, complete: false } },
  };
  const report = makeReport(photoContext, [], [], "run", value());
  expect(report.inspection.images.status).toBe("unavailable");
  expect(report.inspection.images.note).toContain("1 não puderam ser abertas");
  expect(report.coverage.image_photos.complete).toBe(false);
});
test("sampled photo coverage stays explicit without marking unseen photos as reviewed", () => {
  const photoContext = {
    ...ctx,
    image_review: { loaded: 6, unavailable: 0, not_reviewed: 91 },
    coverage: {
      ...ctx.coverage,
      image_photos: {
        loaded: 6,
        total: 97,
        unavailable: 0,
        not_reviewed: 91,
        complete: false,
      },
    },
  };
  const report = makeReport(photoContext, [], [], "run", value());
  expect(report.inspection.images.status).toBe("inspected");
  expect(report.inspection.images.note).toContain("6 fotos revisadas visualmente");
  expect(report.inspection.images.note).toContain("91 não foram revisadas visualmente");
  expect(report.coverage.image_photos.complete).toBe(false);
});

test("rejects unstructured or invalid priority values", () => {
  const invalid = value();
  invalid.opportunities[0].confidence = "invented";
  expect(() => makeReport(ctx, [], [], "run", invalid)).toThrow("formato");
});
