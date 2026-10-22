/* Dónde se juega: cuatro escenarios con su tina, su piso, sus asientos,
   lo que hay alrededor y su luz.

     comunidad · la hondonada de cemento en la tierra, de noche, con un
                 foco colgado y la gente agachada en el piso.
     patio     · una tina de concreto en el patio de la casa, por la
                 tarde, con sillas de plástico.
     plaza     · la tina de plástico pintada, de las ferias, en la plaza,
                 de día, con banquitos.
     tienda    · una batea de madera afuera de la tienda del barrio, al
                 anochecer, con jabas de colas de asiento.

   La tina se arma de cero: la superficie es una malla polar con los dos
   agujeros RECORTADOS —no pintados encima— y cada agujero tiene paredes
   y fondo, para que las canicas que caen se queden adentro, asomando. */

export const ESCENARIOS = {
  comunidad: { nombre: 'En la comunidad', corto: 'Comunidad' },
  patio: { nombre: 'En el patio', corto: 'Patio' },
  plaza: { nombre: 'En la plaza', corto: 'Plaza' },
  tienda: { nombre: 'En la tienda', corto: 'Tienda' },
};

export const HONDO_HUECO = .055;   // lo que se hunde un agujero

/* ─── texturas pintadas en un canvas ───────────────────────── */
function lienzo(THREE, w, h, pinta, { repite = true, flipY = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  pinta(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = flipY;
  if (repite) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// pinta algo nueve veces —también del otro lado de cada borde— para que la textura empate al repetirse
const nueve = (w, h, pinta) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) pinta(dx, dy); };
function grano(g, w, h, { manchas = 1800, tamano = 18, claro = '235,230,220', oscuro = '60,55,50', alfa = .07, puntos = 14000, rayas = 30 } = {}) {
  for (let i = 0; i < manchas; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = Math.random() * tamano + 2;
    g.fillStyle = `rgba(${Math.random() < .5 ? oscuro : claro},${Math.random() * alfa})`;
    nueve(w, h, (dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); });
  }
  for (let i = 0; i < puntos; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * .16})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
  }
  g.strokeStyle = 'rgba(50,45,40,.18)'; g.lineWidth = 1;
  for (let i = 0; i < rayas; i++) {
    const pts = [[Math.random() * w, Math.random() * h]];
    for (let k = 0; k < 6; k++) { const [x, y] = pts[pts.length - 1]; pts.push([x + (Math.random() - .5) * 40, y + (Math.random() - .5) * 40]); }
    nueve(w, h, (dx, dy) => { g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy)); g.stroke(); });
  }
}

