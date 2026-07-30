const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const { loadWithMocks } = require("./helpers/loadWithMocks");

const service = loadWithMocks("src/services/integrationLabService.js", {
  "../models/IntegrationLabScenario": {},
  "../models/IntegrationLabAttempt": {},
});

test("integration lab normalizes scenario keys", () => {
  assert.equal(service.normalizeKey(" Retry Salesforce 01 "), "retry-salesforce-01");
});

test("integration lab parses Basic credentials containing colon in password", () => {
  const encoded = Buffer.from("salesforce:secret:part").toString("base64");
  assert.deepEqual(service.parseBasicAuthorization(`Basic ${encoded}`), {
    username: "salesforce",
    password: "secret:part",
  });
});

test("integration lab compares secrets without accepting different lengths", () => {
  assert.equal(service.safeEqual("abc", "abc"), true);
  assert.equal(service.safeEqual("abc", "abcd"), false);
});

test("integration lab never accepts an unconfigured secret", () => {
  assert.equal(service.matchesConfiguredSecret("", undefined), false);
  assert.equal(service.matchesConfiguredSecret("token", ""), false);
  assert.equal(service.matchesConfiguredSecret("token", "token"), true);
});
