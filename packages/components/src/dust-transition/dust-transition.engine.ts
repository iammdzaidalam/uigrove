import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface DustTransitionEngineOptions {
  dolly: number
  focusX: number
  focusY: number
  dust: number
  flare: number
  sparks: number
  smoothing: number
  instant: boolean
}

export interface DustTransitionBeats {
  heroScale: number
  nextScale: number
  front: number
  frontOn: number
  flare: number
  flareRadius: number
}

export interface DustTransitionFrame {
  progress: number
  heroScale: number
  nextScale: number
  clip: string
}

const SETTLE = 0.001
const NEXT_ZOOM = 1.16
const NOISE_SCALE = 5.5
const NOISE_DRIFT = 0.35
const NOISE_AMP = 0.16
const BAND = 0.09
const RAYS = 256
const CELL = 3
const MARCH = 0.006
const RING_OFFSET = 1
const RING_RANGE = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function smoothstep(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// Beats of the reference timeline, progress 0 to 1
export function dustTransitionBeats(progress: number, dolly: number): DustTransitionBeats {
  const p = clamp(progress, 0, 1)
  return {
    heroScale: 1 + (dolly - 1) * smoothstep(0, 0.72, p),
    nextScale: NEXT_ZOOM - (NEXT_ZOOM - 1) * smoothstep(0.25, 1, p),
    front: smoothstep(0.22, 0.85, p),
    frontOn: smoothstep(0.2, 0.32, p) * (1 - smoothstep(0.8, 0.95, p)),
    flare: Math.sin(clamp((p - 0.03) / 0.55, 0, 1) * Math.PI),
    flareRadius: 0.015 + 0.145 * smoothstep(0.05, 0.5, p),
  }
}

function noiseTable(seed: number) {
  const table = new Uint8Array(65536)
  let s = seed >>> 0
  for (let i = 0; i < table.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    table[i] = (t ^ (t >>> 14)) >>> 24
  }
  return table
}

function vnoise(table: Uint8Array, x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const x0 = ix & 255
  const x1 = (ix + 1) & 255
  const y0 = (iy & 255) << 8
  const y1 = ((iy + 1) & 255) << 8
  const a = table[y0 | x0] ?? 0
  const b = table[y0 | x1] ?? 0
  const c = table[y1 | x0] ?? 0
  const d = table[y1 | x1] ?? 0
  return (a + (b - a) * ux + (c - a + (a - b + d - c) * ux) * uy) / 255
}

function fbm(table: Uint8Array, x: number, y: number) {
  return (
    vnoise(table, x, y) * 0.5 +
    vnoise(table, x * 2.03 + 1.7, y * 2.03 + 1.7) * 0.3 +
    vnoise(table, x * 4.11 - 3.1, y * 4.11 - 3.1) * 0.2
  )
}

function cellHash(a: number, b: number, c: number) {
  let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * .5 + .5, .5 - a_pos.y * .5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

// Additive light only, the scenes are DOM layers
const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform float u_p;
uniform float u_t;
uniform vec2 u_res;
uniform vec2 u_origin;
uniform float u_edge;
uniform float u_flare;
uniform float u_sparks;
uniform sampler2D u_ring;

float hash21(vec2 q) {
  q = fract(q * vec2(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}

float decode(vec4 s) {
  return (s.r * 65280. + s.g * 255.) / 65535. * ${RING_RANGE}. - ${RING_OFFSET}.;
}

float ringAt(float a) {
  float x = a * ${RAYS}.;
  float i = floor(x);
  float r0 = decode(texture2D(u_ring, vec2((i + .5) / ${RAYS}., .5)));
  float r1 = decode(texture2D(u_ring, vec2((i + 1.5) / ${RAYS}., .5)));
  return mix(r0, r1, x - i);
}

void main() {
  vec2 asp = vec2(u_res.x / u_res.y, 1.);
  vec2 rel = (v_uv - u_origin) * asp;
  float d = length(rel);
  float a = atan(rel.y, rel.x) / 6.2831853 + .5;
  float sd = d - ringAt(a) + u_edge;
  float frontOn = smoothstep(.2, .32, u_p) * (1. - smoothstep(.8, .95, u_p));
  vec2 px = gl_FragCoord.xy;
  vec3 light = vec3(1., .95, .85);
  float edge = exp(-sd * sd / (2. * .04 * .04));
  vec3 color = light * edge * frontOn * .7 * u_flare;
  float spark = step(.975, hash21(floor(px / 3.) + floor(u_t * 14.))) * smoothstep(.1, 0., abs(sd)) * frontOn;
  color += light * spark * 1.4 * u_sparks;
  float fr = mix(.015, .16, smoothstep(.05, .5, u_p));
  float amp = sin(clamp((u_p - .03) / .55, 0., 1.) * 3.14159) * u_flare;
  float fl = exp(-d * d / (2. * fr * fr));
  color += light * fl * amp * 1.35;
  color = clamp(color, 0., 1.);
  gl_FragColor = vec4(color, max(color.r, max(color.g, color.b)));
}
`

const UNIFORMS = [
  'u_p',
  'u_t',
  'u_res',
  'u_origin',
  'u_edge',
  'u_flare',
  'u_sparks',
  'u_ring',
] as const

type UniformName = (typeof UNIFORMS)[number]

interface Program {
  gl: WebGLRenderingContext
  program: WebGLProgram
  texture: WebGLTexture
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

const REST: DustTransitionFrame = {
  progress: 0,
  heroScale: 1,
  nextScale: NEXT_ZOOM,
  clip: 'inset(100%)',
}

export class DustTransitionEngine implements DotCanvasEngine<WebGLRenderingContext> {
  idle = true
  target = 0
  current = 0
  time = 0
  frame: DustTransitionFrame = REST
  options: DustTransitionEngineOptions
  onFrame: ((frame: DustTransitionFrame) => void) | null = null
  private width = 0
  private height = 0
  private dpr = 1
  private far = 1
  private edge = 0
  private noise = noiseTable(7)
  private ring = new Float32Array(RAYS)
  private ringBytes = new Uint8Array(RAYS * 4)
  private ringDirty = true
  private stamp = new Uint32Array(0)
  private stampCols = 0
  private stampId = 0
  private program: Program | null = null

  constructor(options: DustTransitionEngineOptions) {
    this.options = { ...options }
  }

  setOptions(next: Partial<DustTransitionEngineOptions>) {
    this.options = { ...this.options, ...next }
    this.idle = false
  }

  setTarget(t: number, jump = false) {
    this.target = clamp(t, 0, 1)
    if (jump || this.options.instant) this.current = this.target
    this.idle = false
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width
    this.height = height
    this.dpr = dpr
    const cols = Math.ceil(width / CELL) + 1
    const rows = Math.ceil(height / CELL) + 1
    if (cols !== this.stampCols || this.stamp.length !== cols * rows) {
      this.stamp = new Uint32Array(cols * rows)
      this.stampCols = cols
      this.stampId = 0
    }
    this.idle = false
  }

  setPointer() {}

  tick(dt: number) {
    const diff = this.target - this.current
    if (Math.abs(diff) < SETTLE || this.options.instant) this.current = this.target
    else {
      // Frame-rate independent lerp, same feel as smoothing at 60fps
      const rate = 1 - Math.pow(1 - clamp(this.options.smoothing, 0.01, 1), dt * 60)
      this.current += diff * rate
    }
    const active = this.current > 0 && this.current < 1
    if (active && !this.options.instant) this.time += dt
    this.update()
    this.idle = this.current === this.target && !active
  }

  draw(gl: WebGLRenderingContext) {
    const w = Math.round(this.width * this.dpr)
    const h = Math.round(this.height * this.dpr)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const p = this.current
    if (p <= 0 || p >= 1) return
    const program = this.ensureProgram(gl)
    if (!program) return
    const { uniforms } = program
    const o = this.options
    gl.useProgram(program.program)
    if (this.ringDirty) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, program.texture)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        RAYS,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.ringBytes,
      )
      this.ringDirty = false
    }
    gl.uniform1f(uniforms.u_p, p)
    gl.uniform1f(uniforms.u_t, this.time)
    gl.uniform2f(uniforms.u_res, w, h)
    gl.uniform2f(uniforms.u_origin, o.focusX, o.focusY)
    gl.uniform1f(uniforms.u_edge, this.edge)
    gl.uniform1f(uniforms.u_flare, o.flare)
    gl.uniform1f(uniforms.u_sparks, o.instant ? 0 : o.sparks)
    gl.uniform1i(uniforms.u_ring, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  drawStatic(gl: WebGLRenderingContext) {
    this.update()
    this.draw(gl)
  }

  private update() {
    const p = this.current
    const o = this.options
    const beats = dustTransitionBeats(p, o.dolly)
    const frame: DustTransitionFrame = {
      progress: p,
      heroScale: beats.heroScale,
      nextScale: beats.nextScale,
      clip: this.width > 0 ? this.solveClip(beats.front) : REST.clip,
    }
    const same =
      frame.heroScale === this.frame.heroScale &&
      frame.nextScale === this.frame.nextScale &&
      frame.clip === this.frame.clip
    this.frame = frame
    if (!same) this.onFrame?.(frame)
  }

  // Noisy boundary solved along rays, first crossing wins
  private solveClip(front: number) {
    const o = this.options
    const W = this.width
    const H = this.height
    const asp = W / H
    const ox = o.focusX
    const oy = o.focusY
    const cx = Math.max(ox, 1 - ox) * asp
    const cy = Math.max(oy, 1 - oy)
    this.far = Math.hypot(cx, cy)
    const band = BAND * o.dust
    const amp = NOISE_AMP * o.dust
    const edge = band * 0.5
    this.edge = edge
    const level = front * (this.far + 0.45) - 0.25 + edge
    const half = amp * 0.5 + 0.01

    if (level + half <= 0) {
      this.fillRing(-1)
      return 'inset(100%)'
    }
    if (level - half > this.far + 0.05) {
      this.fillRing(this.far + 1)
      return 'none'
    }

    const noise = this.noise
    const tx = this.time * NOISE_DRIFT
    const ring = this.ring
    const opx = ox * W
    const opy = oy * H
    let parts = ''
    for (let k = 0; k < RAYS; k++) {
      const theta = (k / RAYS - 0.5) * Math.PI * 2
      const dx = Math.cos(theta)
      const dy = Math.sin(theta)
      let r = level
      if (amp > 0) {
        const lo = Math.max(0, level - half)
        const hi = level + half
        const sd = (d: number) =>
          d + amp * (fbm(noise, d * dx * NOISE_SCALE + tx, d * dy * NOISE_SCALE + tx) - 0.5) - level
        if (sd(lo) > 0) r = lo
        else {
          let a = lo
          let b = hi
          for (let d = lo + MARCH; d < hi; d += MARCH) {
            if (sd(d) > 0) {
              b = d
              break
            }
            a = d
          }
          for (let i = 0; i < 4; i++) {
            const m = (a + b) * 0.5
            if (sd(m) > 0) b = m
            else a = m
          }
          r = (a + b) * 0.5
        }
      }
      ring[k] = r
      const px = opx + r * H * dx
      const py = opy + r * H * dy
      parts += `${k ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`
    }
    this.encodeRing()
    if (band > 0) parts += this.dustCells(band, edge)
    return `path("${parts}Z")`
  }

  // Dithered next-scene squares along the outer band
  private dustCells(band: number, edge: number) {
    const o = this.options
    const W = this.width
    const H = this.height
    const opx = o.focusX * W
    const opy = o.focusY * H
    const ring = this.ring
    const stamp = this.stamp
    const cols = this.stampCols
    const id = ++this.stampId
    const fineT = Math.floor(this.time * 9)
    const coarseT = Math.floor(this.time * 6) + 7919
    const outer = band * 1.5
    const stepR = (CELL * 0.9) / H
    const arc = CELL * 0.9
    let parts = ''
    for (let k = 0; k < RAYS; k++) {
      const r0 = ring[k] ?? 0
      const r1 = ring[(k + 1) % RAYS] ?? 0
      const rim = Math.max(r0, r1) + outer
      if (rim <= 0) continue
      const subs = Math.max(1, Math.ceil((Math.PI * 2 * rim * H) / RAYS / arc))
      for (let s = 0; s < subs; s++) {
        const f = s / subs
        const theta = ((k + f) / RAYS - 0.5) * Math.PI * 2
        const dx = Math.cos(theta)
        const dy = Math.sin(theta)
        const r = r0 + (r1 - r0) * f
        for (let sd = edge; sd < outer; sd += stepR) {
          const d = r + sd - edge
          if (d < 0) continue
          const px = opx + d * H * dx
          const py = opy + d * H * dy
          if (px < 0 || py < 0 || px >= W || py >= H) break
          const gi = (px / CELL) | 0
          const gj = (py / CELL) | 0
          const slot = gj * cols + gi
          if (stamp[slot] === id) continue
          stamp[slot] = id
          const cover = 1 - smoothstep(-band * 0.5, band * 1.5, sd)
          const thr = cellHash(gi, gj, fineT) * 0.65 + cellHash(gi >> 1, gj >> 1, coarseT) * 0.35
          if (thr < cover) {
            parts += `M${gi * CELL} ${gj * CELL}h${CELL}v${CELL}h-${CELL}z`
          }
        }
      }
    }
    return parts
  }

  private fillRing(value: number) {
    this.ring.fill(value)
    this.encodeRing()
  }

  private encodeRing() {
    const bytes = this.ringBytes
    for (let k = 0; k < RAYS; k++) {
      const v = clamp(((this.ring[k] ?? 0) + RING_OFFSET) / RING_RANGE, 0, 1)
      const u = Math.round(v * 65535)
      bytes[k * 4] = u >> 8
      bytes[k * 4 + 1] = u & 255
      bytes[k * 4 + 2] = 0
      bytes[k * 4 + 3] = 255
    }
    this.ringDirty = true
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

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.ringDirty = true

    const uniforms = {} as Record<UniformName, WebGLUniformLocation | null>
    for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name)
    this.program = { gl, program, texture, uniforms }
    return this.program
  }
}
