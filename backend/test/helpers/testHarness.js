const cases = [];

function test(name, fn) {
  cases.push({ name, fn });
}

async function run() {
  let passed = 0;
  let failed = 0;

  for (const entry of cases) {
    try {
      await entry.fn();
      passed += 1;
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${entry.name}`);
      console.error(error?.stack || error);
    }
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

module.exports = {
  test,
  run,
};