const TEXTURAS = {
  cemento: T => lienzo(T, 512, 512, (g, w, h) => { g.fillStyle = '#a9a49b'; g.fillRect(0, 0, w, h); grano(g, w, h); }),
  concreto: T => lienzo(T, 512, 512, (g, w, h) => {
    g.fillStyle = '#c4c2bc'; g.fillRect(0, 0, w, h);
    grano(g, w, h, { manchas: 900, tamano: 30, alfa: .05, puntos: 5000, rayas: 6 });
  }),
  tierra: T => lienzo(T, 512, 512, (g, w, h) => {
    g.fillStyle = '#8a6a4a'; g.fillRect(0, 0, w, h);
    grano(g, w, h, { manchas: 2400, tamano: 26, claro: '190,160,120', oscuro: '70,50,35', alfa: .12, puntos: 18000, rayas: 40 });
  }),
  losa: T => lienzo(T, 512, 512, (g, w, h) => {
    g.fillStyle = '#b3b0a8'; g.fillRect(0, 0, w, h);
    grano(g, w, h, { manchas: 900, tamano: 22, alfa: .06, puntos: 8000, rayas: 10 });
    g.strokeStyle = 'rgba(60,58,52,.55)'; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  }),
  adoquin: T => lienzo(T, 512, 512, (g, w, h) => {
    g.fillStyle = '#4b4741'; g.fillRect(0, 0, w, h);
    const n = 8, c = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const ox = (y % 2) * c / 2, k = 140 + Math.random() * 45 | 0;
      const cx = x * c + ox + c / 2, cy = y * c + c / 2;
      nueve(w, h, (dx, dy) => {
        const gr = g.createRadialGradient(cx + dx - c * .15, cy + dy - c * .15, 2, cx + dx, cy + dy, c * .55);
        gr.addColorStop(0, `rgb(${k + 25},${k + 18},${k + 8})`); gr.addColorStop(1, `rgb(${k - 35},${k - 38},${k - 42})`);
        g.fillStyle = gr; g.beginPath(); g.roundRect(cx + dx - c * .45, cy + dy - c * .43, c * .9, c * .86, c * .22); g.fill();
      });
    }
  }),
  baldosa: T => lienzo(T, 512, 512, (g, w, h) => {
    const n = 4, c = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? '#8e2f25' : '#e6dcc4'; g.fillRect(x * c, y * c, c, c);
    }
    grano(g, w, h, { manchas: 600, tamano: 20, alfa: .07, puntos: 6000, rayas: 8 });
    g.strokeStyle = 'rgba(40,30,25,.5)'; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, h); g.moveTo(0, i * c); g.lineTo(w, i * c); g.stroke(); }
  }),
  /* La tina de plástico de las ferias: blanca, con la cara pintada, la
     leyenda alrededor y las banderas de la provincia. Se proyecta entera
     sobre la tina (u = x/2+½, v = z/2+½): arriba del canvas es el fondo
     de la tina, abajo es donde estás tú. */
  carita: T => lienzo(T, 1024, 1024, (g, w, h) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h);
    const X = x => (x * .5 + .5) * w, Y = z => (z * .5 + .5) * h;
    // los ojos, grandes, del lado de enfrente
    for (const lado of [-1, 1]) {
      const cx = X(lado * .2), cy = Y(-.42);
      g.fillStyle = '#fff'; g.strokeStyle = '#1d1a1a'; g.lineWidth = 9;
      g.beginPath(); g.ellipse(cx, cy, 72, 92, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#4aa7dd'; g.beginPath(); g.arc(cx + lado * 8, cy + 18, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(cx + lado * 8, cy + 20, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + lado * 8 + 10, cy + 8, 9, 0, Math.PI * 2); g.fill();
      g.lineWidth = 10; g.beginPath(); g.arc(cx, cy - 70, 70, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    // la sonrisa, del lado tuyo
    g.strokeStyle = '#1d1a1a'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.arc(X(0), Y(.08), 230, Math.PI * .22, Math.PI * .78); g.stroke();
    // la leyenda alrededor del borde
    g.save(); g.translate(w / 2, h / 2);
    g.font = '800 38px Syne, Inter, system-ui, sans-serif'; g.fillStyle = '#1d1a1a'; g.textAlign = 'center';
    const texto = 'EL BOLICHE · UN JUEGO TRADICIONAL · ', R = w * .455;
    const letras = [...texto + texto];
    letras.forEach((l, i) => {
      const a = -Math.PI * .95 + i * (Math.PI * 2 / letras.length);
      g.save(); g.rotate(a); g.translate(0, -R); g.fillText(l, 0, 0); g.restore();
    });
    g.restore();
    // las banderas: verde, amarillo y azul, con estrellas
    for (const [x, z, a] of [[-.78, .38, .5], [.78, .38, -.5], [.72, -.5, .7], [-.72, -.5, -.7]]) {
      g.save(); g.translate(X(x), Y(z)); g.rotate(a);
      [['#2f8f3a', 0], ['#f3c623', 1], ['#1b5faa', 2]].forEach(([c, i]) => { g.fillStyle = c; g.fillRect(-55, -40 + i * 27, 110, 27); });
      g.fillStyle = '#fff'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(-30 + k * 15, 27, 3.5, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
  }, { repite: false, flipY: false }),
  /* La batea de madera, torneada: anillos concéntricos y vetas. */
  batea: T => lienzo(T, 1024, 1024, (g, w, h) => {
    g.fillStyle = '#9c6a3c'; g.fillRect(0, 0, w, h);
    for (let r = 4; r < w * .75; r += 3 + Math.random() * 7) {
      g.strokeStyle = `rgba(${Math.random() < .5 ? '70,40,20' : '200,150,100'},${.08 + Math.random() * .14})`;
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath(); g.ellipse(w / 2 + (Math.random() - .5) * 6, h / 2, r, r * (1 + (Math.random() - .5) * .02), 0, 0, Math.PI * 2); g.stroke();
    }
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(30,15,5,${Math.random() * .1})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); }
  }, { repite: false, flipY: false }),
};

