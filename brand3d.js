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

  const card = makeUniverseCard();
  group.add(card);

  const innerGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.74, 80),
    new THREE.MeshBasicMaterial({
      color: 0x76f7ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  innerGlow.position.z = -0.04;
  card.add(innerGlow);

  const rings = [
    makeRing(1.72, 0x76f7ff, 0.72, [Math.PI / 2, 0, 0]),
    makeRing(2.1, 0xf5b335, 0.34, [1.04, 0.58, 0.2]),
    makeRing(2.46, 0x1f5a84, 0.48, [0.56, -0.74, 0.88]),
  ];
  rings.forEach((ring) => group.add(ring));

  const planets = makeCardPlanets();
  group.add(planets);

  const sparks = makeSparks();
  group.add(sparks);

  function makeUniverseCard() {
    const texture = new THREE.CanvasTexture(makeBrandTexture());
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.BoxGeometry(1.28, 1.82, 0.08, 12, 12, 1);
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      emissive: 0x061a2d,
      emissiveIntensity: 0.22,
      metalness: 0.3,
      roughness: 0.13,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      iridescence: 0.62,
      iridescenceIOR: 1.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = -0.08;
    return mesh;
  }

  function makeBrandTexture() {
    const c = document.createElement("canvas");
    c.width = 560;
    c.height = 780;
    const ctx = c.getContext("2d");
    const bg = ctx.createRadialGradient(275, 250, 20, 280, 390, 620);
    bg.addColorStop(0, "#f7fbff");
    bg.addColorStop(0.11, "#76f7ff");
    bg.addColorStop(0.28, "#1f5a84");
    bg.addColorStop(0.58, "#061a2d");
    bg.addColorStop(1, "#01030a");
    ctx.fillStyle = bg;
    rounded(ctx, 0, 0, c.width, c.height, 48);
    ctx.fill();

    const flare = ctx.createRadialGradient(245, 245, 8, 250, 250, 430);
    flare.addColorStop(0, "rgba(255,255,255,.96)");
    flare.addColorStop(0.16, "rgba(118,247,255,.42)");
    flare.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.strokeStyle = "rgba(255,255,255,.54)";
    ctx.lineWidth = 9;
    rounded(ctx, 34, 34, c.width - 68, c.height - 68, 34);
    ctx.stroke();

    ctx.save();
    ctx.translate(280, 386);
    ctx.rotate(-0.33);
    for (let i = 0; i < 5; i += 1) {
      ctx.strokeStyle = `rgba(118,247,255,${0.38 - i * 0.055})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 76 + i * 38, 22 + i * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const sun = ctx.createRadialGradient(280, 360, 8, 280, 360, 118);
    sun.addColorStop(0, "#ffffff");
    sun.addColorStop(0.24, "#76f7ff");
    sun.addColorStop(0.72, "rgba(31,90,132,.6)");
    sun.addColorStop(1, "rgba(1,3,10,0)");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(280, 360, 118, 0, Math.PI * 2);
    ctx.fill();

    const planetColors = ["#f7fbff", "#76f7ff", "#f5b335", "#1f5a84"];
    [
      [168, 324, 12],
      [384, 392, 16],
      [310, 274, 9],
      [214, 470, 10],
    ].forEach(([x, y, r], i) => {
      ctx.fillStyle = planetColors[i];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#050713";
    ctx.font = "950 104px Arial";
    ctx.fillText("CC", 130, 406);
    ctx.fillStyle = "rgba(255,255,255,.86)";
    ctx.font = "900 32px Arial";
    ctx.fillText("CARD UNIVERSE", 118, 560);
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

  function makeCardPlanets() {
    const planetGroup = new THREE.Group();
    const specs = [
      { radius: 1.72, size: 0.15, color: 0xf7fbff, speed: 0.78, phase: 0 },
      { radius: 2.1, size: 0.19, color: 0xf5b335, speed: -0.54, phase: 1.6 },
      { radius: 2.46, size: 0.13, color: 0x76f7ff, speed: 0.42, phase: 3.1 },
    ];
    specs.forEach((spec) => {
      const pivot = new THREE.Group();
      pivot.userData = spec;
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(spec.size, 24, 16),
        new THREE.MeshPhysicalMaterial({
          color: spec.color,
          emissive: spec.color,
          emissiveIntensity: 0.2,
          metalness: 0.15,
          roughness: 0.22,
          clearcoat: 1,
        }),
      );
      body.position.x = spec.radius;
      pivot.add(body);
      planetGroup.add(pivot);
    });
    return planetGroup;
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
    card.rotation.y = Math.sin(t * 1.1) * 0.16;
    innerGlow.material.opacity = 0.14 + Math.sin(t * 3) * 0.04;
    rings[0].rotation.z = t * 1.4;
    rings[1].rotation.z = -t * 1.05;
    rings[2].rotation.z = t * 0.82;
    planets.children.forEach((pivot) => {
      pivot.rotation.y = t * pivot.userData.speed + pivot.userData.phase;
      pivot.rotation.z = Math.sin(t * 0.5 + pivot.userData.phase) * 0.25;
    });
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
