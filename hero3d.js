import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const canvas = document.querySelector("#cortexCanvas");
const hero = document.querySelector(".next-hero");
const nameEl = document.querySelector("#heroIntelName");
const metaEl = document.querySelector("#heroIntelMeta");
const meterEl = document.querySelector("#heroIntelMeter");

if (canvas && hero) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.65, 8.3);

  const pointer = new THREE.Vector2(0, 0);
  const targetRotation = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const cards = [];
  const cardData = window.CardCortexData?.cards || [];

  const group = new THREE.Group();
  group.position.x = 1.15;
  group.position.y = -0.05;
  scene.add(group);

  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambient);

  const key = new THREE.PointLight(0x76f7ff, 4, 24);
  key.position.set(-3, 4, 6);
  scene.add(key);

  const magenta = new THREE.PointLight(0xff3cab, 3.2, 24);
  magenta.position.set(4, -1, 4);
  scene.add(magenta);

  const starGeometry = new THREE.BufferGeometry();
  const starCount = 900;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const palette = [new THREE.Color("#7c5cff"), new THREE.Color("#14b8a6"), new THREE.Color("#f5b335"), new THREE.Color("#ed254e"), new THREE.Color("#2f80ed")];
  for (let i = 0; i < starCount; i += 1) {
    const radius = 4 + Math.random() * 7;
    const angle = Math.random() * Math.PI * 2;
    starPositions[i * 3] = Math.cos(angle) * radius;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    starPositions[i * 3 + 2] = Math.sin(angle) * radius - 3;
    const color = palette[Math.floor(Math.random() * palette.length)];
    starColors[i * 3] = color.r;
    starColors[i * 3 + 1] = color.g;
    starColors[i * 3 + 2] = color.b;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.028, vertexColors: true, transparent: true, opacity: 0.72 }));
  scene.add(stars);

  cardData.slice(0, 8).forEach((card, index) => {
    const texture = new THREE.CanvasTexture(makeCardTexture(card));
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      metalness: 0.18,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.9, 14, 14), material);
    const angle = (index / 8) * Math.PI * 2;
    const radius = 2.15 + (index % 3) * 0.34;
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.6) * 0.92, Math.sin(angle) * 1.4);
    mesh.rotation.set(-0.1 + Math.sin(angle) * 0.24, angle + Math.PI / 2, Math.cos(angle) * 0.16);
    mesh.userData = { card, base: mesh.position.clone(), angle, speed: 0.55 + Math.random() * 0.45 };
    cards.push(mesh);
    group.add(mesh);
  });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.9, 0.012, 12, 180),
    new THREE.MeshBasicMaterial({ color: 0x76f7ff, transparent: true, opacity: 0.32 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const ringTwo = ring.clone();
  ringTwo.scale.setScalar(1.35);
  ringTwo.material = new THREE.MeshBasicMaterial({ color: 0xff3cab, transparent: true, opacity: 0.2 });
  group.add(ringTwo);

  function makeCardTexture(card) {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 900;
    const ctx = c.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 640, 900);
    gradient.addColorStop(0, card.color || "#2f80ed");
    gradient.addColorStop(0.35, "#f5b335");
    gradient.addColorStop(0.62, "#14b8a6");
    gradient.addColorStop(1, "#111827");
    ctx.fillStyle = gradient;
    roundRect(ctx, 0, 0, 640, 900, 42);
    ctx.fill();

    for (let i = 0; i < 16; i += 1) {
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + i * 0.006})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(320, 450, 40 + i * 34, 0, Math.PI * 2);
      ctx.stroke();
    }

    const flare = ctx.createRadialGradient(210, 260, 20, 210, 260, 420);
    flare.addColorStop(0, "rgba(255,255,255,0.9)");
    flare.addColorStop(0.28, "rgba(255,255,255,0.2)");
    flare.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, 640, 900);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "900 54px Arial";
    ctx.fillText(card.name.slice(0, 16), 46, 92);
    ctx.font = "800 28px Arial";
    ctx.fillText(`${card.category} · ${card.set}`.slice(0, 28), 46, 142);
    ctx.font = "900 116px Arial";
    ctx.fillText(`$${card.rawValue}`, 46, 675);
    ctx.font = "900 34px Arial";
    ctx.fillText(`AI ${card.grade} · ${card.confidence}% confidence`, 46, 730);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 4;
    roundRect(ctx, 30, 30, 580, 840, 34);
    ctx.stroke();
    return c;
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
    const rect = hero.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    targetRotation.x = pointer.y * 0.22;
    targetRotation.y = pointer.x * 0.38;
  }

  function animate(time = 0) {
    const t = time * 0.001;
    group.rotation.y += (targetRotation.y - group.rotation.y) * 0.035;
    group.rotation.x += (targetRotation.x - group.rotation.x) * 0.035;
    group.rotation.z = Math.sin(t * 0.32) * 0.025;
    stars.rotation.y = t * 0.035;
    ring.rotation.z = t * 0.52;
    ringTwo.rotation.z = -t * 0.38;

    cards.forEach((mesh, index) => {
      const { base, speed } = mesh.userData;
      mesh.position.y = base.y + Math.sin(t * speed + index) * 0.2;
      mesh.lookAt(camera.position);
      mesh.rotation.z = Math.sin(t * 0.7 + index) * 0.06;
    });

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(cards, false)[0];
    cards.forEach((mesh) => mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08));
    if (hit) {
      hit.object.scale.lerp(new THREE.Vector3(1.14, 1.14, 1.14), 0.16);
      const card = hit.object.userData.card;
      nameEl.textContent = card.name;
      metaEl.textContent = `${card.category} · raw ${currency(card.rawValue)} · graded ${currency(card.gradedValue)} · AI ${card.grade}`;
      meterEl.style.width = `${card.confidence}%`;
    } else {
      meterEl.style.width = "58%";
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  function currency(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove);
  resize();
  animate();
}
