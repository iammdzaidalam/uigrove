import type { DotCanvasEngine } from '../lib/dot-canvas'

export type FilmGrainBlend = 'overlay' | 'soft-light' | 'screen' | 'normal'

export interface FilmGrainOptions {
  intensity: number
  size: number
  speed: number
  blend: FilmGrainBlend
  monochrome: boolean
  fps: number
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
uniform float u_rate;
uniform float u_size;
uniform float u_intensity;
uniform float u_mono;
uniform float u_mode;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float grain(vec2 g, float seed) {
  return (hash(g + seed) + hash(g + seed + 31.7)) * 0.5;
}

void main() {
  vec2 g = floor(gl_FragCoord.xy / (u_size * u_dpr));
  float phase = hash(g + 7.0);
  float seed = floor(u_time * u_rate + phase) * 0.61;
  float n = grain(g, seed);
  vec3 col = vec3(n);
  if (u_mono < 0.5) col = vec3(n, grain(g + 53.0, seed), grain(g + 97.0, seed));
  if (u_mode < 0.5) {
    gl_FragColor = vec4(0.5 + (col - 0.5) * u_intensity, 1.0);
  } else if (u_mode < 1.5) {
    gl_FragColor = vec4(col * col * u_intensity, 1.0);
  } else {
    float a = u_intensity * 0.4;
    gl_FragColor = vec4(col * a, a);
  }
}
`

const UNIFORMS = [
  'u_res',
  'u_dpr',
  'u_time',
  'u_rate',
  'u_size',
  'u_intensity',
  'u_mono',
  'u_mode',
] as const

type UniformName = (typeof UNIFORMS)[number]

interface Program {
  gl: WebGLRenderingContext
  program: WebGLProgram
  uniforms: Record<UniformName, WebGLUniformLocation | null>
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

function modeOf(blend: FilmGrainBlend) {
  if (blend === 'screen') return 1
  if (blend === 'normal') return 2
  return 0
}

export class FilmGrainEngine implements DotCanvasEngine<WebGLRenderingContext> {
  idle = false
  options: FilmGrainOptions
  private width = 0
  private height = 0
  private dpr = 1
  private time = 0
  private sinceDraw = 0
  private dirty = true
  private program: Program | null = null

  constructor(options: FilmGrainOptions) {
    this.options = options
  }

  setOptions(options: FilmGrainOptions) {
    this.options = options
    this.dirty = true
    this.idle = false
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width
    this.height = height
    this.dpr = dpr
    this.dirty = true
    this.idle = false
  }

  setPointer() {}

  tick(dt: number) {
    const { speed, fps } = this.options
    if (speed <= 0) {
      this.idle = true
      return
    }
    this.time += dt
    this.sinceDraw += dt
    // Redraw at the fps cap, last frame stays shown
    if (this.sinceDraw >= 1 / Math.max(1, fps)) {
      this.sinceDraw = 0
      this.dirty = true
    }
    this.idle = false
  }

  draw(gl: WebGLRenderingContext) {
    if (!this.dirty) return
    this.dirty = false
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
    gl.uniform1f(uniforms.u_rate, Math.max(1, o.fps) * Math.max(0, o.speed))
    gl.uniform1f(uniforms.u_size, Math.max(0.5, o.size))
    gl.uniform1f(uniforms.u_intensity, Math.min(Math.max(o.intensity, 0), 1))
    gl.uniform1f(uniforms.u_mono, o.monochrome ? 1 : 0)
    gl.uniform1f(uniforms.u_mode, modeOf(o.blend))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  drawStatic(gl: WebGLRenderingContext) {
    this.dirty = true
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
