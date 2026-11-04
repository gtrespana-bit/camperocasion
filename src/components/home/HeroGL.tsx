'use client'

import { useEffect, useRef } from 'react'

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uImg;
uniform vec2 uFocus;
uniform vec2 uMouse;
uniform vec2 uVel;
uniform float uTime;
uniform float uScroll;
uniform float uIntro;

vec2 cover(vec2 uv) {
  float s = max(uRes.x / uImg.x, uRes.y / uImg.y);
  vec2 vis = uRes / (uImg * s);
  return (1.0 - vis) * uFocus + uv * vis;
}

void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);

  // Respiración: ondulación casi imperceptible
  uv += 0.0028 * vec2(sin(uv.y * 8.0 + uTime * 0.55), cos(uv.x * 7.0 + uTime * 0.45));

  // Lente líquida alrededor del puntero, arrastrada por su velocidad
  vec2 d = (uv - uMouse) * asp;
  float r = length(d);
  float infl = exp(-r * r * 11.0);
  float sp = length(uVel);
  uv -= uVel * infl * 0.34;
  uv += normalize(d + 1e-4) / asp * infl * (0.012 + sp * 0.09);

  // Entrada y scroll: zoom suave hacia dentro
  float z = 1.0 + (1.0 - uIntro) * 0.22 + uScroll * 0.16;
  uv = (uv - vec2(0.5, 0.42)) / z + vec2(0.5, 0.42);
  uv.y += uScroll * 0.04;

  vec2 cuv = cover(uv);
  float ca = 0.0016 + sp * infl * 0.026;
  vec2 dir = normalize(uVel + vec2(1e-4, 0.0));
  float rC = texture2D(uTex, cuv + dir * ca).r;
  float gC = texture2D(uTex, cuv).g;
  float bC = texture2D(uTex, cuv - dir * ca).b;
  vec3 col = vec3(rC, gC, bC);

  // Revelado oscuro de entrada y pérdida de brillo al hacer scroll
  col *= mix(0.25, 1.0, uIntro) * (1.0 - uScroll * 0.55);
  gl_FragColor = vec4(col, 1.0);
}`

/**
 * Fotografía del hero renderizada con WebGL: lente líquida que sigue al
 * puntero, aberración cromática por velocidad y zoom ligado al scroll. Si no
 * hay WebGL (o se pide menos movimiento) queda la <img> estática de debajo.
 */
export default function HeroGL({ src, focus = [0.9, 0.5] }: { src: string; focus?: [number, number] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // En móvil o con movimiento reducido queda la fotografía HTML: evita
    // descargarla otra vez como textura y mantener un canvas activo por estética.
    if (window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
    if (!gl) return

    const compile = (type: number, source: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, source)
      gl.compileShader(sh)
      return sh
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const U = (n: string) => gl.getUniformLocation(prog, n)
    const uRes = U('uRes'), uImg = U('uImg'), uFocus = U('uFocus'), uMouse = U('uMouse')
    const uVel = U('uVel'), uTime = U('uTime'), uScroll = U('uScroll'), uIntro = U('uIntro'), uTex = U('uTex')

    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.uniform1i(uTex, 0)
    gl.uniform2f(uFocus, focus[0], focus[1])

    let ready = false
    let startedAt = 0
    let imgW = 1, imgH = 1
    let raf = 0
    let visible = true
    let disposed = false

    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (disposed) return
      imgW = img.naturalWidth
      imgH = img.naturalHeight
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.uniform2f(uImg, imgW, imgH)
      ready = true
      startedAt = performance.now()
    }
    img.src = src

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Puntero: posición suavizada + velocidad que se disipa
    let tx = 0.7, ty = 0.5, mx = 0.7, my = 0.5, vx = 0, vy = 0
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      tx = (e.clientX - r.left) / r.width
      ty = (e.clientY - r.top) / r.height
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting }, { threshold: 0 })
    io.observe(canvas)

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!ready || !visible || document.hidden) return
      const px = mx, py = my
      mx += (tx - mx) * 0.085
      my += (ty - my) * 0.085
      vx = vx * 0.9 + (mx - px) * 1.6
      vy = vy * 0.9 + (my - py) * 1.6
      const sc = Math.min(1, Math.max(0, window.scrollY / (canvas.clientHeight || 1)))
      const t = (now - startedAt) / 1000
      const intro = Math.min(1, Math.max(0, (t - 0.1) / 2.4))
      const eased = 1 - Math.pow(1 - intro, 4)
      gl.uniform2f(uMouse, mx, my)
      gl.uniform2f(uVel, vx * 4, vy * 4)
      gl.uniform1f(uTime, now / 1000)
      gl.uniform1f(uScroll, sc)
      gl.uniform1f(uIntro, eased)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (canvas.dataset.live !== '1') canvas.dataset.live = '1'
    }
    raf = requestAnimationFrame(frame)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      gl.deleteTexture(tex)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [src, focus])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700 data-[live='1']:opacity-100"
    />
  )
}
