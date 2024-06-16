// / <reference types="cypress" />

declare namespace Cypress {
  interface Chainable<Subject> {
    getBySel: (selector: string) => Chainable<Subject>;
  }
}
