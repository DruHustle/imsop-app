import { useEffect, useRef, useState } from "react";
import land from "@/assets/world-land.json";
import { MapAsset } from "@/lib/map-types";
import { globePoint, projectPoint } from "@/lib/globe";
import { statusColor } from "@/lib/overview";
import { Button } from "./ui/button";
export default function Globe({
  assets,
  selectedId,
  onSelect,
  onUnavailable,
}: {
  assets: MapAsset[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onUnavailable: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    view = useRef({ yaw: 0, pitch: 0.16, distance: 3.2 });
  const draw = useRef<() => void>(() => {}),
    [orientation, setOrientation] = useState(
      "Drag to orbit · Scroll or use controls to zoom"
    );
  const latest = useRef({ assets, selectedId, onSelect });
  const [orbiting, setOrbiting] = useState(false),
    [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setOrbiting(false);
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!orbiting || reducedMotion) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      if (!document.hidden) {
        view.current.yaw =
          (view.current.yaw + Math.min(now - previous, 50) * 0.00015) %
          (2 * Math.PI);
        draw.current();
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [orbiting, reducedMotion]);
  latest.current = { assets, selectedId, onSelect };
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const gl = element.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) {
      onUnavailable();
      return;
    }
    const shader = (kind: number, source: string) => {
      const s = gl.createShader(kind)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error("3D shader unavailable");
      return s;
    };
    let program: WebGLProgram;
    const buffers: WebGLBuffer[] = [];
    try {
      program = gl.createProgram()!;
      gl.attachShader(
        program,
        shader(
          gl.VERTEX_SHADER,
          `attribute vec3 p;uniform float yaw,pitch,distance,aspect,pointSize;varying float shade;void main(){float c=cos(yaw),s=sin(yaw);vec3 v=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);v=vec3(v.x,v.y*cos(pitch)-v.z*sin(pitch),v.y*sin(pitch)+v.z*cos(pitch));float d=distance-v.z;gl_Position=vec4(v.x*2.41421356/aspect,v.y*2.41421356,1.020202*d-0.2020202,d);gl_PointSize=pointSize;shade=0.55+0.45*max(0.0,dot(normalize(v),normalize(vec3(-0.4,0.7,1.0))));}`
        )
      );
      gl.attachShader(
        program,
        shader(
          gl.FRAGMENT_SHADER,
          `precision mediump float;uniform vec3 color;uniform float roundPoint,lighting;varying float shade;void main(){if(roundPoint>0.5&&length(gl_PointCoord-vec2(0.5))>0.5)discard;gl_FragColor=vec4(color*mix(1.0,shade,lighting),1.0);}`
        )
      );
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error();
    } catch {
      onUnavailable();
      return;
    }
    gl.useProgram(program);
    const attribute = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(attribute);
    const uniform = (name: string, value: number) =>
      gl.uniform1f(gl.getUniformLocation(program, name), value);
    const colors = new Map<string, number[]>();
    const color = (value: string) => {
      const cached = colors.get(value);
      if (cached) {
        gl.uniform3fv(gl.getUniformLocation(program, "color"), cached);
        return;
      }
      const span = document.createElement("span");
      span.style.color = value;
      span.style.display = "none";
      document.body.append(span);
      const values = getComputedStyle(span)
        .color.match(/[\d.]+/g)
        ?.map(Number) ?? [100, 130, 150];
      span.remove();
      colors.set(
        value,
        values.slice(0, 3).map(v => v / 255)
      );
      gl.uniform3fv(
        gl.getUniformLocation(program, "color"),
        values.slice(0, 3).map(v => v / 255)
      );
    };
    const geometry = (values: number[]) => {
      const buffer = gl.createBuffer()!;
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      return { buffer, count: values.length / 3 };
    };
    const sphere: number[] = [],
      grid: number[] = [],
      coast: number[] = [];
    for (let lat = -90; lat < 90; lat += 6)
      for (let lon = -180; lon < 180; lon += 6) {
        const p = [
          globePoint(lat, lon),
          globePoint(lat + 6, lon),
          globePoint(lat, lon + 6),
          globePoint(lat + 6, lon + 6),
        ];
        for (const n of [0, 1, 2, 2, 1, 3]) sphere.push(...p[n]);
      }
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = -180; lon < 180; lon += 3)
        for (const p of [globePoint(lat, lon), globePoint(lat, lon + 3)])
          grid.push(...p.map(v => v * 1.002));
    for (let lon = -180; lon < 180; lon += 30)
      for (let lat = -90; lat < 90; lat += 3)
        for (const p of [globePoint(lat, lon), globePoint(lat + 3, lon)])
          grid.push(...p.map(v => v * 1.002));
    for (const ring of land)
      for (let i = 1; i < ring.length; i++)
        for (const [lng, lat] of [ring[i - 1], ring[i]])
          coast.push(...globePoint(lat, lng).map(v => v * 1.006));
    const surface = geometry(sphere),
      lines = geometry(grid),
      continents = geometry(coast),
      points = gl.createBuffer()!;
    buffers.push(points);
    const renderGeometry = (
      value: ReturnType<typeof geometry>,
      mode: number
    ) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, value.buffer);
      gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(mode, 0, value.count);
    };
    draw.current = () => {
      if (gl.isContextLost()) return;
      const box = element.getBoundingClientRect(),
        ratio = Math.min(devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(box.width * ratio)),
        height = Math.max(1, Math.round(box.height * ratio));
      if (element.width !== width) element.width = width;
      if (element.height !== height) element.height = height;
      gl.viewport(0, 0, element.width, element.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      const v = view.current;
      uniform("yaw", v.yaw);
      uniform("pitch", v.pitch);
      uniform("distance", v.distance);
      uniform("aspect", box.width / box.height);
      uniform("roundPoint", 0);
      uniform("lighting", 1);
      uniform("pointSize", 8 * ratio);
      color("var(--muted)");
      renderGeometry(surface, gl.TRIANGLES);
      uniform("lighting", 0);
      color("var(--border)");
      renderGeometry(lines, gl.LINES);
      color("var(--muted-foreground)");
      renderGeometry(continents, gl.LINES);
      gl.bindBuffer(gl.ARRAY_BUFFER, points);
      gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);
      uniform("roundPoint", 1);
      const groups = new Map<string, MapAsset[]>();
      for (const asset of latest.current.assets) {
        const key = asset.status ?? "Unknown";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(asset);
      }
      for (const [status, records] of Array.from(groups.entries())) {
        color(statusColor(status));
        uniform("pointSize", 8 * ratio);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(
            records.flatMap(a =>
              globePoint(a.position.lat, a.position.lng).map(v => v * 1.016)
            )
          ),
          gl.DYNAMIC_DRAW
        );
        gl.drawArrays(gl.POINTS, 0, records.length);
      }
      const selected = latest.current.assets.find(
        a => a.id === latest.current.selectedId
      );
      if (selected) {
        color("var(--foreground)");
        uniform("pointSize", 14 * ratio);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(
            globePoint(selected.position.lat, selected.position.lng).map(
              v => v * 1.02
            )
          ),
          gl.DYNAMIC_DRAW
        );
        gl.drawArrays(gl.POINTS, 0, 1);
      }
    };
    const resize = new ResizeObserver(() => draw.current());
    resize.observe(element);
    const theme = new MutationObserver(() => {
      colors.clear();
      draw.current();
    });
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const wheel = (event: WheelEvent) => {
      if (document.activeElement !== element) return;
      event.preventDefault();
      view.current.distance = Math.max(
        2.2,
        Math.min(6, view.current.distance + event.deltaY * 0.002)
      );
      draw.current();
    };
    element.addEventListener("wheel", wheel, { passive: false });
    const lost = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    element.addEventListener("webglcontextlost", lost);
    draw.current();
    return () => {
      resize.disconnect();
      theme.disconnect();
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("webglcontextlost", lost);
      for (const buffer of buffers) gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);
  useEffect(() => draw.current(), [assets]);
  const focused = assets.find(a => a.id === selectedId);
  useEffect(() => {
    if (focused) {
      setOrbiting(false);
      view.current.yaw = (-focused.position.lng * Math.PI) / 180;
      view.current.pitch = Math.max(
        -1.35,
        Math.min(1.35, (focused.position.lat * Math.PI) / 180)
      );
    }
    draw.current();
  }, [selectedId, focused?.position.lat, focused?.position.lng]);
  const drag = useRef<{ x: number; y: number; distance: number } | null>(null);
  const rotate = (x: number, y: number) => {
    setOrbiting(false);
    view.current.yaw += x;
    view.current.pitch = Math.max(
      -1.35,
      Math.min(1.35, view.current.pitch + y)
    );
    draw.current();
    setOrientation(
      "3D globe orientation adjusted. Only recorded source positions are shown."
    );
  };
  const zoom = (delta: number) => {
    setOrbiting(false);
    view.current.distance = Math.max(
      2.2,
      Math.min(6, view.current.distance + delta)
    );
    draw.current();
  };
  return (
    <div className="globe-view">
      <canvas
        ref={canvas}
        className="shipment-globe"
        role="img"
        aria-label={`Interactive 3D globe with ${assets.length} recorded shipment positions. Arrow keys orbit, plus/minus zoom. Use the record selector for keyboard selection.`}
        tabIndex={0}
        onPointerDown={event => {
          setOrbiting(false);
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, distance: 0 };
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          const x = event.clientX - drag.current.x,
            y = event.clientY - drag.current.y;
          drag.current.distance += Math.abs(x) + Math.abs(y);
          drag.current.x = event.clientX;
          drag.current.y = event.clientY;
          rotate(x * 0.009, y * 0.009);
        }}
        onPointerUp={event => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.distance > 6) return;
          const box = event.currentTarget.getBoundingClientRect(),
            x = event.clientX - box.left,
            y = event.clientY - box.top;
          const hits = assets
            .map(a => ({
              a,
              p: projectPoint(
                globePoint(a.position.lat, a.position.lng),
                view.current.yaw,
                view.current.pitch,
                view.current.distance,
                box.width,
                box.height
              ),
            }))
            .filter(({ p }) => p.visible)
            .map(v => ({ ...v, d: Math.hypot(v.p.x - x, v.p.y - y) }))
            .filter(v => v.d < 18)
            .sort((a, b) => a.d - b.d);
          if (hits[0]) onSelect(hits[0].a.id);
        }}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={event => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "+",
              "-",
              "=",
            ].includes(event.key)
          )
            event.preventDefault();
          if (event.key === "ArrowLeft") rotate(-0.12, 0);
          if (event.key === "ArrowRight") rotate(0.12, 0);
          if (event.key === "ArrowUp") rotate(0, -0.12);
          if (event.key === "ArrowDown") rotate(0, 0.12);
          if (event.key === "+" || event.key === "=") zoom(-0.25);
          if (event.key === "-") zoom(0.25);
        }}
      />
      <div className="globe-controls">
        <Button
          size="sm"
          variant="outline"
          aria-pressed={orbiting}
          disabled={reducedMotion}
          onClick={() => setOrbiting(v => !v)}
        >
          {orbiting ? "Pause view rotation" : "Rotate view"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Zoom globe in"
          onClick={() => zoom(-0.3)}
        >
          +
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Zoom globe out"
          onClick={() => zoom(0.3)}
        >
          −
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setOrbiting(false);
            view.current = { yaw: 0, pitch: 0.16, distance: 3.2 };
            draw.current();
          }}
        >
          Reset globe
        </Button>
      </div>
      <p className="muted text-xs">
        {reducedMotion
          ? "Device motion reduction is enabled. Use the manual view controls."
          : "View rotation changes the camera only. Recorded positions stay fixed; no shipment movement is predicted."}
      </p>
      <p className="muted text-xs" aria-live="polite">
        {orientation}
      </p>
    </div>
  );
}
