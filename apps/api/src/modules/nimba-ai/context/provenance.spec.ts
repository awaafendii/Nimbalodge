import { buildProvenance } from "./provenance";

describe("buildProvenance", () => {
  it("construit une provenance minimale avec seulement le module", () => {
    expect(buildProvenance("Finance → Dépenses")).toEqual({ module: "Finance → Dépenses" });
  });

  it("inclut période et filtres seulement quand fournis", () => {
    const provenance = buildProvenance("Finance → Dépenses → Restaurant", {
      period: { from: "2026-08-01", to: "2026-08-31" },
      filters: { departmentId: "dept-1" },
    });

    expect(provenance).toEqual({
      module: "Finance → Dépenses → Restaurant",
      period: { from: "2026-08-01", to: "2026-08-31" },
      filters: { departmentId: "dept-1" },
    });
  });
});
