// Higgsfield 3D Jutsu export. Read only the mesh data needed by this game.
// This reader handles the fixed, uncompressed pack shipped with the game.
// Keep each named asset in its own local coordinates, independent of the model-sheet layout.
import * as THREE from "three";
let models = null, pending = null;
export function loadCartoonModels() {
  if (pending) return pending;
  pending = (async () => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(new URL("../art/cartoon-models.glb", import.meta.url), { signal: controller.signal });
      if (!response.ok) throw new Error("Model pack unavailable");
      const bytes = await response.arrayBuffer(), view = new DataView(bytes);
      if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error("Invalid model pack");
      let json, bin;
      for (let p = 12; p < bytes.byteLength;) {
        const length = view.getUint32(p, true), type = view.getUint32(p + 4, true); p += 8;
        if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, p, length)));
        else if (type === 0x004e4942) bin = new DataView(bytes, p, length);
        p += length;
      }
      const read = (id) => {
        const a = json.accessors[id], b = json.bufferViews[a.bufferView];
        const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
        const types = { 5121: [1, "getUint8"], 5123: [2, "getUint16"], 5125: [4, "getUint32"], 5126: [4, "getFloat32"] };
        const [width, fn] = types[a.componentType], out = [];
        const stride = b.byteStride || size * width, start = (b.byteOffset || 0) + (a.byteOffset || 0);
        for (let i = 0; i < a.count; i++) for (let j = 0; j < size; j++) out.push(bin[fn](start + i * stride + j * width, true));
        return out;
      };
      const result = new Map(), p = new THREE.Vector3(), n = new THREE.Vector3();
      for (const root of json.nodes.filter(o => o.name?.startsWith("ASSET_"))) {
        const pos = [], normals = [], colors = [];
        const visit = (node, parent) => {
          const matrix = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation || [0, 0, 0])), new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(node.scale || [1, 1, 1])));
          matrix.premultiply(parent);
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
          if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) {
            const vertices = read(primitive.attributes.POSITION), ns = read(primitive.attributes.NORMAL);
            const indices = primitive.indices === undefined ? Array.from({ length: vertices.length / 3 }, (_, i) => i) : read(primitive.indices);
            const color = json.materials[primitive.material]?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
            for (const i of indices) {
              p.fromArray(vertices, i * 3).applyMatrix4(matrix); n.fromArray(ns, i * 3).applyNormalMatrix(normalMatrix);
              pos.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); colors.push(...color.slice(0, 3));
            }
          }
          for (const id of node.children || []) visit(json.nodes[id], matrix);
        };
        for (const id of root.children || []) visit(json.nodes[id], new THREE.Matrix4());
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeBoundingSphere(); result.set(root.name.slice(6), geometry);
      }
      if (!["rod", "lure_body", "lure_blade", "tree_pine_low", "tree_pine_high", "tree_leaf_low", "tree_leaf_high", "tree_far", "cottage", "loon"].every(k => result.has(k))) throw new Error("Incomplete model pack");
      models = result;
    } catch { /* The procedural models keep the game playable if the export cannot load. */ }
    finally { clearTimeout(timer); }
    return !!models;
  })();
  return pending;
}
export function cartoonGeometry(name) { return models?.get(name)?.clone() || null; }
export function cartoonModelsReady() { return !!models; }