/* ─── la tina: superficie con agujeros, pozos, tope y borde ─── */
function superficie(THREE, CFG, alt, { uvUnico, ladoCajita }) {
  const N = 120, M = 200, pos = [], col = [], uv = [], idx = [];
  const R = CFG.redondo, K = CFG.cajita, medio = ladoCajita / 2;
  for (let i = 0; i <= N; i++) {
    const r = Math.max(.0008, Math.pow(i / N, 1.6));
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, alt(x, z), z);
      const k = .45 + .55 * Math.pow(r, .8);
      col.push(k, k, k * 1.01);
      if (uvUnico) uv.push(x * .5 + .5, z * .5 + .5); else uv.push(x * .45, z * .45);
    }
  }
  const dentro = (x, z) => Math.hypot(x - R.x, z - R.z) < R.r || (Math.abs(x - K.x) < medio && Math.abs(z - K.z) < medio);
  const v = n => [pos[n * 3], pos[n * 3 + 2]];
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1;
    for (const tri of [[a, b, c], [b, d, c]]) {   // de frente hacia arriba
      const [cx, cz] = tri.map(v).reduce(([sx, sz], [x, z]) => [sx + x / 3, sz + z / 3], [0, 0]);
      if (!dentro(cx, cz)) idx.push(...tri);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/* Una pared que baja desde el borde del agujero —siguiendo la cuesta—
   hasta el fondo: `contorno` son los puntos (x, z) del borde. */
function pared(THREE, alt, contorno, fondoY) {
  const pos = [], idx = [];
  contorno.forEach(([x, z]) => { pos.push(x, alt(x, z), z, x, fondoY, z); });
  for (let i = 0; i < contorno.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

function tina(THREE, CFG, alt, e, grupo) {
  const tex = TEXTURAS[e.tina](THREE);
  const material = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: e.rugosa ?? .95, metalness: 0 });
  const ladoCajita = Math.max(CFG.cajita.lado, CFG.bola * 2.25);
  const s = new THREE.Mesh(superficie(THREE, CFG, alt, { uvUnico: !tex.wrapS || tex.wrapS !== THREE.RepeatWrapping, ladoCajita }), material);
  s.receiveShadow = true; grupo.add(s);

  // el borde y lo de afuera, en un torno
  const H = e.alto || 0, perfil = [new THREE.Vector2(1, 0)];
  if (H) perfil.push(new THREE.Vector2(1.012, .022), new THREE.Vector2(1.06, .026), new THREE.Vector2(1.075, .012), new THREE.Vector2(1.09, -H * .2), new THREE.Vector2(1.11, -H));
  else perfil.push(new THREE.Vector2(1.015, .028), new THREE.Vector2(1.07, .032), new THREE.Vector2(1.1, 0), new THREE.Vector2(1.55, -.002));
  const borde = new THREE.LatheGeometry(perfil, 128);
  { const p = borde.attributes.position, u = borde.attributes.uv, c = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      u.setXY(i, tex.wrapS === THREE.RepeatWrapping ? x * .45 : x * .5 + .5, tex.wrapS === THREE.RepeatWrapping ? z * .45 : z * .5 + .5);
      const k = e.bordeClaro ?? 1.06; c.push(k, k, k);
    }
    borde.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
  // el torno sale mirando para adentro o para afuera según el perfil: que se vea de los dos lados
  const matBorde = e.materialBorde ? new THREE.MeshStandardMaterial({ color: e.materialBorde, roughness: .8, vertexColors: true }) : material.clone();
  matBorde.side = THREE.DoubleSide;
  const mb = new THREE.Mesh(borde, matBorde);
  mb.receiveShadow = mb.castShadow = true; grupo.add(mb);

  // los pozos: el redondo, con aro de lata
  const oscuro = new THREE.MeshStandardMaterial({ color: e.pozo ?? 0x2a2622, roughness: 1, side: THREE.DoubleSide });
  const fondo = new THREE.MeshStandardMaterial({ color: 0x141110, roughness: 1 });
  const R = CFG.redondo, yR = alt(R.x, R.z) - HONDO_HUECO;
  const circulo = [];
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; circulo.push([R.x + Math.cos(a) * R.r, R.z + Math.sin(a) * R.r]); }
  grupo.add(new THREE.Mesh(pared(THREE, alt, circulo, yR), oscuro));
  const fr = new THREE.Mesh(new THREE.CircleGeometry(R.r, 32), fondo); fr.rotation.x = -Math.PI / 2; fr.position.set(R.x, yR, R.z); grupo.add(fr);
  const aro = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
    circulo.slice(0, -1).map(([x, z]) => new THREE.Vector3(x, alt(x, z) + .002, z)), true), 48, .0055, 6, true),
    new THREE.MeshStandardMaterial({ color: 0xb9b6ae, metalness: .85, roughness: .35 }));
  aro.castShadow = true; grupo.add(aro);

  // la cajita, con marco de madera
  const K = CFG.cajita, m = ladoCajita / 2, yK = Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => alt(K.x + a * m, K.z + b * m))) - HONDO_HUECO;
  const cuadro = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => [K.x + a * m, K.z + b * m]);
  const lados = [];
  for (let i = 0; i < 4; i++) { const [x0, z0] = cuadro[i], [x1, z1] = cuadro[i + 1]; for (let k = 0; k <= 6; k++) lados.push([x0 + (x1 - x0) * k / 6, z0 + (z1 - z0) * k / 6]); }
  const madera = new THREE.MeshStandardMaterial({ color: 0xa8763f, roughness: .8 });
  grupo.add(new THREE.Mesh(pared(THREE, alt, lados, yK), new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: .9, side: THREE.DoubleSide })));
  const fk = new THREE.Mesh(new THREE.PlaneGeometry(ladoCajita, ladoCajita), fondo); fk.rotation.x = -Math.PI / 2; fk.position.set(K.x, yK, K.z); grupo.add(fk);
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = cuadro[i], [x1, z1] = cuadro[i + 1], mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const l = new THREE.Mesh(new THREE.BoxGeometry(ladoCajita + .012, .009, .007), madera);
    l.position.set(mx + (mx - K.x) * .08, alt(mx, mz) + .003, mz + (mz - K.z) * .08);
    l.rotation.y = -Math.atan2(z1 - z0, x1 - x0); l.castShadow = true; grupo.add(l);
  }

  // el tope: una cuña de madera tirada en el fondo
  const T = CFG.tope, forma = new THREE.Shape();
  forma.moveTo(-T.largo / 2, 0); forma.lineTo(T.largo / 2, 0); forma.lineTo(T.largo / 2, .034); forma.closePath();
  const cuna = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: .034, bevelEnabled: false }), madera);
  cuna.geometry.translate(0, 0, -.017);
  cuna.position.set(T.x, alt(T.x, T.z) - .004, T.z); cuna.rotation.y = -T.angulo;
  cuna.castShadow = cuna.receiveShadow = true; grupo.add(cuna);

  return { ladoCajita, fondoRedondo: yR, fondoCajita: yK };
}

