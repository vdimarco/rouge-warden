import { createResources } from './resources.mjs';
import { splatShaderSources } from './shaders.mjs';

function plainVertex(source) {
  return source
    .replace('if (u_lampN > 0 &&', 'if (false &&')
    .replace('if (u_fineOn > 0.5 && plain', 'if (false && plain')
    .replace('if (i >= u_azn) break;', 'break;');
}

export function createSplatPipeline(gl, { ascii, specialize = true, sampleCoverage } = {}) {
  const resources = createResources(gl);
  try {
    const { vertex, fragment } = splatShaderSources(ascii, sampleCoverage);
    const full = resources.program(vertex, fragment);
    let plain, water, plainUnavailable = false;
    let disposed = false;
    let orderCapacity = 0, orderCount = 0;
    const vao = resources.allocate('VertexArray');
    gl.bindVertexArray(vao);
    const cornerBuffer = resources.allocate('Buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    const corners = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const orderBuffer = resources.allocate('Buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, orderBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 1, gl.INT, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    function check() {
      if (disposed) throw new Error('The Ink Studio splat pipeline has been disposed');
    }
    return {
      // Hosts may supply their own VAO or draw order. All three flags must
      // explicitly be false before the shader can omit their work.
      programFor(features) {
        check();
        if (features?.water) {
          if (!water) {
            const wet = splatShaderSources(ascii, sampleCoverage, { water: true });
            water = resources.program(wet.vertex, wet.fragment);
          }
          return water;
        }
        if (!specialize || plainUnavailable || features?.lamps !== false ||
            features.fine !== false || features.textZones !== false) return full;
        if (!plain) {
          try {
            plain = resources.program(plainVertex(vertex), fragment);
          } catch (error) {
            if (gl.isContextLost()) throw error;
            plainUnavailable = true;
            return full;
          }
        }
        return plain;
      },
      setOrder(indices) {
        check();
        if (!(indices instanceof Int32Array)) throw new TypeError('Draw order must be an Int32Array');
        gl.bindBuffer(gl.ARRAY_BUFFER, orderBuffer);
        if (indices.byteLength > orderCapacity) {
          gl.bufferData(gl.ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
          orderCapacity = indices.byteLength;
        } else if (indices.length) gl.bufferSubData(gl.ARRAY_BUFFER, 0, indices);
        orderCount = indices.length;
      },
      // The host sets the framebuffer, program uniforms, and blend state.
      draw(count = orderCount, geometry = vao) {
        check();
        if (!Number.isInteger(count) || count < 0 || (geometry === vao && count > orderCount))
          throw new RangeError('Invalid splat draw count');
        if (!count) return;
        gl.bindVertexArray(geometry);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        resources.dispose();
      }
    };
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
