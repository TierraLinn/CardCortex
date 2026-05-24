import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const page = document.body.dataset.page;
const skipPages = new Set(["home"]);

if (!skipPages.has(page)) {
  const canvas = document.createElement("canvas");
  canvas.id = "pageFxCanvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  camera.position.set(0, 0, 9);

  const group = new THREE.Group();
  group.position.set(2.8, -0.1, -0.7);
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const cyan = new THREE.PointLight(0x5eead4, 2.8, 24);
  cyan.position.set(4, 2, 5);
  scene.add(cyan);
  const rose = new THREE.PointLight(0xed254e, 2.4, 24);
  rose.position.set(-3, -1, 5);
  scene.add(rose);

  const pointer = new THREE.Vector2();
  const target = new THREE.Vector2();
  const cards = [];
  const palette = ["#2f80ed", "#14b8a6", "#f5b335", "#ed254e", "#7c5cff"];
  const labels = {
    vault: ["Vault", "Binder", "Slab", "Value"],
    scanner: ["Scan", "Match", "Review", "Save"],
    pricing: ["TCG", "Market", "Comps", "Spread"],
    grading: ["Front", "Back", "Edges", "Surface"],
    marketplace: ["eBay", "TCG", "Route", "List"],
    assistant: ["Ask", "Hold", "Sell", "Grade"],
    auth: ["Account", "Secure", "Vault", "Sync"],
    privacy: ["Private", "Control", "Delete", "Export"],
    terms: ["Beta", "Research", "Values", "Source"],
  }[page] || ["Cards", "AI", "Value", "Vault"];

  for (let i = 0; i < 10; i += 1) {
    const texture = new THREE.CanvasTexture(makeSlabTexture(labels[i % labels.length], palette[i % palette.length], i));
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 1.04, 5, 5),
      new THREE.MeshPhysicalMaterial({
        map: texture,
        transparent: true,
        opacity: 0.48,
        metalness: 0.2,
        roughness: 0.24,
        clearcoat: 1,
        side: THREE.FrontSide,
      }),
    );
    const x = (Math.random() - 0.5) * 6.5;
    const y = (Math.random() - 0.5) * 3.8;
    const z = -Math.random() * 4;
    mesh.position.set(x, y, z);
    mesh.userData = { base: mesh.position.clone(), speed: 0.35 + Math.random() * 0.7, phase: Math.random() * Math.PI * 2 };
    cards.push(mesh);
    group.add(mesh);
  }

  const lineGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(360 * 3);
  for (let i = 0; i < 360; i += 1) {
    const a = (i / 360) * Math.PI * 2;
    const r = 2.4 + Math.sin(a * 5) * 0.08;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(a) * 0.38;
    positions[i * 3 + 2] = Math.sin(a) * r * 0.18;
  }
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const ring = new THREE.LineLoop(lineGeometry, new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.22 }));
  group.add(ring);

  const stars = makeStars();
  scene.add(stars);

  function makeSlabTexture(label, color, index) {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 520;
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 360, 520);
    g.addColorStop(0, color);
    g.addColorStop(0.45, "#111827");
    g.addColorStop(1, palette[(index + 2) % palette.length]);
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, 360, 520, 26);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.42)";
    ctx.lineWidth = 3;
    roundRect(ctx, 18, 18, 324, 484, 20);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "900 42px Arial";
    ctx.fillText(label, 34, 86);
    ctx.font = "900 72px Arial";
    ctx.fillText(`0${(index % 9) + 1}`, 34, 440);
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.arc(180, 250, 40 + i * 32, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return canvas;
  }

  function makeStars() {
    const count = 420;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 7;
      positions[i * 3 + 2] = -Math.random() * 8;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x7c5cff, size: 0.022, transparent: true, opacity: 0.38 }));
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  }

  window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
    target.x = pointer.y * 0.22;
    target.y = pointer.x * 0.34;
  });

  function animate(time = 0) {
    const t = time * 0.001;
    group.rotation.x += (target.x - group.rotation.x) * 0.035;
    group.rotation.y += (target.y - group.rotation.y) * 0.035;
    group.rotation.z = Math.sin(t * 0.3) * 0.035;
    ring.rotation.z = t * 0.4;
    stars.rotation.y = t * 0.025;
    cards.forEach((card) => {
      card.position.y = card.userData.base.y + Math.sin(t * card.userData.speed + card.userData.phase) * 0.22;
      card.lookAt(camera.position);
      card.rotation.z += Math.sin(t + card.userData.phase) * 0.0009;
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize);
  animate();
}
