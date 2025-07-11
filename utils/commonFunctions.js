const { expect } = require('@playwright/test');

// ************************Handle Custom Checkboxes************************
async function handleGenericForm(page, formJson) {
  const fields = formJson.fields || {};
  const buttonText = formJson.buttonText;
  const expectedToast = formJson.expectedToast || null;
  const requiredError = formJson.requiredError || null;
  const matchIndex = formJson.matchIndex || 1;

  // 🔹 Validate required error before filling
  if (requiredError) {
    const submitBtn = page.locator(`xpath=(//*[contains(text(),'${buttonText}')])[${matchIndex}]`);
    if (await submitBtn.isVisible()) {
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();
      console.log(`Clicked action button (pre-submit): "${buttonText}"`);

      const errorLocator = page.locator(`text=${requiredError}`);
      try {
        await errorLocator.waitFor({ state: 'visible', timeout: 7000 });
        console.log(`✅ Required validation message shown: "${requiredError}"`);
      } catch {
        console.warn(`⚠️ Expected required error message not found.`);
      }
    }
  }

  // 🔹 Fill form fields
  for (const [label, config] of Object.entries(fields)) {
    const { value } = config;

    try {
      // Handle Date Picker
      if (
        value && config.type === "dateselection" &&
        typeof value === 'object' &&
        'id' in value &&
        'day' in value &&
        'index' in value
      ) {
        const datePickerTrigger = page.locator(`(//*[text()='${label}']//following::mobius-date-picker)[1]`);
        await datePickerTrigger.waitFor({ state: 'visible', timeout: 10000 });
        await datePickerTrigger.click({ force: true });

        const dateLocator = page.locator(`(//div[contains(text(),'${value.day}')])[${value.index}]`);
        await dateLocator.waitFor({ state: 'visible', timeout: 10000 });
        await dateLocator.click();
        console.log(`✅ Picked date "${value.day}" for "${label}"`);
        continue;
      }

      // Handle Checkbox Array
      if (
        Array.isArray(value) &&
        value.every(v => typeof v === 'object' && 'text' in v && 'matchIndex' in v)
      ) {
        for (const valObj of value) {
          const val = valObj.text;
          const idx = valObj.matchIndex;
          const checkbox = page.locator(
            `xpath=(//*[contains(@*, 'checkbox')]//following::*[normalize-space(text())='${val}'])[${idx}]`
          );

          await checkbox.waitFor({ state: 'visible', timeout: 10000 });
          await checkbox.click();
          console.log(`✅ Checked "${val}" under "${label}"`);
        }
        continue;
      }

      // Handle Tag Input
      if (
        Array.isArray(value) && config.type === "tag" &&
        value.every(v => typeof v === 'string')
      ) {
        const tagInput = page.locator(`xpath=(//*[contains(text(),'${label}')]//following::mobius-div[3])[1]`);
        await tagInput.waitFor({ state: 'visible', timeout: 10000 });
        for (const val of value) {
          await tagInput.click();
          await page.keyboard.type(val);
          await page.keyboard.press('Enter');
          console.log(`✅ Entered tag "${val}" for "${label}"`);
        }
        continue;
      }

      // Handle Dropdown
      if (
        Array.isArray(value) &&
        config.type === "dropdown"
      ) {
        // Try more robust locator:
        const dropdownTrigger = page.locator(`xpath=(//*[normalize-space(text())='${label}']//following::mobius-dropdown-input-container/*)[1]`);

        if (await dropdownTrigger.count() === 0) {
          console.error(`Dropdown trigger not found for label "${label}".`);
          continue;
        }

        // Ensure dropdown is open before the loop starts
        await dropdownTrigger.waitFor({ state: 'visible', timeout: 15000 });
        await dropdownTrigger.click();
        console.log(`✅ Opened dropdown for "${label}".`);

        for (const val of value) {
          // Wait for options to be present
          await page.waitForTimeout(200);

          const optionLocator = page.locator(`xpath=(//mobius-list-item[normalize-space(text())='${val}'])[1]`);
          console.log(`Looking for option "${val}" in dropdown "${label}"...`);

          // Click the option
          await optionLocator.click({ force: true });
          console.log(`✅ Selected option "${val}" for "${label}".`);

          // Re-open the dropdown if there are more options to select
          if (value.indexOf(val) < value.length - 1) {
            await dropdownTrigger.click();
            console.log(`🔄 Re-opened dropdown for next selection.`);
          }

          await page.waitForTimeout(300);
        }

        // Optional: Close the dropdown by clicking the label
        const labelClickLocator = page.locator(`xpath=(//*[normalize-space(text())='${label}'])[1]`);
        await labelClickLocator.click({ force: true });
        console.log(`✅ Closed dropdown by clicking label "${label}".`);

        console.log(`✅ Completed dropdown selection for "${label}".`);
        continue;
      }

      // Handle Input Field
      const inputLocator = page.locator(`xpath=(//*[contains(text(),'${label}')]//following::mobius-div[2])[1]`);
      await inputLocator.waitFor({ state: 'visible', timeout: 10000 });
      await inputLocator.click();
      await page.keyboard.type(value.toString());

      let maskedValue = value;
      if (label.toLowerCase().includes('password')) maskedValue = '****';
      if (typeof value === 'string' && value.includes('@')) {
        const [user, domain] = value.split('@');
        maskedValue = '*'.repeat(user.length) + '@' + domain;
      }

      console.log(`✅ Filled "${label}" with "${maskedValue}"`);
    } catch (err) {
      console.error(`❌ Failed to process field "${label}": ${err.message}`);
      continue;
    }
  }

  // 🔹 Submit form
  const actionButton = page.locator(`xpath=(//*[contains(text(),'${buttonText}')])[${matchIndex}]`);
  await actionButton.waitFor({ state: 'visible', timeout: 10000 });
  await expect(actionButton).toBeEnabled();
  await actionButton.click();
  console.log(`✅ Clicked action button: "${buttonText}"`);

  // 🔹 Toast validation
  if (expectedToast) {
    const toastLocator = page.locator(`text=${expectedToast}`);
    await toastLocator.waitFor({ state: 'visible', timeout: 10000 });
    console.log(`✅ Toast message shown: "${expectedToast}"`);
  }
}

