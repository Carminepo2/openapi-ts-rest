describe("index page", () => {
  it("should correctly opens the index page", () => {
    cy.visit("/");
    cy.get("h1").should("contain", "OpenAPI to Ts Rest Contract");
  });

  it("should show the input and output editor", () => {
    cy.visit("/");
    const input = cy.getBySel("input");
    input.should("exist");
    input.should("contain.text", "openapi: 3");

    const output = cy.getBySel("output");
    output.should("exist");
    output.should("contain.text", 'import { initContract } from "@ts-rest/core";');
  });
});
