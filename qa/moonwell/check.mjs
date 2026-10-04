// A tiny test runner for the Moonwell node checks: test(name, fn), then report() prints the results and sets the
// exit code. No packages needed.
const results = [];
export function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log('  ok   ' + name);
  } catch (e) {
    results.push({ name, ok: false });
    console.log('  FAIL ' + name + '\n       ' + (e && e.message));
  }
}
export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
export function report() {
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - bad} passed, ${bad} failed`);
  process.exitCode = bad ? 1 : 0;
}