//************************Generic switchToTab()/Module Function************************
async function switchToTabOrModule(page, config) {
  let tabArray = [];

  // Accept either: [{name: 'tab'}] or {name: 'tab'}
  if (Array.isArray(config)) {
    tabArray = config.map(t => t.name);
  } else if (config?.name) {
    tabArray = [config.name]; // single tab
  } else if (config?.tabs) {
    tabArray = config.tabs.map(t => t.name);
  } else {
    console.warn('"tabName" or "tabs" not found or invalid in JSON');
    return;
  }

  for (const tabText of tabArray) {
    if (!tabText || typeof tabText !== 'string') {
      console.warn(`Invalid tab name: ${tabText}`);
      continue;
    }

    const tabLocator = page.locator(`xpath=(//*[text()='${tabText}'])[1]`);

    if (await tabLocator.count() === 0) {
      console.warn(`Tab/module "${tabText}" not found`);
      continue;
    }

    if (await tabLocator.isVisible()) {
      await tabLocator.click();
      console.log(`Switched to tab/module: "${tabText}"`);
    } else {
      console.warn(`Tab/module "${tabText}" is present but not visible.`);
    }
  }
}

//************************Click Button Function************************
async function clickButton(page, buttonConfig) {
  const label = buttonConfig?.label;

  if (!label || typeof label !== 'string') {
    console.warn('Invalid or missing "label" in button config');
    return;
  }

  const button = page.locator(`xpath=(//*[normalize-space(text())='${label}'])[1]`);

  const count = await button.count();
  if (count === 0) {
    console.warn(`Button with label "${label}" not found.`);
    const allButtons = await page.locator('//mobius-button').allTextContents();
    console.log('Available buttons on screen:', allButtons);
    return;
  }

  try {
    await button.waitFor({ state: 'visible', timeout: 5000 });
    await expect(button).toBeEnabled({ timeout: 5000 });
    await button.click();
    console.log(`Clicked on button: "${label}"`);
  } catch (error) {
    console.error(`Failed to click button "${label}":`, error.message);
    throw error;
  }
}

