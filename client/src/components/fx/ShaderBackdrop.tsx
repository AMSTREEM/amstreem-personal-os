import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

type Props = { className?: string; fixed?: boolean; intensity?: number };

const vertex = `#version 300 es
in vec2 position;
out vec2 v_uv;
void main() {
  v_uv = position * .5 + .5;
  gl_Position = vec4(position, 0., 1.);
}`;

const fragment = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_accent;
uniform float u_light;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; }
  return v;
}
void main() {
  vec2 uv = v_uv;
  vec2 p = (uv - .5) * vec2(u_resolution.x / max(1., u_resolution.y), 1.);
  vec2 m = (u_mouse - .5) * .22;
  float t = u_time * .11;
  float warp = fbm(p * 2.2 + vec2(t, -t) + m);
  vec2 q = p + vec2(warp - .5, fbm(p * 2. - vec2(t * .7, t) + m) - .5) * .72;
  float n = fbm(q * 3.1 + vec2(t * .8, -t * .6));
  float filament = smoothstep(.58, .88, fbm(q * 5. + vec2(-t, t * .7)));
  float glow = smoothstep(.74, .12, length(q - vec2(-.22, .08))) * .55
             + smoothstep(.68, .08, length(q - vec2(.35, -.18))) * .34;
  vec3 base = mix(vec3(.012, .018, .03), vec3(.94, .945, .94), u_light);
  vec3 tint = mix(u_accent, vec3(.72, .82, .91), u_light);
  float alpha = (.035 + glow * .11 + filament * (u_light > .5 ? .12 : .14)) * (.55 + n * .45);
  outColor = vec4(mix(base, tint, alpha), 1.);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ShaderBackdrop({ className = '', fixed = false, intensity = 1 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    if (reduced) { setFallback(true); return; }

    let gl: WebGL2RenderingContext | null = null;
    try { gl = node.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' }); }
    catch { gl = null; }
    if (!gl) { setFallback(true); return; }

    const vs = compile(gl, gl.VERTEX_SHADER, vertex);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      setFallback(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) { gl.deleteShader(vs); gl.deleteShader(fs); setFallback(true); return; }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setFallback(true);
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setFallback(true);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const time = gl.getUniformLocation(program, 'u_time');
    const mouse = gl.getUniformLocation(program, 'u_mouse');
    const accent = gl.getUniformLocation(program, 'u_accent');
    const light = gl.getUniformLocation(program, 'u_light');

    let raf = 0;
    let start = performance.now();
    let mx = .5, my = .5, tx = .5, ty = .5;
    let visible = !document.hidden;
    let disposed = false;
    let contextLost = false;

    const readTheme = () => {
      if (contextLost || disposed) return;
      const style = getComputedStyle(document.documentElement);
      const raw = style.getPropertyValue('--accent-primary').trim()
        || style.getPropertyValue('--accent').trim() || '#8b8cf6';
      const parser = document.createElement('canvas').getContext('2d');
      if (parser) {
        parser.fillStyle = raw;
        const normalized = parser.fillStyle;
        const match = normalized.match(/\d+(?:\.\d+)?/g);
        let rgb: number[] | null = null;
        if (/^#[0-9a-f]{6}$/i.test(normalized)) {
          rgb = [parseInt(normalized.slice(1, 3), 16), parseInt(normalized.slice(3, 5), 16), parseInt(normalized.slice(5, 7), 16)];
        } else if (match && match.length >= 3) {
          rgb = match.slice(0, 3).map(Number);
        }
        if (rgb) {
          gl!.useProgram(program);
          gl!.uniform3f(accent, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
        }
      }
      const theme = document.documentElement.getAttribute('data-theme') || '';
      gl!.useProgram(program);
      gl!.uniform1f(light, theme.startsWith('light') ? 1 : 0);
    };

    const resize = () => {
      if (contextLost || disposed) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(node.clientWidth * dpr));
      const height = Math.max(1, Math.floor(node.clientHeight * dpr));
      if (node.width !== width || node.height !== height) {
        node.width = width;
        node.height = height;
        gl!.viewport(0, 0, width, height);
        gl!.useProgram(program);
        gl!.uniform2f(resolution, width, height);
      }
    };

    const pointer = (event: PointerEvent) => {
      tx = event.clientX / Math.max(1, window.innerWidth);
      ty = 1 - event.clientY / Math.max(1, window.innerHeight);
    };

    const draw = (now: number) => {
      if (disposed || contextLost || !visible) return;
      resize();
      mx += (tx - mx) * .08;
      my += (ty - my) * .08;
      gl!.useProgram(program);
      gl!.uniform1f(time, (now - start) / 1000);
      gl!.uniform2f(mouse, mx, my);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(draw);
    };

    const visibility = () => {
      visible = !document.hidden;
      if (visible && !raf && !contextLost) raf = requestAnimationFrame(draw);
      else if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    const lost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      setFallback(true);
    };

    const themeObserver = new MutationObserver(readTheme);
    const resizeObserver = new ResizeObserver(resize);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (node.parentElement) resizeObserver.observe(node.parentElement);
    node.addEventListener('webglcontextlost', lost, false);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', pointer, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    readTheme();
    resize();
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      node.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointer);
      document.removeEventListener('visibilitychange', visibility);
      gl!.deleteBuffer(buffer);
      gl!.deleteProgram(program);
      gl!.deleteShader(vs);
      gl!.deleteShader(fs);
    };
  }, [reduced]);

  return <canvas
    ref={canvas}
    aria-hidden="true"
    className={'atlas-shader-backdrop ' + className + (fallback ? ' is-fallback' : '')}
    style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: intensity }}
  />;
}
