// The patch that vendor.mjs applies to Ink Studio's resources.mjs, so that it uses uniform-blocks.mjs. The uniforms check
// (qa/lab/gloam-downs-uniforms.e2e.mjs) uses unpatchResources() to draw the same frames without the blocks and compare them.
// Each step is [the text in Ink Studio's file, the text after the patch].
export const STEPS = [
  ["export function createResources(gl) {", "import { uniformBlocks } from './uniform-blocks.mjs';\n\nexport function createResources(gl) {"],
  ["  function program(vertex, fragment) {\n", "  function program(vertex, fragment) {\n    const blocks = uniformBlocks(gl, vertex, fragment);\n    vertex = blocks.vertex;\n    fragment = blocks.fragment;\n"],
  ["      release.push(() => gl.deleteProgram(p));\n", "      blocks.link(p, setters, release);\n      release.push(() => gl.deleteProgram(p));\n"],
  ["          for (const name of Object.keys(values)) setters[name]?.(values[name]);\n", "          for (const name of Object.keys(values)) setters[name]?.(values[name]);\n          blocks.flush();\n"]
];

function apply(text, steps, what) {
  for (const [from, to] of steps) {
    if (text.split(from).length !== 2) throw new Error(`the uniform block patch does not fit resources.mjs (${what}) at: ${from.trim()}`);
    text = text.replace(from, () => to);
  }
  return text;
}

// Ink Studio's resources.mjs -> the patched file. It throws when a step does not fit one place exactly, or when the file has the patch.
export function patchResources(text) {
  if (text.includes('uniformBlocks')) throw new Error('the uniform block patch does not fit resources.mjs: it is in the file already');
  return apply(text, STEPS, 'patch');
}
// the patched file -> Ink Studio's resources.mjs
export const unpatchResources = text => apply(text, STEPS.map(([from, to]) => [to, from]).reverse(), 'unpatch');
