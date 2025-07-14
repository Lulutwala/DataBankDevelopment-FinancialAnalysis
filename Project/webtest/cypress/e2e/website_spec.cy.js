describe('My Web App', () => {
  it('should load the homepage', () => {
    cy.visit('http://localhost:3006/');
    cy.contains('Finalyse');
    cy.url().should('include', 'localhost:3006');
    cy.get('#root > div > div:nth-child(2) > div.rect-wrap > h2').click();
    cy.get('#root > div > div.login-page > div.login-form-container > form > div:nth-child(1) > input')
    .type('mate.natalia@gmail.com');
    cy.get('#root > div > div.login-page > div.login-form-container > form > div:nth-child(2) > input')
    .type('nataliamate');
    cy.get('#root > div > div.login-page > div.login-form-container > form > button').click();
    cy.get('#root > div > div.menu-items > a:nth-child(1) > div > div').click();
    cy.wait(3000);
    cy.get('#root > div > div.cyptoHeader > header > div > div > div > input[type=text]').type('Bitcoin');
    cy.get('#root > div > div.cyptoHeader > header > div > div > div > button').click();
    cy.get('h2.firstd').click();
    cy.wait(3000);
    cy.get('#root > div > div.DashboardHeader > header > div > h2.secondd').click();
    cy.wait(3000);
  });
});