/* ─── asientos ─────────────────────────────────────────────── */
const COLORES_SILLA = [0xc0262d, 0x1f5fa8, 0xf2f2ee, 0x2c8c4a, 0xd96f1e];
function silla(THREE, tipo) {
  const g = new THREE.Group();
  if (tipo === 'plastico') {
    const m = new THREE.MeshStandardMaterial({ color: COLORES_SILLA[Math.floor(Math.random() * COLORES_SILLA.length)], roughness: .45 });
    const asiento = new THREE.Mesh(new THREE.BoxGeometry(.36, .03, .34), m); asiento.position.y = .4;
    const espaldar = new THREE.Mesh(new THREE.BoxGeometry(.36, .36, .03), m); espaldar.position.set(0, .6, -.17); espaldar.rotation.x = -.12;
    g.add(asiento, espaldar);
    for (const [x, z] of [[-.16, -.15], [.16, -.15], [-.16, .15], [.16, .15]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.015, .02, .4, 6), m); p.position.set(x, .2, z); p.rotation.x = z > 0 ? .08 : -.08; g.add(p);
    }
    return { g, alto: .42 };
  }
  if (tipo === 'banquito') {
    const m = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: .8 });
    const asiento = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .04, 16), m); asiento.position.y = .36; g.add(asiento);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, .36, 6), m); p.position.set(Math.cos(a) * .11, .18, Math.sin(a) * .11); g.add(p); }
    return { g, alto: .38 };
  }
  // jaba de colas, con las tapas asomando
  const m = new THREE.MeshStandardMaterial({ color: Math.random() < .5 ? 0xc9302c : 0xe8b020, roughness: .55 });
  const jaba = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .3), m); jaba.position.y = .15; g.add(jaba);
  const tapa = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, metalness: .6, roughness: .4 });
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .015, 8), tapa); t.position.set(-.15 + i * .1, .305, .13); g.add(t); }
  return { g, alto: .31 };
}

