import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface GrainGradientOptions {
  colorLight: string
  colorMid: string
  colorDark: string
  angle: number
  position: number
  curve: number
  softness: number
  scale: number
  grain: number
  grainSize: number
  seed: number
  speed: number
}

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_dpr;
uniform float u_time;
uniform vec3 u_light;
uniform vec3 u_mid;
uniform vec3 u_dark;
uniform float u_angle;
uniform float u_position;
uniform float u_curve;
uniform float u_softness;
uniform float u_scale;
uniform float u_grain;
uniform float u_grainSize;
uniform float u_seed;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res - 0.5;
  uv.x *= u_res.x / u_res.y;
  float c = cos(u_angle);
  float s = sin(u_angle);
  vec2 p = mat2(c, -s, s, c) * uv / u_scale;

  float breathe = sin(u_time * 0.5236) * 0.07 + sin(u_time * 0.31 + 1.7) * 0.04;
  float x = p.x + u_position * 0.5 + breathe;
  float edge = x + u_curve * (p.y * p.y - 0.12) + sin(p.y * 2.1 + u_time * 0.2) * 0.03;
  float shade = smoothstep(-u_softness, u_softness, edge);

  vec3 col = mix(u_dark, u_mid, smoothstep(0.0, 0.65, shade));
  col = mix(col, u_light, smoothstep(0.6, 1.0, shade));
  float wash = 1.0 - smoothstep(0.0, 1.1, length(p - vec2(-0.55, 0.45)));
  col = mix(col, u_mid, wash * 0.35 * (1.0 - shade));

  vec2 g = floor(gl_FragCoord.xy / (u_grainSize * u_dpr)) + u_seed;
  float n = hash(g) - 0.5;
  col += n * u_grain * 0.3;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

const UNIFORMS = [
  'u_res',
  'u_dpr',
  'u_time',
  'u_light',
  'u_mid',
  'u_dark',
  'u_angle',
  'u_position',
  'u_curve',
  'u_softness',
  'u_scale',
  'u_grain',
  'u_grainSize',
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

export class GrainGradientEngine implements DotCanvasEngine<WebGLRenderingContext> {
  idle = false
  options: GrainGradientOptions
  private width = 0
  private height = 0
  private dpr = 1
  private time = 0
  private program: Program | null = null

  constructor(options: GrainGradientOptions) {
    this.options = options
  }

  setOptions(options: GrainGradientOptions) {
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
    gl.uniform1f(uniforms.u_dpr, this.dpr)
    gl.uniform1f(uniforms.u_time, this.time)
    gl.uniform3fv(uniforms.u_light, hexToRgb(o.colorLight))
    gl.uniform3fv(uniforms.u_mid, hexToRgb(o.colorMid))
    gl.uniform3fv(uniforms.u_dark, hexToRgb(o.colorDark))
    gl.uniform1f(uniforms.u_angle, (o.angle * Math.PI) / 180)
    gl.uniform1f(uniforms.u_position, o.position)
    gl.uniform1f(uniforms.u_curve, o.curve)
    gl.uniform1f(uniforms.u_softness, Math.max(0.005, o.softness))
    gl.uniform1f(uniforms.u_scale, Math.max(0.05, o.scale))
    gl.uniform1f(uniforms.u_grain, o.grain)
    gl.uniform1f(uniforms.u_grainSize, Math.max(0.5, o.grainSize))
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
