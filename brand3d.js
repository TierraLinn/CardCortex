import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

document.querySelectorAll(".brand-glyph").forEach((host) => {
  const canvas = document.createElement("canvas");
  canvas.className = "brand-3d-canvas";
  host.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(0, 0, 8);

  const pointer = new THREE.Vector2();
  const target = new THREE.Vector2();
  const group = new THREE.Group();
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const cyan = new THREE.PointLight(0x76f7ff, 4.5, 18);
  cyan.position.set(-3, 3, 5);
  scene.add(cyan);
  const gold = new THREE.PointLight(0xf5b335, 2.2, 18);
  gold.position.set(3, -2, 4);
  scene.add(gold);
  const deepBlue = new THREE.PointLight(0x1f5a84, 3.4, 18);
  deepBlue.position.set(2, 3, 3);
  scene.add(deepBlue);

  const card = makePrismCard();
  group.add(card);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.54, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0x76f7ff,
      emissive: 0x123d4c,
      metalness: 0.28,
      roughness: 0.14,
      transmission: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
  );
  core.position.z = 0.18;
  group.add(core);

  const rings = [
    makeRing(1.82, 0x76f7ff, 0.7, [Math.PI / 2, 0, 0]),
    makeRing(2.14, 0xf5b335, 0.34, [1.05, 0.58, 0.2]),
    makeRing(2.42, 0x1f5a84, 0.46, [0.56, -0.74, 0.88]),
  ];
  rings.forEach((ring) => group.add(ring));

  const sparks = makeSparks();
  group.add(sparks);

  function makePrismCard() {
    const texture = new THREE.CanvasTexture(makeBrandTexture());
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.BoxGeometry(1.42, 2.05, 0.08, 10, 10, 1);
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      metalness: 0.2,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.8,
      iridescenceIOR: 1.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = -0.12;
    return mesh;
  }

  function makeBrandTexture() {
    const c = document.createElement("canvas");
    c.width = 560;
    c.height = 780;
    const ctx = c.getContext("2d");
    const bg = ctx.createLinearGradient(0, 0, c.width, c.height);
    bg.addColorStop(0, "#f7fbff");
    bg.addColorStop(0.14, "#76f7ff");
    bg.addColorStop(0.44, "#1f5a84");
    bg.addColorStop(0.72, "#061a2d");
    bg.addColorStop(1, "#01030a");
    ctx.fillStyle = bg;
    rounded(ctx, 0, 0, c.width, c.height, 48);
    ctx.fill();

    const flare = ctx.createRadialGradient(150, 120, 12, 170, 120, 430);
    flare.addColorStop(0, "rgba(255,255,255,.96)");
    flare.addColorStop(0.22, "rgba(255,255,255,.3)");
    flare.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.strokeStyle = "rgba(255,255,255,.62)";
    ctx.lineWidth = 10;
    rounded(ctx, 34, 34, c.width - 68, c.height - 68, 34);
    ctx.stroke();

    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 9; i += 1) {
      ctx.strokeStyle = `rgba(255,255,255,${0.15 - i * 0.01})`;
      ctx.beginPath();
      ctx.arc(280, 390, 62 + i * 38, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#050713";
    ctx.font = "950 132px Arial";
    ctx.fillText("C", 96, 468);
    ctx.fillText("C", 256, 468);
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = "900 38px Arial";
    ctx.fillText("CORTEX", 115, 560);
    return c;
  }

  function makeRing(radius, color, opacity, rotation) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.025, 12, 140),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
    );
    ring.rotation.set(rotation[0], rotation[1], rotation[2]);
    return ring;
  }

  function makeSparks() {
    const count = 80;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color("#76f7ff"), new THREE.Color("#f7fbff"), new THREE.Color("#1f5a84"), new THREE.Color("#f5b335")];
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.4 + Math.random() * 1.6;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      const color = palette[i % palette.length];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.9 }));
  }

  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  }

  function localPointer(event) {
    const rect = host.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    target.x = pointer.y * 0.42;
    target.y = pointer.x * 0.72;
  }

  function animate(time = 0) {
    const t = time * 0.001;
    group.rotation.x += (target.x - group.rotation.x) * 0.05;
    group.rotation.y += (target.y - group.rotation.y) * 0.05;
    group.rotation.z = Math.sin(t * 0.9) * 0.08;
    card.rotation.y = Math.sin(t * 1.1) * 0.22;
    core.rotation.x = t * 1.4;
    core.rotation.y = t * 1.1;
    rings[0].rotation.z = t * 1.4;
    rings[1].rotation.z = -t * 1.05;
    rings[2].rotation.z = t * 0.82;
    sparks.rotation.z = -t * 0.4;
    sparks.rotation.y = t * 0.25;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  host.addEventListener("pointermove", localPointer);
  host.addEventListener("pointerleave", () => {
    target.set(0, 0);
  });
  window.addEventListener("resize", resize);
  resize();
  animate();
});
