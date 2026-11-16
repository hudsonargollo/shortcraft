"use client";

import { useRef, useEffect, useState } from "react";
import * as THREE from "three";

type Vec3 = [number, number, number];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rand(max: number, seed: number) {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

export default function VascularHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current!;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    const canvas = renderer.domElement as HTMLCanvasElement;
    container.appendChild(canvas);

    const ambient = new THREE.AmbientLight(0x8899bb, 0.45);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffeedd, 1.6);
    key.position.set(40, 60, 30);
    scene.add(key);

    function buildTree(depth: number, origin: Vec3, dir: Vec3, len: number, radius: number, n: number, a: number, growth: (t: number) => number) {
      if (depth === 0) return;
      const t = growth(Math.min(1, len / 180));
      const end: Vec3 = [origin[0] + dir[0] * len * t, origin[1] + dir[1] * len * t, origin[2] + dir[2] * len * t];
      const geo = new THREE.TorusKnotGeometry(radius * (0.9 + 0.2 * t), radius * 0.08, 6, 8, 2, 3);
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.60 + 0.12 * t, 0.85, 0.55 + 0.2 * (1 - t)),
        roughness: 0.35,
        metalness: 0.15,
        emissive: new THREE.Color().setHSL(0.60 + 0.12 * t, 0.85, 0.08 + 0.06 * (1 - t)),
        emissiveIntensity: 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(end[0], end[1], end[2]);
      mesh.position.y += radius * 0.3;
      (mesh.userData as any) = { dir, origin, end, depth, t, radius };
      mesh.castShadow = true;
      scene.add(mesh);
      const spread = 0.35 + 0.05 * t;
      for (let i = 0; i < n; i++) {
        const rot = rand(1, seed + i) * Math.PI * 2;
        const axis = new THREE.Vector3(...dir).cross(new THREE.Vector3(0, 1, 0)).normalize();
        const q = new THREE.Quaternion().setFromAxisAngle(axis, rot);
        const nd = new THREE.Vector3(...dir).clone().applyQuaternion(q).normalize();
        buildTree(depth - 1, end, [nd.x, nd.y, nd.z], len * 0.6, radius * (0.5 + 0.1 * t), n, a, growth);
      }
    }

    function growth(t: number) { return t * t; }

    const seed = 42;
    const base: Vec3 = [0, 24, 0];
    const mainDir = [0.3, -0.95, -0.2];
    const mainDirNorm = new THREE.Vector3(...mainDir).normalize();
    buildTree(4, base, [mainDirNorm.x, mainDirNorm.y, mainDirNorm.z], 260, 2.2, 2, 30, growth);

    camera.position.set(0, 120, 160);
    camera.lookAt(0, 0, 0);

    const clock = new THREE.Clock();
    let t = 0;

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();

    setLoading(false);

    function animate() {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      t += dt;
      const s = 1 + 0.25 * Math.sin(t * 0.12);
      const targetY = 20 + 60 * Math.sin(t * 0.03);
      const targetZ = 160 * Math.cos(t * 0.04);
      camera.position.y += (lerp(targetY, camera.position.y, s) - camera.position.y) * dt * 0.5;
      camera.position.z += (lerp(targetZ, camera.position.z, s) - camera.position.z) * dt * 0.5;
      scene.children.forEach((child) => {
        const u = (child as THREE.Mesh).userData as any;
        if (u && u.depth > 0) {
          const p = u.end as Vec3;
          const o = u.origin as Vec3;
          const g = growth((t + u.depth * 8) % 60 / 60);
          (child as THREE.Mesh).position.x = lerp(o[0], p[0], g);
          (child as THREE.Mesh).position.y = lerp(o[1], p[1], g) + u.radius * 0.3;
          (child as THREE.Mesh).position.z = lerp(o[2], p[2], g);
          const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          m.color.setHSL(0.60 + 0.12 * g, 0.85, 0.55 + 0.2 * (1 - g));
          m.emissive.setHSL(0.60 + 0.12 * g, 0.85, 0.08 + 0.06 * (1 - g));
        }
      });
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      container.removeChild(canvas);
      renderer.dispose();
    };
  }, []);

  return (
    <section className="hero" aria-label="Vascular system visualization">
      <div className="hero__canvas-wrap" ref={containerRef} aria-hidden="true" />
      <div className="hero__overlay">
        <p className="hero__kicker">Vascular</p>
        <h1 className="hero__title">The circulatory system, rendered in motion</h1>
        <p className="hero__lede">
          Endovascular imaging and intervention, designed for the people who live inside the vessels. Every frame is
          computed&mdash;no AI, no shortcuts.
        </p>
      </div>
    </section>
  );
}
