import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const page = document.body.dataset.page;
const skipPages = new Set(["home"]);

if (!skipPages.has(page)) {
  const canvas = document.createElement("canvas");
  canvas.id = "pageFxCanvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  injectHeadingOrbit();

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  camera.position.set(0, 0, 9);

  const group = new THREE.Group();
  group.position.set(1.5, 0.55, -0.35);
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 1.55));
  const cyan = new THREE.PointLight(0x76f7ff, 4.2, 28);
  cyan.position.set(4, 2, 5);
  scene.add(cyan);
  const rift = new THREE.PointLight(0x2f80ed, 3.4, 28);
  rift.position.set(-3, -1, 5);
  scene.add(rift);
  const ember = new THREE.PointLight(0xf5b335, 1.8, 20);
  ember.position.set(1, -3, 4);
  scene.add(ember);

  const pointer = new THREE.Vector2();
  const target = new THREE.Vector2();
  const cards = [];
  const palette = ["#76f7ff", "#f7fbff", "#1f5a84", "#061a2d", "#f5b335"];
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

  for (let i = 0; i < 18; i += 1) {
    const texture = new THREE.CanvasTexture(makeSlabTexture(labels[i % labels.length], palette[i % palette.length], i));
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 1.24, 5, 5),
      new THREE.MeshPhysicalMaterial({
        map: texture,
        transparent: true,
        opacity: 0.72,
        metalness: 0.36,
        roughness: 0.18,
        clearcoat: 1,
        side: THREE.FrontSide,
        emissive: new THREE.Color(palette[i % palette.length]),
        emissiveIntensity: 0.06,
      }),
    );
    const band = i / 18;
    const x = Math.cos(band * Math.PI * 2) * (2.4 + Math.random() * 2.8) + (Math.random() - 0.5) * 1.4;
    const y = Math.sin(band * Math.PI * 2) * (0.9 + Math.random() * 1.7) + (Math.random() - 0.5) * 1.2;
    const z = -Math.random() * 4.8;
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
  const ring = new THREE.LineLoop(lineGeometry, new THREE.LineBasicMaterial({ color: 0x76f7ff, transparent: true, opacity: 0.48 }));
  group.add(ring);
  const ringTwo = ring.clone();
  ringTwo.scale.set(1.45, 1.45, 1.45);
  ringTwo.rotation.x = 0.7;
  ringTwo.material = new THREE.LineBasicMaterial({ color: 0xf5b335, transparent: true, opacity: 0.22 });
  group.add(ringTwo);

  const stars = makeStars();
  scene.add(stars);

  function injectHeadingOrbit() {
    const heading = document.querySelector(".page-heading, .scan-result");
    if (!heading || heading.querySelector(".heading-orbit-field")) return;
    const words = {
      vault: ["Vault", "Slab", "Value", "Hold"],
      scanner: ["Scan", "Focus", "Match", "Save"],
      pricing: ["Comps", "Raw", "Grade", "Spread"],
      grading: ["Front", "Back", "Surface", "Cert"],
      marketplace: ["List", "Route", "Sold", "Ship"],
      assistant: ["Ask", "Plan", "Grade", "Sell"],
      auth: ["Sync", "Secure", "Vault", "Cloud"],
    }[page] || ["Card", "Grade", "Value", "AI"];
    const field = document.createElement("div");
    field.className = "heading-orbit-field";
    field.setAttribute("aria-hidden", "true");
    field.innerHTML = words.map((word, index) => `<span style="--i:${index}; --label:'${word}'">${word}</span>`).join("");
    heading.prepend(field);
  }

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
    ctx.fillStyle = "rgba(255,255,255,.94)";
    ctx.shadowColor = "rgba(118,247,255,.9)";
    ctx.shadowBlur = 22;
    ctx.font = "900 42px Arial";
    ctx.fillText(label, 34, 86);
    ctx.font = "900 72px Arial";
    ctx.fillText(`0${(index % 9) + 1}`, 34, 440);
    ctx.shadowBlur = 0;
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
    const count = 620;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 7;
      positions[i * 3 + 2] = -Math.random() * 8;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x76f7ff, size: 0.028, transparent: true, opacity: 0.5 }));
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
    ringTwo.rotation.z = -t * 0.26;
    stars.rotation.y = t * 0.025;
    cards.forEach((card) => {
      card.position.y = card.userData.base.y + Math.sin(t * card.userData.speed + card.userData.phase) * 0.32;
      card.position.x = card.userData.base.x + Math.cos(t * card.userData.speed * 0.72 + card.userData.phase) * 0.08;
      card.lookAt(camera.position);
      card.rotation.z += Math.sin(t + card.userData.phase) * 0.0016;
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize);
  animate();
}
