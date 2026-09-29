import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface LiquidSmokeOptions {
  color: string
  background: string
  intensity: number
  scale: number
  speed: number
  height: number
  warp: number
  grain: number
  seed: number
}

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_bg;
uniform float u_intensity;
uniform float u_scale;
uniform float u_height;
uniform float u_warp;
uniform float u_grain;
uniform float u_seed;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;
  p = p * u_scale + u_seed;
  float t = u_time;

  vec2 drift = vec2(0.0, -t * 0.32);
  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(5.2, 1.3) + drift * 0.8));
  vec2 r = vec2(
    fbm(p + u_warp * q + vec2(1.7, 9.2) + drift * 0.6),
    fbm(p + u_warp * q + vec2(8.3, 2.8) + drift * 0.9)
  );
  float f = fbm(p + u_warp * r);

  float rise = 1.0 - smoothstep(0.0, u_height, uv.y);
  float plume = pow(max(f, 0.0), 1.8) * rise;
  float glow = plume * u_intensity * 1.8;
  vec3 col = mix(u_bg, u_color, clamp(glow, 0.0, 1.0));

  float n = hash(floor(gl_FragCoord.xy) + u_seed) - 0.5;
  col += n * u_grain * 0.22;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

const UNIFORMS = [
  'u_res',
  'u_time',
  'u_color',
  'u_bg',
  'u_intensity',
  'u_scale',
  'u_height',
  'u_warp',
  'u_grain',
  'u_seed',
] as const

type UniformName = (typeof UNIFORMS)[number]

interface Program {
  gl: WebGLRenderingContext
  program: WebGLProgram
  uniforms: Record<UniformName, WebGLUniformLocation | null>
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.replace(/./g, (ch) => ch + ch) : value
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export class LiquidSmokeEngine implements DotCanvasEngine<WebGLRenderingContext> {
  idle = false
  options: LiquidSmokeOptions
  private width = 0
  private height = 0
  private dpr = 1
  private time = 0
  private program: Program | null = null

  constructor(options: LiquidSmokeOptions) {
    this.options = options
  }

  setOptions(options: LiquidSmokeOptions) {
    this.options = options
    this.idle = false
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width
    this.height = height
    this.dpr = dpr
    this.idle = false
  }

  setPointer() {}

  tick(dt: number) {
    this.time += dt * this.options.speed
    this.idle = this.options.speed === 0
  }

  draw(gl: WebGLRenderingContext) {
    const program = this.ensureProgram(gl)
    if (!program) return
    const { uniforms } = program
    const o = this.options
    const w = Math.round(this.width * this.dpr)
    const h = Math.round(this.height * this.dpr)
    gl.viewport(0, 0, w, h)
    gl.useProgram(program.program)
    gl.uniform2f(uniforms.u_res, w, h)
    gl.uniform1f(uniforms.u_time, this.time)
    gl.uniform3fv(uniforms.u_color, hexToRgb(o.color))
    gl.uniform3fv(uniforms.u_bg, hexToRgb(o.background))
    gl.uniform1f(uniforms.u_intensity, o.intensity)
    gl.uniform1f(uniforms.u_scale, Math.max(0.1, o.scale))
    gl.uniform1f(uniforms.u_height, Math.max(0.05, o.height))
    gl.uniform1f(uniforms.u_warp, o.warp)
    gl.uniform1f(uniforms.u_grain, o.grain)
    gl.uniform1f(uniforms.u_seed, o.seed)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  drawStatic(gl: WebGLRenderingContext) {
    this.draw(gl)
  }

  private ensureProgram(gl: WebGLRenderingContext): Program | null {
    if (this.program && this.program.gl === gl) return this.program
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return null
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const uniforms = {} as Record<UniformName, WebGLUniformLocation | null>
    for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name)
    this.program = { gl, program, uniforms }
    return this.program
  }
}
