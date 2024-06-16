// / <reference types="cypress" />

Cypress.Commands.add("getBySel", (selector) => cy.get(`[data-cy=${selector}]`));