//*************************Wait Until Page is Ready************************
async function waitUntilPageIsReady(page) {
  await page.waitForLoadState('load');        // Waits for the full load event
  await page.waitForLoadState('domcontentloaded'); // Waits until the DOM is parsed
  await page.waitForLoadState('networkidle');
}

//*************************Navigate and Enter using Keyboard************************
async function performKeyboardActions(page, actions = []) {
  if (!Array.isArray(actions) || actions.length === 0) {
    console.warn('"keyboardAction" config is missing or invalid.');
    return;
  }

  for (const action of actions) {
    const key = action.key;
    const repeat = action.repeat;
    const wait = action.wait;

    if (!key) {
      console.warn('Missing "key" in keyboard action config.');
      continue;
    }

    for (let i = 0; i < repeat; i++) {
      await page.keyboard.press(key);
      await page.keyboard.press('Enter');
    }

    console.log(`Pressed "${key}" ${repeat} time(s) with ${wait}ms wait.`);
  }
}

//********************Generic invitation sender and email validator.*****************/
// utils/sendAndValidateInvites.js
async function sendAndValidateInvites(page, config) {
  // Dynamically import ESM-compatible packages
  const dotenv = await import('dotenv');
  dotenv.config();

  // Always get credentials
  const imapUser = process.env.GMAIL_USER;
  const imapPass = process.env.GMAIL_PASS;

  const emailList = Array.isArray(config.emails) ? config.emails : [config.emails];

  // Step 1: Fill email inputs
  for (const email of emailList) {
    const emailInputLocator = page.locator(`xpath=(//*[contains(normalize-space(.), "${config.labels.emailInput}")]//following::*[1])`);
    await emailInputLocator.waitFor({ state: "visible", timeout: 10000 });
    await emailInputLocator.fill(email);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    console.log(`✅ Entered email: ${email}`);
  }

  // Step 2: Click send button
  const sendButtonLocator = page.locator(`xpath=(//*[contains(normalize-space(.), "${config.labels.sendButton}")]//ancestor::button)[1]`);
  await sendButtonLocator.waitFor({ state: "visible", timeout: 10000 });
  await sendButtonLocator.click();
  console.log(`✅ Clicked send button`);

  // Step 3: Wait for success modal
  const successModalLocator = page.locator(`xpath=(//*[contains(normalize-space(.), "${config.labels.successModal}")])[1]`);
  await successModalLocator.waitFor({ state: "visible", timeout: 15000 });
  console.log(`✅ Success modal appeared`);

  // Step 4: Decide whether to use Gmail IMAP or Mailinator
  if (imapUser && imapPass) {
    console.log(`🔑 Detected Gmail credentials, using IMAP...`);
    const { default: Imap } = await import('imap');
    const { simpleParser } = await import('mailparser');

    const imap = new Imap({
      user: imapUser,
      password: imapPass,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    function openInbox(cb) {
      imap.openBox("INBOX", true, cb);
    }

    return new Promise((resolve, reject) => {
      imap.once("ready", () => {
        openInbox((err) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          console.log(`🔍 Searching inbox for subject: "${config.subject}"`);
          const criteria = ["UNSEEN", ["SUBJECT", config.subject]];

          imap.search(criteria, (err, results) => {
            if (err) {
              imap.end();
              return reject(err);
            }
            if (!results.length) {
              imap.end();
              return reject(new Error(`❌ No emails found with subject "${config.subject}"`));
            }

            const f = imap.fetch(results, { bodies: "" });
            let found = false;

            f.on("message", (msg) => {
              msg.on("body", (stream) => {
                simpleParser(stream, (err, mail) => {
                  if (err) return;
                  console.log(`✅ Email received: "${mail.subject}"`);
                  found = true;
                });
              });
            });

            f.once("end", () => {
              imap.end();
              if (found) {
                resolve(`✅ Email with subject "${config.subject}" received.`);
              } else {
                reject(new Error(`❌ No matching email body parsed.`));
              }
            });
          });
        });
      });

      imap.once("error", (err) => reject(err));
      imap.connect();
    });
  } else {
    console.log(`📨 No Gmail credentials found. Falling back to Mailinator...`);

    // Wait a few seconds to allow email delivery
    await new Promise((r) => setTimeout(r, 10000));

    // Mailinator fetch
    const recipient = emailList[0];
    const inbox = recipient.split("@")[0];
    const apiUrl = `https://www.mailinator.com/fetch_public?to=${inbox}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`❌ Mailinator fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const message = data.messages.find((msg) => msg.subject.includes(config.subject));

    if (!message) {
      throw new Error(`❌ No email found in Mailinator inbox "${inbox}" with subject containing "${config.subject}"`);
    }

    console.log(`✅ Mailinator email received: "${message.subject}"`);
    return `✅ Mailinator: Email with subject "${message.subject}" received.`;
  }
}

//********************Generic tooltip hover and validator*****************/
// utils/verifyTooltip.js

async function verifyTooltip(page, config) {
  const xpath = `(//*[text()="${config.targetText}"])[1]`;
  const hoverTarget = page.locator(`xpath=${xpath}`);

  console.log(`⏳ Waiting for target to be visible: ${config.targetText}`);
  await hoverTarget.waitFor({ state: "visible", timeout: 10000 });

  console.log(`👁️ Scrolling into view...`);
  await hoverTarget.scrollIntoViewIfNeeded();

  console.log(`🖱️ Hovering on: ${config.label}`);
  await hoverTarget.hover({ force: true });

  // ✅ Use CSS selector syntax instead of invalid XPath
  const tooltipSelector = config.tooltipSelector || `mobius-router[title*="${config.targetText}"]`;
  const tooltipLocator = page.locator(tooltipSelector);

  console.log(`⏳ Waiting for tooltip to appear...`);
  await tooltipLocator.waitFor({ state: "visible", timeout: 5000 });

  const actualTooltipText = (await tooltipLocator.textContent())?.trim();
  console.log(`🔍 Tooltip text: ${actualTooltipText}`);

  if (actualTooltipText !== config.expectedText) {
    throw new Error(`❌ Tooltip mismatch. Expected: "${config.expectedText}", Got: "${actualTooltipText}"`);
  }

  console.log(`✅ Tooltip validation passed`);
}

//********************Generic expand and Collapse validator*****************/
// utils/expandCollapseUtils.js

async function openTriggerIfPresent(page, selector) {
  if (!selector) return;
  const element = page.locator(selector);
  if (await element.isVisible()) {
    console.log(`🔘 Clicking: ${selector}`);
    await element.click();
  }
}

async function expandSection(page, label) {
  const toggle = page.locator(`text=${label} >> xpath=../..//button[contains(@aria-label, "Expand")]`);
  if (await toggle.isVisible()) await toggle.click();
}

async function collapseSection(page, label) {
  const toggle = page.locator(`text=${label} >> xpath=../..//button[contains(@aria-label, "Collapse")]`);
  if (await toggle.isVisible()) await toggle.click();
}

async function isSectionExpanded(page, label) {
  const section = page.locator(`text=${label} >> xpath=../..`);
  const expanded = await section.getAttribute('aria-expanded');
  return expanded === 'true';
}


// ******************** Navigate to Infra Page ********************/
async function goToInfraSection(page, sectionName, infraName) {
  await page.click(`text=${sectionName}`);
  await page.waitForSelector(`text=${infraName}`, { timeout: 10000 });

  const row = page.locator(`xpath=//tbody//mobius-tr[.//text()[contains(., "${infraName}")]]`);
  await row.waitFor({ state: 'visible', timeout: 10000 });

  const moreOptionsIcon = row.locator('img.cursor-pointer').first();
  await moreOptionsIcon.waitFor({ state: 'visible', timeout: 10000 });
  await moreOptionsIcon.click();

  const viewInfraBtn = row.locator(`xpath=.//mobius-div[contains(text(), "View Infrastructure")]`);
  await viewInfraBtn.waitFor({ state: 'visible', timeout: 10000 });
  await viewInfraBtn.click();

  console.log(`✅ Navigated to Infrastructure: ${infraName}`);
}

// ******************** Open Storage Tab and Model ********************/
async function openStorageModelOptions(page, tabName, modelName) {
  await page.click(`text=${tabName}`);
  await page.waitForSelector(`text=${modelName}`, { timeout: 10000 });

  const row = page.locator(`xpath=//tbody//mobius-tr[.//text()[contains(., "${modelName}")]]`);
  await row.waitFor({ state: 'visible', timeout: 10000 });

  const moreOptionsBtn = row.locator(`img.cursor-pointer`);
  await moreOptionsBtn.first().click();
  console.log(`✅ Clicked 3-dot options button for model "${modelName}"`);

  const editButton = row.locator(`mobius-div:has-text("Edit Storage")`).filter({
    hasNot: page.locator('[class*="cursor-not-allowed"]'),
  });

  await editButton.first().waitFor({ state: 'visible', timeout: 10000 });
  await editButton.first().click();
  console.log(`✅ Clicked "Edit Storage" button for model "${modelName}"`);
}

// ******************** Generic Edit Storage Form Handler ********************/
async function editStorageForm(page, formJson) {
  const fields = formJson.fields || {};
  const buttonText = formJson.buttonText || "Update";
  const expectedToast = formJson.expectedToast || "Storage is updated Successfully";
  const matchIndex = formJson.matchIndex || 1;

  for (const [label, config] of Object.entries(fields)) {
    const value = config.value;
    const type = config.type || 'input';

    try {
      console.log(`👉 Processing field: ${label}, type: ${type}`);

      if (type === 'dropdown') {
        // Find dropdown label and its nearest dropdown container
        const labelLocator = page.locator(`xpath=//label[contains(text(), "${label}")]`);
        await labelLocator.waitFor({ state: 'visible', timeout: 10000 });

        const dropdown = labelLocator.locator(`xpath=following::mobius-dropdown-input-container[@id='dropdown-input-container'][1]`);
        await dropdown.waitFor({ state: 'visible', timeout: 10000 });
        await dropdown.click();

        const option = page.locator(`xpath=//mobius-listbox-option[normalize-space(.)="${value}"]`);
        await option.waitFor({ state: 'visible', timeout: 10000 });
        await option.click();

        console.log(`✅ Selected "${value}" in dropdown "${label}"`);
        continue;
      }

      if (type === 'input') {
        const input = page.locator(`xpath=(//*[text()='${label}']//following::input)[1]`);
        await input.waitFor({ state: 'visible', timeout: 10000 });

        const existingValue = await input.inputValue();
        if (!existingValue?.trim()) {
          await input.fill(value.toString());
          console.log(`📝 Filled "${label}" with "${value}"`);
        } else {
          console.log(`⏭️ Skipped "${label}", already has value: "${existingValue}"`);
        }
        continue;
      }

      console.warn(`⚠️ Unsupported field type "${type}" for "${label}"`);
    } catch (err) {
      console.error(`❌ Error in field "${label}": ${err.message}`);
    }
  }

  // 🔽 Scroll down and submit
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const submitBtn = page.locator(`xpath=(//*[contains(text(),'${buttonText}')])[${matchIndex}]`);
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  console.log(`🚀 Clicked "${buttonText}" button`);

  // ✅ Verify toast
  const toastLocator = page.locator(`text=${expectedToast}`);
  await toastLocator.waitFor({ state: 'visible', timeout: 5000 });
  console.log(`✅ Toast appeared: "${expectedToast}"`);
}


module.exports = {
  handleGenericForm,
  switchToTabOrModule,
  clickButton,
  waitUntilPageIsReady,
  performKeyboardActions,
  sendAndValidateInvites,
  verifyTooltip,
  openTriggerIfPresent,
  expandSection,
  collapseSection,
  isSectionExpanded,
  goToInfraSection,
  openStorageModelOptions,
  editStorageForm
};