/* ─── lo de alrededor ──────────────────────────────────────── */
const caja = (THREE, w, h, d, color, rough = .85) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rough }));
function rotulo(THREE, texto, sub, fondo, tinta) {
  return lienzo(THREE, 1024, 256, (g, w, h) => {
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    g.fillStyle = tinta; g.textAlign = 'center';
    g.font = '800 96px Syne, Inter, system-ui, sans-serif'; g.fillText(texto, w / 2, 125);
    g.font = '600 46px Inter, system-ui, sans-serif'; g.fillText(sub, w / 2, 200);
  }, { repite: false });
}

const ENTORNO = {
  comunidad(THREE, g) {
    // la cerca de caña guadúa, atrás
    const n = 130, caña = new THREE.InstancedMesh(new THREE.CylinderGeometry(.035, .04, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xb79b62, roughness: .8 }), n);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.08 + .84 * i / (n - 1)), r = 4.1, h = 1.3 + Math.random() * .4;
      m.compose(new THREE.Vector3(Math.cos(a) * r, h / 2, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - .5) * .05, 0, (Math.random() - .5) * .05)), new THREE.Vector3(1, h / 1.5, 1));
      caña.setMatrixAt(i, m); caña.setColorAt(i, c.setHSL(.11, .35, .45 + Math.random() * .12));
    }
    caña.castShadow = true; g.add(caña);
    // los pilares y la viga de donde cuelga el foco
    const palo = 0x6b4a2b;
    for (const x of [-2.6, 2.6]) { const p = caja(THREE, .14, 2.9, .14, palo); p.position.set(x, 1.45, -1.2); p.castShadow = true; g.add(p); }
    const viga = caja(THREE, 5.4, .12, .12, palo); viga.position.set(0, 2.85, -1.2); g.add(viga);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .9, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    cable.position.set(0, 2.4, -1.2); g.add(cable);
    const foco = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c2 }));
    foco.position.set(0, 1.93, -1.2); g.add(foco);
    const luz = new THREE.PointLight(0xffd9a0, 6, 7, 1.6); luz.position.copy(foco.position); g.add(luz);
    // las tablas tiradas
    for (const [a, d, largo, giro] of [[2.6, 1.95, 1.1, .1], [.4, 2, .9, -.08], [3.9, 2.15, .8, .05]]) {
      const t = caja(THREE, largo, .03, .09, 0xb4834f); t.position.set(Math.cos(a) * d, .015, Math.sin(a) * d);
      t.rotation.y = -a + Math.PI / 2 + giro; t.castShadow = t.receiveShadow = true; g.add(t);
    }
  },
  patio(THREE, g) {
    // la pared de la casa, encalada, con zócalo azul, puerta y ventana
    const pared = new THREE.Mesh(new THREE.BoxGeometry(10, 2.9, .3), new THREE.MeshStandardMaterial({ roughness: .95,
      map: lienzo(THREE, 1024, 512, (c, w, h) => {
        c.fillStyle = '#efe8d8'; c.fillRect(0, 0, w, h);
        grano(c, w, h, { manchas: 700, tamano: 30, alfa: .05, puntos: 3000, rayas: 12 });
        c.fillStyle = '#2f6db0'; c.fillRect(0, h * .82, w, h * .18);
      }, { repite: false }) }));
    pared.position.set(0, 1.45, -3.6); pared.receiveShadow = true; g.add(pared);
    const puerta = caja(THREE, .95, 2.05, .08, 0x2a5f9e); puerta.position.set(1.7, 1.03, -3.44); g.add(puerta);
    const marco = caja(THREE, 1.25, 1, .1, 0x6b4a2b); marco.position.set(-1.8, 1.55, -3.43); g.add(marco);
    const vidrio = caja(THREE, 1.05, .82, .1, 0x233140, .2); vidrio.position.set(-1.8, 1.55, -3.41); g.add(vidrio);
    const teja = new THREE.Mesh(new THREE.BoxGeometry(10.6, .12, 1.5), new THREE.MeshStandardMaterial({ roughness: .9,
      map: lienzo(THREE, 512, 128, (c, w, h) => { for (let x = 0; x < w; x += 16) { c.fillStyle = x % 32 ? '#a2492b' : '#8c3b22'; c.fillRect(x, 0, 16, h); } }, { repite: false }) }));
    teja.position.set(0, 3.0, -3.05); teja.rotation.x = .38; teja.castShadow = true; g.add(teja);
    // macetas
    for (const x of [-3.6, -.4, 3.4]) {
      const maceta = new THREE.Mesh(new THREE.CylinderGeometry(.18, .13, .3, 12), new THREE.MeshStandardMaterial({ color: 0xa4532e, roughness: .9 }));
      maceta.position.set(x, .15, -3.1); maceta.castShadow = true; g.add(maceta);
      const mata = new THREE.Mesh(new THREE.IcosahedronGeometry(.28, 1), new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: .9, flatShading: true }));
      mata.position.set(x, .45, -3.1); mata.castShadow = true; g.add(mata);
    }
  },
  plaza(THREE, g) {
    // la iglesia, al fondo
    const blanco = 0xeee6d2, ocre = 0xd8b26a;
    const fachada = caja(THREE, 6, 4.2, .6, blanco); fachada.position.set(0, 2.1, -8); g.add(fachada);
    const fronton = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-3, 0), new THREE.Vector2(3, 0), new THREE.Vector2(0, 1.4)]), { depth: .5, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: ocre, roughness: .9 }));
    fronton.position.set(0, 4.2, -8.2); g.add(fronton);
    for (const x of [-3.6, 3.6]) {
      const torre = caja(THREE, 1.2, 6, 1.2, blanco); torre.position.set(x, 3, -8); g.add(torre);
      const cupula = new THREE.Mesh(new THREE.SphereGeometry(.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a7fa8, roughness: .6 }));
      cupula.position.set(x, 6, -8); g.add(cupula);
    }
    const puerta = caja(THREE, 1.4, 2.4, .1, 0x4a2f1c); puerta.position.set(0, 1.2, -7.68); g.add(puerta);
    // postes de luz y banderines entre ellos
    const postes = [[-2.8, -2.2], [2.8, -2.2]];
    for (const [x, z] of postes) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, 2.9, 8), new THREE.MeshStandardMaterial({ color: 0x24332a, roughness: .5, metalness: .4 }));
      p.position.set(x, 1.45, z); p.castShadow = true; g.add(p);
      const farol = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
      farol.position.set(x, 2.95, z); g.add(farol);
    }
    const colores = [0xf3c623, 0x1b5faa, 0xd8392b, 0x2f8f3a, 0xffffff];
    for (let i = 0; i <= 24; i++) {
      const k = i / 24, x = -2.8 + 5.6 * k, y = 2.75 - Math.sin(k * Math.PI) * .55;
      const b = new THREE.Mesh(new THREE.ConeGeometry(.07, .16, 3), new THREE.MeshStandardMaterial({ color: colores[i % colores.length], roughness: .7, side: THREE.DoubleSide }));
      b.position.set(x, y - .1, -2.2); b.rotation.x = Math.PI; b.scale.z = .15; g.add(b);
    }
    // un árbol
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0x5a3c22 }));
    tronco.position.set(-4.2, .76, -3.6); g.add(tronco);
    const copa = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: 0x3e7b3a, flatShading: true, roughness: .9 }));
    copa.position.set(-4.2, 2.2, -3.6); copa.castShadow = true; g.add(copa);
  },
  tienda(THREE, g) {
    // la fachada de la tienda, con la ventana del mostrador abierta
    const pared = caja(THREE, 9, 3, .3, 0xe7c34a); pared.position.set(0, 1.5, -3.5); g.add(pared);
    const zocalo = caja(THREE, 9.02, .6, .32, 0x3b7a52); zocalo.position.set(0, .3, -3.5); g.add(zocalo);
    const hueco = caja(THREE, 2.6, 1.3, .32, 0x241c18); hueco.position.set(-.6, 1.25, -3.49); g.add(hueco);
    const mostrador = caja(THREE, 2.7, .1, .45, 0x6b4a2b); mostrador.position.set(-.6, .62, -3.25); g.add(mostrador);
    // lo que hay en las repisas
    const tonos = [0xd8392b, 0xf3c623, 0x1b5faa, 0x2f8f3a, 0xffffff, 0xe07a2a];
    for (let fila = 0; fila < 3; fila++) {
      const repisa = caja(THREE, 2.5, .03, .25, 0x8a5a33); repisa.position.set(-.6, .8 + fila * .38, -3.42); g.add(repisa);
      for (let i = 0; i < 14; i++) {
        const h = .12 + Math.random() * .14;
        const p = caja(THREE, .1 + Math.random() * .06, h, .12, tonos[Math.floor(Math.random() * tonos.length)], .6);
        p.position.set(-1.75 + i * .165, .815 + fila * .38 + h / 2, -3.42); g.add(p);
      }
    }
    // el rótulo, iluminado por un tubo
    const letrero = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .85), new THREE.MeshBasicMaterial({
      map: rotulo(THREE, 'TIENDA DOÑA ROSITA', 'Víveres · Colas · Pan de dulce', '#fbf6ea', '#b0212b') }));
    letrero.position.set(-.3, 2.38, -3.33); g.add(letrero);
    const tubo = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.6, 8), new THREE.MeshBasicMaterial({ color: 0xf2fbff }));
    tubo.rotation.z = Math.PI / 2; tubo.position.set(-.3, 2.95, -3.25); g.add(tubo);
    const luz = new THREE.PointLight(0xe8f4ff, 5, 7, 1.4); luz.position.set(-.3, 2.7, -2.8); g.add(luz);
    // jabas de colas apiladas al lado
    for (let i = 0; i < 5; i++) {
      const j = caja(THREE, .42, .3, .32, i % 2 ? 0xc9302c : 0xe8b020, .55);
      j.position.set(2.6 + (i % 2) * .45, .15 + Math.floor(i / 2) * .31, -3.0); j.castShadow = true; g.add(j);
    }
  },
};

