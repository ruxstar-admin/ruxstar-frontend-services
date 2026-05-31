"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function fibonacciSphere(samples: number, radius: number) {
  const pts: THREE.Vector3[] = [];
  const offset = 2 / samples;
  const increment = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * increment;
    pts.push(
      new THREE.Vector3(
        Math.cos(phi) * r * radius,
        y * radius,
        Math.sin(phi) * r * radius,
      ),
    );
  }
  return pts;
}

type GlobeData = {
  root: THREE.Group;
  spin: THREE.Group;
  curves: THREE.QuadraticBezierCurve3[];
  flowGeo: THREE.BufferGeometry;
};

function buildGlobe(): GlobeData {
  const radius = 2;
    const root = new THREE.Group();
    const spin = new THREE.Group();
    root.add(spin);

    // faint dotted surface
    const dots = fibonacciSphere(620, radius);
    const dotArr = new Float32Array(dots.length * 3);
    dots.forEach((p, i) => p.toArray(dotArr, i * 3));
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(dotArr, 3));
    spin.add(
      new THREE.Points(
        dotGeo,
        new THREE.PointsMaterial({
          size: 0.018,
          color: 0xffffff,
          transparent: true,
          opacity: 0.3,
          sizeAttenuation: true,
          depthWrite: false,
        }),
      ),
    );

    // wireframe shell
    spin.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(radius, 24, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          transparent: true,
          opacity: 0.06,
        }),
      ),
    );

    // business nodes
    const nodes = fibonacciSphere(18, radius * 1.01);
    const nodeArr = new Float32Array(nodes.length * 3);
    nodes.forEach((p, i) => p.toArray(nodeArr, i * 3));
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodeArr, 3));
    spin.add(
      new THREE.Points(
        nodeGeo,
        new THREE.PointsMaterial({
          size: 0.075,
          color: 0xffffff,
          transparent: true,
          opacity: 1,
          sizeAttenuation: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

    // connection arcs
    const n = nodes.length;
    const pairs: [number, number][] = [];
    for (let i = 0; i < n; i++) pairs.push([i, (i + 1) % n]);
    for (let i = 0; i < n / 2; i++) pairs.push([i, (i + Math.floor(n / 2)) % n]);

    const curves: THREE.QuadraticBezierCurve3[] = [];
    const segPts: number[] = [];
    const seg = 26;
    pairs.forEach(([a, b]) => {
      const start = nodes[a];
      const end = nodes[b];
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const lift = radius + start.distanceTo(end) * 0.45;
      mid.normalize().multiplyScalar(lift);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      curves.push(curve);
      const cp = curve.getPoints(seg);
      for (let k = 0; k < cp.length - 1; k++) {
        segPts.push(cp[k].x, cp[k].y, cp[k].z);
        segPts.push(cp[k + 1].x, cp[k + 1].y, cp[k + 1].z);
      }
    });
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(segPts), 3),
    );
    spin.add(
      new THREE.LineSegments(
        arcGeo,
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.22,
        }),
      ),
    );

    // travelling pulses along arcs
    const flowArr = new Float32Array(curves.length * 3);
    const flowGeo = new THREE.BufferGeometry();
    flowGeo.setAttribute("position", new THREE.BufferAttribute(flowArr, 3));
    spin.add(
      new THREE.Points(
        flowGeo,
        new THREE.PointsMaterial({
          size: 0.06,
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          sizeAttenuation: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

  return { root, spin, curves, flowGeo };
}

function GlobeScene() {
  const mouse = useRef({ x: 0, y: 0 });
  const [data] = useState<GlobeData>(buildGlobe);
  const dataRef = useRef(data);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((state, delta) => {
    const d = dataRef.current;
    d.spin.rotation.y += delta * 0.12;

    const targetX = mouse.current.y * 0.3;
    const targetY = mouse.current.x * 0.4;
    d.root.rotation.x = THREE.MathUtils.lerp(d.root.rotation.x, targetX, 0.05);
    d.root.rotation.y = THREE.MathUtils.lerp(d.root.rotation.y, targetY, 0.05);

    const base = (state.clock.elapsedTime * 0.16) % 1;
    const pos = d.flowGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < d.curves.length; i++) {
      const t = (base + i / d.curves.length) % 1;
      const p = d.curves[i].getPoint(t);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  });

  return <primitive object={data.root} />;
}

export function Globe() {
  return (
    <div className="h-[24rem] w-full sm:h-[30rem] lg:h-[34rem]">
      <Canvas
        camera={{ position: [0, 0, 5.6], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: "none" }}
      >
        <GlobeScene />
      </Canvas>
    </div>
  );
}
