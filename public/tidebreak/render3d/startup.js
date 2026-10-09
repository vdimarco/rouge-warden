import { graphicsSupport } from './choice.js';
import { loadMapArt } from '../battlefield-overlay.js';

// Dependencies are injectable for startup/failure checks without a GPU. There is no alternate renderer.
export async function createBattlefield({ canvas, minimap, onProgress, support = graphicsSupport,
  loadArt = loadMapArt, loadRenderer = () => import('../three-render.js') }) {
  if (!support().webgl2) {
    const error = new Error('Shore needs 3D graphics. Enable graphics acceleration in your browser, then reload.');
    error.code = 'GRAPHICS_UNAVAILABLE';
    throw error;
  }
  const [art, module] = await Promise.all([loadArt(), loadRenderer()]);
  await module.preload(onProgress);
  return new module.ThreeRenderer(canvas, minimap, art);
}