/* Lo propio de cada escenario. `alto` es cuánto sobresale la tina del
   piso (0: está hundida en la tierra). */
const DATOS = {
  comunidad: { tina: 'cemento', piso: 'tierra', alto: 0, asiento: 'suelo', cielo: 0x141826, noche: true,
    sol: [0xffd9a0, 1.4, [-.6, 4, .4]], hemi: [0x8ea0c8, 0x4a3628, .55], radioGente: 1.48, radioMonedas: 1.22, yMonedas: 0, repPiso: 7 },
  patio: { tina: 'concreto', piso: 'losa', alto: .32, asiento: 'plastico', cielo: 0xcbd9e6, rugosa: .85,
    sol: [0xffdcaa, 2.5, [-3, 3.4, 2.2]], hemi: [0xdbe8ff, 0x8a6a4a, .8], radioGente: 1.5, radioMonedas: 1.045, yMonedas: .026, repPiso: 10 },
  plaza: { tina: 'carita', piso: 'adoquin', alto: .16, asiento: 'banquito', cielo: 0xbcd3ea, rugosa: .45, pozo: 0x3a3a3a, bordeClaro: 1,
    sol: [0xfff4e0, 2.7, [2, 5, 1.6]], hemi: [0xe6f0ff, 0x7a6a58, .85], radioGente: 1.48, radioMonedas: 1.045, yMonedas: .026, repPiso: 8 },
  tienda: { tina: 'batea', piso: 'baldosa', alto: .28, asiento: 'jaba', cielo: 0x2a2340, rugosa: .7, materialBorde: 0x7a4f2c,
    sol: [0xffc890, 1.3, [1.5, 4, 2]], hemi: [0x9aa8d0, 0x4a3a30, .6], radioGente: 1.5, radioMonedas: 1.045, yMonedas: .026, repPiso: 14 },
};

