import { STRIDE } from './vortex.engine'
import { sheet } from './sheet'

// Card size in camera units before its scale class
export const CARD = { width: 208, height: 156 }
const RADIUS = 14
const FPS = 5

const VERTEX = `#version 300 es
in vec2 a_corner;
in vec4 a_card;
in vec4 a_meta;
uniform vec2 u_resolution;
uniform vec2 u_card;
out vec2 v_local;
out float v_alpha;
out float v_row;
out float v_phase;
out float v_scale;
void main() {
  vec2 p = a_corner * u_card * a_meta.z;
  vec2 q = vec2(p.x * a_card.z - p.y * a_card.w, p.x * a_card.w + p.y * a_card.z) + a_card.xy;
  vec2 clip = q / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_local = a_corner;
  v_alpha = a_meta.x;
  v_row = a_meta.y;
  v_scale = a_meta.z;
  v_phase = a_meta.w;
}`

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_sheet;
uniform vec2 u_card;
uniform vec2 u_cell;
uniform vec2 u_inner;
uniform float u_frames;
uniform float u_time;
uniform float u_radius;
uniform vec4 u_border;
uniform float u_lift;
in vec2 v_local;
in float v_alpha;
in float v_row;
in float v_phase;
in float v_scale;
out vec4 color;

vec4 frame(float f, vec2 local) {
  vec2 inset = (u_cell - u_inner) * 0.5;
  vec2 texel = vec2(f, v_row) * u_cell + inset + (local + 0.5) * u_inner;
  return texture(u_sheet, texel / (u_cell * vec2(u_frames, ${sheet.rows}.0)));
}

void main() {
  // Ping-pong through the frames so loops never jump
  float span = 2.0 * (u_frames - 1.0);
  float f = mod(u_time * ${FPS}.0 + v_phase * span, span);
  f = f > u_frames - 1.0 ? span - f : f;
  float f0 = floor(f);
  vec4 c = mix(frame(f0, v_local), frame(min(f0 + 1.0, u_frames - 1.0), v_local), f - f0);

  // Lift pure blacks so dark cards read against a dark page
  c.rgb = max(c.rgb, vec3(u_lift) * c.a);
  vec2 size = u_card * v_scale;
  vec2 d = abs(v_local * size) - size * 0.5 + u_radius;
  float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - u_radius;
  float aa = fwidth(dist);
  float inside = 1.0 - smoothstep(-aa, aa, dist);
  float edge = smoothstep(-1.4 - aa, -1.4 + aa, dist);
  c = mix(c, u_border, edge * u_border.a);
  color = c * inside * v_alpha;
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

type Uniform =
  'resolution' | 'card' | 'cell' | 'inner' | 'frames' | 'time' | 'radius' | 'border' | 'lift'
const UNIFORMS: Uniform[] = [
  'resolution',
  'card',
  'cell',
  'inner',
  'frames',
  'time',
  'radius',
  'border',
  'lift',
]

// Plays every card from one sheet of real component loops
export class VortexRenderer {
  private gl: WebGL2RenderingContext | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private instances: WebGLBuffer | null = null
  private texture: WebGLTexture | null = null
  private uniforms: Partial<Record<Uniform, WebGLUniformLocation | null>> = {}
  private image: HTMLImageElement | null = null
  private capacity = 0
  private border: [number, number, number, number] = [0.3, 0.3, 0.32, 0.3]
  private lift = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.init()
  }

  init() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    })
    if (!gl) {
      this.ctx = this.canvas.getContext('2d')
      return
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    gl.bindVertexArray(gl.createVertexArray())
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
      gl.STATIC_DRAW,
    )
    const corner = gl.getAttribLocation(program, 'a_corner')
    gl.enableVertexAttribArray(corner)
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)

    this.instances = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances)
    const card = gl.getAttribLocation(program, 'a_card')
    const meta = gl.getAttribLocation(program, 'a_meta')
    gl.enableVertexAttribArray(card)
    gl.vertexAttribPointer(card, 4, gl.FLOAT, false, STRIDE * 4, 0)
    gl.vertexAttribDivisor(card, 1)
    gl.enableVertexAttribArray(meta)
    gl.vertexAttribPointer(meta, 4, gl.FLOAT, false, STRIDE * 4, 16)
    gl.vertexAttribDivisor(meta, 1)

    for (const name of UNIFORMS) this.uniforms[name] = gl.getUniformLocation(program, `u_${name}`)
    const u = this.uniforms
    gl.uniform2f(u.card ?? null, CARD.width, CARD.height)
    gl.uniform2f(u.cell ?? null, sheet.cell.width, sheet.cell.height)
    gl.uniform2f(u.inner ?? null, sheet.inner.width, sheet.inner.height)
    gl.uniform1f(u.frames ?? null, sheet.frames)
    gl.uniform1f(u.radius ?? null, RADIUS)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.gl = gl
    this.capacity = 0
    if (this.image) this.setSheet(this.image)
  }

  lose() {
    this.gl = null
    this.texture = null
  }

  // Border colour, straight alpha
  setBorder(rgba: [number, number, number, number], lift: number) {
    this.border = rgba
    this.lift = lift
  }

  get ready() {
    return this.image !== null
  }

  setSheet(image: HTMLImageElement) {
    this.image = image
    const gl = this.gl
    if (!gl) return
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  draw(data: Float32Array, count: number, time: number) {
    const { canvas } = this
    const gl = this.gl
    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      if (!this.texture || count === 0) return
      const u = this.uniforms
      const [r, g, b, a] = this.border
      gl.uniform2f(u.resolution ?? null, canvas.width, canvas.height)
      gl.uniform1f(u.time ?? null, time)
      gl.uniform1f(u.lift ?? null, this.lift)
      gl.uniform4f(u.border ?? null, r * a, g * a, b * a, a)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instances)
      if (data.byteLength > this.capacity) {
        gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW)
        this.capacity = data.byteLength
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * STRIDE)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)
      return
    }
    const ctx = this.ctx
    const image = this.image
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!image) return
    const frame = Math.floor(time * FPS) % sheet.frames
    const pad = {
      x: (sheet.cell.width - sheet.inner.width) / 2,
      y: (sheet.cell.height - sheet.inner.height) / 2,
    }
    for (let n = 0; n < count; n++) {
      const o = n * STRIDE
      const w = CARD.width * data[o + 6]!
      const h = CARD.height * data[o + 6]!
      const sx = frame * sheet.cell.width + pad.x
      const sy = data[o + 5]! * sheet.cell.height + pad.y
      ctx.setTransform(
        data[o + 2]!,
        data[o + 3]!,
        -data[o + 3]!,
        data[o + 2]!,
        data[o]!,
        data[o + 1]!,
      )
      ctx.globalAlpha = data[o + 4]!
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(-w / 2, -h / 2, w, h, RADIUS)
      ctx.clip()
      ctx.drawImage(image, sx, sy, sheet.inner.width, sheet.inner.height, -w / 2, -h / 2, w, h)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
}
