const { When, Then, Before, After, Status } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const { handleGenericForm, switchToTabOrModule, clickButton, waitUntilPageIsReady, performKeyboardActions,sendAndValidateInvites } = require('../utils/commonFunctions');
const myOrg_json = require('../testData/myOrg.json');
const fs = require('fs');
const path = require('path');

Before(async function () {
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
});

After(async function (scenario) {
    if (scenario.result?.status === Status.FAILED) {
        if (this.page) {
            const fileName = `${scenario.pickle.name.replace(/ /g, '_')}_${Date.now()}.png`;
            const filePath = `./reports/screenshots/${fileName}`;
            const screenshot = await this.page.screenshot({ path: filePath, fullPage: true });
            await this.attach(fs.readFileSync(filePath), 'image/png');

            console.log(`📸 Screenshot captured for failed scenario: ${scenario.pickle.name}`);
            console.log(`🔹 Error in: ${scenario.pickle.uri} at step: ${scenario.pickle.steps.map(s => s.text).join(' -> ')}`);
        }
    }
    if (this.browser) {
        await this.browser.close();
    }
});

When('User switches to My Organization tab', async function () {
    await waitUntilPageIsReady(this.page);
    await switchToTabOrModule(this.page, myOrg_json.tabs[0]);
});

When('User clicks on Role tab', async function () {
    await waitUntilPageIsReady(this.page);
    await switchToTabOrModule(this.page, myOrg_json.tabs[1]);
});

When('User allows location access', async function () {
    await this.page.waitForTimeout(2000);
    await performKeyboardActions(this.page, myOrg_json.keyboardAction);
});

When('User clicks on New Role button', async function () {
    await this.page.waitForTimeout(2000);
    await clickButton(this.page, myOrg_json.button[1]);
});

Then('User should see the role creation form and fill in the details',{ timeout: 60 * 1000 }, async function () {
    await handleGenericForm(this.page, myOrg_json.roleForm_stepper1);
    console.log("Stepper 1 form submitted. Waiting before filling Stepper 2...");
    await waitUntilPageIsReady(this.page); // Ensure page is ready before next step
    await handleGenericForm(this.page, myOrg_json.roleForm_stepper2);
    console.log("Stepper 2 form submitted. Waiting before filling Stepper 3...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    await waitUntilPageIsReady(this.page);
    await handleGenericForm(this.page, myOrg_json.roleForm_stepper3);
});

// ********************Team Creation Steps*****************************************
When('User clicks on Teams tab', async function () {
    await waitUntilPageIsReady(this.page);
    await switchToTabOrModule(this.page, myOrg_json.tabs[2]);
});

When('User clicks on Add Team button',{ timeout: 60 * 1000 }, async function () {
    await this.page.waitForTimeout(2000);
    await clickButton(this.page, myOrg_json.button[2]);
});

Then('User should see the Team creation form and fill in the details',{ timeout: 60 * 1000 }, async function () {
    await waitUntilPageIsReady(this.page);
    await handleGenericForm(this.page, myOrg_json.teamCreation_form);
});

//*************** */
When('User clicks on Users tab', async function () {
    await waitUntilPageIsReady(this.page);
    await switchToTabOrModule(this.page, myOrg_json.tabs[3]);
});

When('User clicks on Invite Users button',{ timeout: 60 * 1000 }, async function () {
    await waitUntilPageIsReady(this.page);
   await clickButton(this.page, myOrg_json.button[3]);
});

Then('User should send the invitation and validate the subject',{ timeout: 60 * 2000 }, async function () {
    await waitUntilPageIsReady(this.page);
    const result =await sendAndValidateInvites(this.page, myOrg_json);
    console.log(result);
});
