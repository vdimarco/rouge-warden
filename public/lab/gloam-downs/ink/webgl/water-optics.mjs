// Exact ray intervals through the published water columns. Distance is in
// world units, independently of perspective, ortho, and the scene depth ramp.
export const waterGLSL = `
uniform highp sampler2D u_waterData;
uniform int u_waterCount;
uniform vec4 u_waterMin[8], u_waterMax[8], u_waterGrid[8];
uniform vec4 u_waterTint[8], u_waterLoss[8], u_waterHighlight[8];
uniform mat4 u_waterView;
uniform vec3 u_waterEye;
uniform vec3 u_waterCamera;
uniform float u_waterTime;

bool waterSlab(inout vec2 interval, float p, float d, float low, float high) {
  if (abs(d) < 1e-8) return p >= low && p < high;
  vec2 times = (vec2(low, high) - p) / d;
  interval = vec2(max(interval.x, min(times.x, times.y)), min(interval.y, max(times.x, times.y)));
  return interval.x < interval.y;
}

void waterSurface(int body, vec3 p, vec3 ray, vec4 column, inout vec3 light, inout vec3 through,
                  inout vec3 mark) {
  vec4 highlight = u_waterHighlight[body];
  vec2 flow = clamp(column.zw, vec2(-4.0), vec2(4.0));
  vec2 position = p.xz - flow * (u_waterTime * 0.25);
  vec2 phase = vec2(dot(position, vec2(3.1, 1.9)), dot(position, vec2(-1.7, 4.4))) +
    u_waterTime * vec2(2.0, -1.6);
  vec2 ripple = sin(phase);
  float grazing = pow(max(0.0, 1.0 - abs(ray.y)), 3.0);
  float foam = (1.0 - smoothstep(0.05, 0.4, column.y - column.x)) *
    smoothstep(0.08, 0.73, (ripple.x + ripple.y) * 0.5) * u_waterTint[body].w;
  float opacity = clamp(highlight.w * (0.16 + 0.84 * grazing) + foam, 0.0, 1.0);
  light += through * mix(highlight.rgb, vec3(0.9, 0.98, 0.94), foam) * opacity;
  through *= 1.0 - opacity;
  float refraction = u_waterMax[body].w;
  if (mark.x == 0.0 && refraction > 0.0) {
    vec2 shift = round(ripple * refraction);
    mark = vec3(1.0, (float(body * 16) + shift.x + 4.0) / 255.0, (shift.y + 4.0) / 8.0);
  }
}

void waterColumns(int body, vec3 eye, vec3 ray, float limit, inout vec3 light, inout vec3 through,
                  inout vec3 mark, inout float caustic) {
  vec4 low = u_waterMin[body], high = u_waterMax[body], grid = u_waterGrid[body];
  vec2 range = vec2(0.0, limit);
  if (!waterSlab(range, eye.x, ray.x, low.x, high.x) ||
      !waterSlab(range, eye.z, ray.z, low.z, high.z)) return;
  vec2 origin = (eye.xz - low.xz) / grid.xy, direction = ray.xz / grid.xy;
  if (abs(ray.x) < 1e-8) direction.x = 0.0;
  if (abs(ray.z) < 1e-8) direction.y = 0.0;
  vec2 crossing = origin + direction * range.x;
  ivec2 count = ivec2(grid.zw), stepCell = ivec2(sign(direction));
  ivec2 cell = ivec2(floor(crossing));
  if (stepCell.x < 0 && crossing.x == floor(crossing.x)) cell.x--;
  if (stepCell.y < 0 && crossing.y == floor(crossing.y)) cell.y--;
  cell = clamp(cell, ivec2(0), count - 1);
  vec2 face = vec2(cell) + max(vec2(stepCell), 0.0);
  vec2 next = vec2(direction.x == 0.0 ? 1e30 : (face.x - origin.x) / direction.x,
                   direction.y == 0.0 ? 1e30 : (face.y - origin.y) / direction.y);
  vec2 stride = vec2(direction.x == 0.0 ? 0.0 : abs(1.0 / direction.x),
                     direction.y == 0.0 ? 0.0 : abs(1.0 / direction.y));
  float start = range.x;
  bool surfaceSeen = false;
  for (int cellStep = 0; cellStep < 128; cellStep++) {
    float end = max(start, min(range.y, min(next.x, next.y)));
    vec4 column = texelFetch(u_waterData, cell + ivec2(0, int(low.w)), 0);
    if (end > start && column.y > column.x) {
      vec2 wet = vec2(start, end);
      bool horizontal = abs(ray.y) < 1e-8;
      if (horizontal ? eye.y > column.x && eye.y < column.y : waterSlab(wet, eye.y, ray.y, column.x, column.y)) {
        float top = horizontal ? -1.0 : (column.y - eye.y) / ray.y;
        bool surface = !surfaceSeen && top >= start && top <= end && top < limit;
        if (surface && ray.y < 0.0)
          waterSurface(body, eye + ray * top, ray, column, light, through, mark);
        vec3 transmission = exp(-u_waterLoss[body].rgb * (wet.y - wet.x));
        light += through * (1.0 - transmission) * u_waterTint[body].rgb;
        through *= transmission;
        if (surface && ray.y > 0.0)
          waterSurface(body, eye + ray * top, ray, column, light, through, mark);
        surfaceSeen = surfaceSeen || surface;
        if (wet.y == limit) {
          vec3 p = eye + ray * limit;
          float depth = column.y - p.y;
          vec2 xz = p.xz - clamp(column.zw, vec2(-4.0), vec2(4.0)) * (u_waterTime * 0.17);
          float a = sin(dot(xz, vec2(7.1, 3.8)) + u_waterTime * 2.1);
          float b = sin(dot(xz, vec2(-5.2, 6.4)) - u_waterTime * 1.7);
          caustic = smoothstep(0.78, 0.98, abs(a * b)) * exp(-max(0.0, depth) * 1.2) * u_waterLoss[body].w;
        }
      }
    }
    if (end >= range.y) break;
    bvec2 crossFace = lessThanEqual(next, vec2(end));
    if (crossFace.x) { cell.x += stepCell.x; next.x += stride.x; }
    if (crossFace.y) { cell.y += stepCell.y; next.y += stride.y; }
    if (any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, count))) break;
    start = end;
  }
}

vec3 waterPaint(vec3 color, vec2 pixel, vec2 size, float axial, out vec3 mark) {
  mark = vec3(0);
  if (u_waterCount == 0 || axial <= 0.0) return color;
  vec2 plane = (pixel * 2.0 / size - 1.0) * u_waterCamera.xy;
  bool ortho = u_waterCamera.z > 0.5;
  mat3 basis = transpose(mat3(u_waterView));
  vec3 eye = u_waterEye + (ortho ? basis * vec3(plane, 0.0) : vec3(0));
  vec3 direction = basis * vec3(ortho ? vec2(0) : plane, -1.0);
  float rayScale = length(direction);
  vec3 ray = direction / rayScale;
  float limit = axial * rayScale;
  float starts[8];
  for (int i = 0; i < 8; i++) {
    starts[i] = 1e30;
    if (i >= u_waterCount) break;
    vec3 low = u_waterMin[i].xyz, high = u_waterMax[i].xyz;
    vec2 hit = vec2(0.0, limit);
    if (waterSlab(hit, eye.x, ray.x, low.x, high.x) && waterSlab(hit, eye.y, ray.y, low.y, high.y) &&
        waterSlab(hit, eye.z, ray.z, low.z, high.z)) starts[i] = hit.x;
  }
  vec3 light = vec3(0), through = vec3(1);
  float caustic = 0.0;
  for (int j = 0; j < 8; j++) {
    int body = -1;
    float first = 1e30;
    for (int i = 0; i < 8; i++) {
      if (i >= u_waterCount) break;
      if (starts[i] < first) { body = i; first = starts[i]; }
    }
    if (body < 0) break;
    starts[body] = 1e30;
    waterColumns(body, eye, ray, limit, light, through, mark, caustic);
  }
  return light + through * mix(color, vec3(0.93, 1.0, 0.86), caustic);
}
`;

export const waterBackgroundShader = `#version 300 es
precision highp float;
${waterGLSL}
uniform vec2 u_waterViewport;
uniform vec3 u_waterBackground;
layout(location=0) out vec4 scene;
layout(location=1) out vec4 depth;
layout(location=2) out vec4 mask;
void main() {
  vec3 mark;
  scene = vec4(waterPaint(u_waterBackground, gl_FragCoord.xy, u_waterViewport, 400.0, mark), 1);
  depth = vec4(1, 0, 0, 1);
  mask = vec4(mark, 1);
}`;
