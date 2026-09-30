import type { DotCanvasEngine } from '../lib/dot-canvas'

export type TextTunnelDirection = 'down' | 'up'
export type TextTunnelFontStyle = 'normal' | 'italic'

export interface TextTunnelOptions {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: TextTunnelFontStyle
  letterSpacing: number
  lineHeight: number
  gap: number
  columns: number
  textColor: string
  background: string
  speed: number
  direction: TextTunnelDirection
  radius: number
  depth: number
  flare: number
  bloom: number
  chromatic: number
  fade: number
  twist: number
  cursorInfluence: number
}

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAGMENT = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_shift;
uniform float u_phase;
uniform float u_rows;
uniform float u_power;
uniform float u_flare;
uniform float u_depth;
uniform float u_spread;
uniform float u_bloom;
uniform float u_fade;
uniform float u_twist;
uniform vec3 u_weights[8];
uniform vec3 u_ink;
uniform vec3 u_paper;

void main() {
  vec2 p = gl_FragCoord.xy / u_res - 0.5 - u_shift;
  float wall = min(pow(abs(p.y) * 2.0, u_power), 1.0);
  float lane = p.y / (1.0 + wall * u_depth);
  float x = p.x / (1.0 + wall * u_flare) + 0.5 + u_twist * wall * sign(p.y);
  float y = lane * u_rows + u_phase;
  float reach = u_spread * wall * u_rows;

  vec3 ink = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float offset = (float(i) / 7.0 - 0.5) * 2.0 * reach;
    ink += texture2D(u_tex, vec2(x, fract(y + offset))).r * u_weights[i];
  }

  if (u_bloom > 0.0) {
    float halo = texture2D(u_tex, vec2(x, fract(y))).g;
    float lift = u_bloom * (1.0 - 0.6 * wall);
    float lum = dot(ink, vec3(0.299, 0.587, 0.114));
    ink += ink * pow(max(lum, 0.0), 1.1) * lift * 22.0 + halo * lift * 12.0;
  }

  ink = clamp(ink, 0.0, 1.0) * (1.0 - u_fade * wall);
  gl_FragColor = vec4(mix(u_paper, u_ink, ink), 1.0);
}
`

const UNIFORMS = [
  'u_tex',
  'u_res',
  'u_shift',
  'u_phase',
  'u_rows',
  'u_power',
  'u_flare',
  'u_depth',
  'u_spread',
  'u_bloom',
  'u_fade',
  'u_twist',
  'u_weights',
  'u_ink',
  'u_paper',
] as const

type UniformName = (typeof UNIFORMS)[number]

interface Program {
  gl: WebGLRenderingContext
  program: WebGLProgram
  texture: WebGLTexture
  maxTexture: number
  uniforms: Record<UniformName, WebGLUniformLocation | null>
}

const TAPS = 8
const GLOW_LAYERS: ReadonlyArray<readonly [number, number]> = [
  [3, 0.18],
  [8, 0.42],
  [20, 0.4],
]
const GLOW_PAD = 60

function smooth(x: number) {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

// Spectral tap weights share one normalizer so white reads slightly green.
const WEIGHTS = (() => {
  const raw: number[] = []
  let total = 0
  for (let i = 0; i < TAPS; i++) {
    const t = i / (TAPS - 1)
    const r = smooth(1 - 2 * t)
    const g = 1 - Math.abs(2 * t - 1)
    const b = smooth(2 * t - 1)
    raw.push(r, g, b)
    total += r + g + b
  }
  return new Float32Array(raw.map((w) => w / (total / 3)))
})()

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

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function supportsFilter() {
  return 'filter' in CanvasRenderingContext2D.prototype
}

function drawBlurred(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  radius: number,
  alpha: number,
  y: number,
) {
  ctx.globalAlpha = alpha
  if (supportsFilter()) {
    ctx.filter = `blur(${radius}px)`
    ctx.drawImage(source, 0, y)
    ctx.filter = 'none'
    return
  }
  // Downscale then upscale stands in for a gaussian blur.
  const factor = Math.max(1, radius * 1.6)
  const small = makeCanvas(
    Math.max(1, Math.round(source.width / factor)),
    Math.max(1, Math.round(source.height / factor)),
  )
  const sctx = small.getContext('2d')
  if (!sctx) return
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(source, 0, 0, small.width, small.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, y, source.width, source.height)
}

export class TextTunnelEngine implements DotCanvasEngine<WebGLRenderingContext> {
  idle = false
  options: TextTunnelOptions
  private width = 0
  private height = 0
  private dpr = 1
  private phase = 0
  private shiftX = 0
  private shiftY = 0
  private targetX = 0
  private targetY = 0
  private block = 1
  private textureKey = ''
  private program: Program | null = null

  constructor(options: TextTunnelOptions) {
    this.options = options
  }

  setOptions(options: TextTunnelOptions) {
    this.options = options
    if (options.cursorInfluence <= 0) this.targetX = this.targetY = 0
    this.idle = false
  }

  refreshText() {
    this.textureKey = ''
    this.idle = false
  }

  resetContext() {
    this.program = null
    this.textureKey = ''
    this.idle = false
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width
    this.height = height
    this.dpr = dpr
    this.idle = false
  }

  setPointer(x: number, y: number, active: boolean) {
    const influence = this.options.cursorInfluence
    if (!active || influence <= 0 || !this.width || !this.height) {
      this.targetX = this.targetY = 0
    } else {
      this.targetX = (x / this.width - 0.5) * influence * 0.5
      this.targetY = (0.5 - y / this.height) * influence * 0.35
    }
    this.idle = false
  }

  tick(dt: number) {
    const o = this.options
    const sign = o.direction === 'up' ? -1 : 1
    this.phase = (this.phase + dt * o.speed * sign + 1) % 1
    const ease = 1 - Math.exp(-dt * 5)
    this.shiftX += (this.targetX - this.shiftX) * ease
    this.shiftY += (this.targetY - this.shiftY) * ease
    const settled =
      Math.abs(this.targetX - this.shiftX) < 1e-4 && Math.abs(this.targetY - this.shiftY) < 1e-4
    if (settled) {
      this.shiftX = this.targetX
      this.shiftY = this.targetY
    }
    this.idle = o.speed === 0 && settled
  }

  draw(gl: WebGLRenderingContext) {
    if (!this.width || !this.height || gl.isContextLost()) return
    const program = this.ensureProgram(gl)
    if (!program) return
    this.ensureTexture(program)
    const { uniforms } = program
    const o = this.options
    const w = Math.round(this.width * this.dpr)
    const h = Math.round(this.height * this.dpr)
    const bloom = Math.max(0, o.bloom)
    gl.viewport(0, 0, w, h)
    gl.useProgram(program.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, program.texture)
    gl.uniform1i(uniforms.u_tex, 0)
    gl.uniform2f(uniforms.u_res, w, h)
    gl.uniform2f(uniforms.u_shift, this.shiftX, this.shiftY)
    gl.uniform1f(uniforms.u_phase, this.phase + 0.5)
    gl.uniform1f(uniforms.u_rows, this.height / this.block)
    gl.uniform1f(uniforms.u_power, 1.2 + 10.8 * Math.min(1, Math.max(0, o.radius)))
    gl.uniform1f(uniforms.u_flare, Math.max(0, o.flare) * 10)
    gl.uniform1f(uniforms.u_depth, Math.max(0, o.depth) * 15)
    gl.uniform1f(uniforms.u_spread, Math.max(0, o.chromatic) * 0.05)
    gl.uniform1f(uniforms.u_bloom, bloom * bloom * 0.25)
    gl.uniform1f(uniforms.u_fade, Math.min(1, Math.max(0, o.fade)))
    gl.uniform1f(uniforms.u_twist, o.twist * 0.5)
    gl.uniform3fv(uniforms.u_weights, WEIGHTS)
    gl.uniform3fv(uniforms.u_ink, hexToRgb(o.textColor))
    gl.uniform3fv(uniforms.u_paper, hexToRgb(o.background))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  drawStatic(gl: WebGLRenderingContext) {
    this.shiftX = this.targetX = 0
    this.shiftY = this.targetY = 0
    this.draw(gl)
  }

  private ensureTexture(program: Program) {
    const o = this.options
    const lines = o.text.split('\n')
    const lineHeight = Math.max(1, o.fontSize * o.lineHeight)
    const block = Math.max(1, lineHeight * lines.length + Math.max(0, o.gap))
    const scale = Math.min(this.dpr, program.maxTexture / this.width, program.maxTexture / block)
    const key = [
      o.text,
      o.fontFamily,
      o.fontSize,
      o.fontWeight,
      o.fontStyle,
      o.letterSpacing,
      o.lineHeight,
      o.gap,
      o.columns,
      this.width,
      scale,
    ].join('|')
    if (key === this.textureKey) return
    this.textureKey = key
    this.block = block

    const width = Math.max(1, Math.round(this.width * scale))
    const height = Math.max(1, Math.round(block * scale))
    const pad = Math.ceil(GLOW_PAD * scale)
    const columns = Math.max(1, Math.round(o.columns))
    const font = `${o.fontStyle} ${o.fontWeight} ${o.fontSize * scale}px ${o.fontFamily}`
    const top = (height - lineHeight * scale * lines.length) / 2

    const paint = (ctx: CanvasRenderingContext2D, color: string, offset: number, span: number) => {
      ctx.font = font
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${o.letterSpacing * scale}px`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = color
      const reach = Math.ceil(span / height) + 1
      for (let tile = -reach; tile <= reach; tile++) {
        lines.forEach((line, i) => {
          const y = offset + tile * height + top + lineHeight * scale * (i + 0.5)
          for (let c = 0; c < columns; c++) ctx.fillText(line, (width * (c + 0.5)) / columns, y)
        })
      }
    }

    const canvas = makeCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'lighter'
    paint(ctx, '#f00', 0, 0)

    const glow = makeCanvas(width, height + pad * 2)
    const gctx = glow.getContext('2d')
    if (gctx) {
      paint(gctx, '#0f0', pad, pad)
      for (const [radius, alpha] of GLOW_LAYERS) drawBlurred(ctx, glow, radius * scale, alpha, -pad)
    }

    const { gl, texture } = program
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  }

  private ensureProgram(gl: WebGLRenderingContext): Program | null {
    if (this.program && this.program.gl === gl) return this.program
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    const texture = gl.createTexture()
    if (!vertex || !fragment || !program || !texture) return null
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

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const uniforms = {} as Record<UniformName, WebGLUniformLocation | null>
    for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name)
    const maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096
    this.textureKey = ''
    this.program = { gl, program, texture, maxTexture, uniforms }
    return this.program
  }
}