export function construir(THREE, CFG, alt, clave) {
  const e = DATOS[clave] || DATOS.comunidad;
  const grupo = new THREE.Group();
  const info = tina(THREE, CFG, alt, e, grupo);

  // el piso
  const pisoY = -(e.alto || 0);
  const texPiso = TEXTURAS[e.piso](THREE); texPiso.repeat.set(e.repPiso, e.repPiso);
  // con un hueco donde va la tina: si no, el piso le pasa por encima al fondo
  const piso = new THREE.Mesh(new THREE.RingGeometry(e.alto ? 1.08 : 1.5, 15, 96, 1), new THREE.MeshStandardMaterial({ map: texPiso, roughness: .95 }));
  piso.rotation.x = -Math.PI / 2; piso.position.y = pisoY - .003; piso.receiveShadow = true;
  grupo.add(piso);

  // la luz
  grupo.add(new THREE.HemisphereLight(...e.hemi));
  const sol = new THREE.DirectionalLight(e.sol[0], e.sol[1]);
  sol.position.set(...e.sol[2]); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: .3, far: 12 });
  sol.shadow.bias = -0.0005;
  grupo.add(sol, sol.target);

  // lo de alrededor, corrido al nivel del piso
  const entorno = new THREE.Group(); entorno.position.y = pisoY;
  ENTORNO[clave](THREE, entorno);
  grupo.add(entorno);

  return {
    grupo, clave, ...info,
    cielo: new THREE.Color(e.cielo), noche: !!e.noche,
    pisoY, radioGente: e.radioGente, radioMonedas: e.radioMonedas, yMonedas: e.yMonedas,
    pose: e.asiento === 'suelo' ? 'suelo' : 'silla',
    /* Pone un asiento en el piso, mirando a la tina, y dice qué tan alto es. */
    asiento(angulo, radio) {
      if (e.asiento === 'suelo') return 0;
      const { g, alto } = silla(THREE, e.asiento);
      g.position.set(Math.cos(angulo) * radio, pisoY, Math.sin(angulo) * radio);
      g.lookAt(0, pisoY, 0);
      g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      grupo.add(g);
      return alto;
    },
    quitar(escena) {
      escena.remove(grupo);
      grupo.traverse(m => {
        if (m.geometry) m.geometry.dispose();
        for (const mat of [].concat(m.material || [])) { if (mat.map) mat.map.dispose(); mat.dispose(); }
      });
    },
  };
}
