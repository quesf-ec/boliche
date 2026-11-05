/* La gente del boliche: muñequitos de plastilina, cabezones, como de
   película de stop-motion hecha en la mesa de la cocina. Cada pieza es
   una bolita o un chorizo de arcilla "pegado" encima de otro, con sus
   bultitos y huellas de dedo, y por dentro tienen esqueleto: cadera,
   torso, cabeza, brazos con codo y piernas con rodilla. Así pueden mirar
   la canica que va adelante, inclinarse cuando una está por caer, gritar
   con el brazo arriba, celebrar, agarrarse la cabeza y lanzar.

   Cada figura se arma con `new Persona(THREE, aspecto)` y se anima con
   `persona.actualizar(t, dt)` en cada cuadro. Mira hacia +z: quien la
   pone en la escena la gira hacia la tina con `lookAt`.

   Las geometrías y los materiales se guardan en cachés: las seis figuras
   comparten las piezas iguales, y al cambiar de escenario no se arma
   nada nuevo que no haga falta. */

const PIELES = [0xc08a5e, 0xa8744c, 0xcf9a6e, 0x91603e, 0xb78057];
const PELOS = [0x2a1a12, 0x33221a, 0x3d2a1e, 0x241812];

/* ─── la arcilla ───────────────────────────────────────────── */

// un azar con semilla: las mismas huellas cada vez que se arma la pieza
function azar(semilla) {
  let a = 0;
  for (const ch of String(semilla)) a = (a * 31 + ch.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clave = (x, y, z) => `${Math.round(x * 2e4)},${Math.round(y * 2e4)},${Math.round(z * 2e4)}`;

/* Amasa una pieza: la empuja un poquito hacia afuera y hacia adentro con
   un ruido suave (los bultitos de la mano) y le hunde unas huellas de
   dedo. Se hace una sola vez, al armarla. Los vértices repetidos de las
   costuras se mueven juntos, para que la pieza no se raje. */
function amasar(g, amp, semilla, huellas = 3) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const r = azar(semilla);
  g.computeBoundingSphere();
  const R = g.boundingSphere.radius || 1, c = g.boundingSphere.center;
  // la normal promediada de cada punto (las costuras tienen dos)
  const normales = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = clave(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = normales.get(k) || [0, 0, 0];
    n[0] += nor.getX(i); n[1] += nor.getY(i); n[2] += nor.getZ(i);
    normales.set(k, n);
  }
  const f = [r() * 6, r() * 6, r() * 6, r() * 6, r() * 6];
  const hs = [];
  for (let j = 0; j < huellas; j++) {
    const i = Math.floor(r() * pos.count);
    hs.push([pos.getX(i), pos.getY(i), pos.getZ(i), R * (.28 + r() * .2), amp * (1.6 + r())]);
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = normales.get(clave(x, y, z));
    const ln = Math.hypot(n[0], n[1], n[2]) || 1;
    const qx = (x - c.x) / R * 2.2, qy = (y - c.y) / R * 2.2, qz = (z - c.z) / R * 2.2;
    let d = amp * (Math.sin(qx * 1.7 + f[0]) * Math.sin(qy * 2.1 + f[1]) * Math.sin(qz * 1.9 + f[2])
      + .45 * Math.sin(qx * 3.7 + qy * 2.3 + f[3]) * Math.sin(qz * 3.1 - qy * 1.3 + f[4]));
    for (const [hx, hy, hz, hr, hd] of hs) {
      const e = Math.hypot(x - hx, y - hy, z - hz) / hr;
      if (e < 1) d -= hd * (1 - e * e) * (1 - e * e);
    }
    pos.setXYZ(i, x + n[0] / ln * d, y + n[1] / ln * d, z + n[2] / ln * d);
  }
  g.computeVertexNormals();
  soldar(g);
  return g;
}

/* Las costuras de las esferas tienen vértices repetidos: les damos la
   misma normal para que la luz no dibuje una raya. */
function soldar(g) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const suma = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = clave(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = suma.get(k) || [0, 0, 0];
    n[0] += nor.getX(i); n[1] += nor.getY(i); n[2] += nor.getZ(i);
    suma.set(k, n);
  }
  for (let i = 0; i < pos.count; i++) {
    const n = suma.get(clave(pos.getX(i), pos.getY(i), pos.getZ(i)));
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    nor.setXYZ(i, n[0] / l, n[1] / l, n[2] / l);
  }
  nor.needsUpdate = true;
}

/* Junta varias piezas del mismo color en una sola malla: menos mallas,
   menos trabajo para el teléfono. */
function unir(THREE, partes) {
  let nv = 0, ni = 0;
  for (const g of partes) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let ov = 0, oi = 0;
  for (const g of partes) {
    pos.set(g.attributes.position.array, ov * 3);
    nor.set(g.attributes.normal.array, ov * 3);
    uv.set(g.attributes.uv.array, ov * 2);
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) idx[oi + i] = ix[i] + ov;
    ov += g.attributes.position.count; oi += ix.length;
    g.dispose();
  }
  const u = new THREE.BufferGeometry();
  u.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  u.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  u.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  u.setIndex(new THREE.BufferAttribute(idx, 1));
  u.computeBoundingSphere();
  return u;
}

// mueve, gira y estira una geometría (una copia, la original no se toca)
function poner(THREE, g, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = [], [sx = 1, sy = 1, sz = 1] = []) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return g.applyMatrix4(m);
}

/* La forma del cuerpo: un frijol más ancho abajo, como campana. Se usa
   para el cuerpo y para que el poncho, la chalina y la faja calcen
   justito encima sin atravesarlo. Medidas en el sistema del torso. */
const CUERPO = { abajo: -.05, arriba: .29, rAbajo: .158, rArriba: .1, hondo: .86 };
function perfilCuerpo(a) {               // a de -π/2 (abajo) a π/2 (arriba)
  const { abajo, arriba, rAbajo, rArriba } = CUERPO;
  const sa = Math.sin(a);
  const R = rArriba + (rAbajo - rArriba) * (1 - sa) / 2;
  return [Math.pow(Math.max(0, Math.cos(a)), .7) * R, (abajo + arriba) / 2 + sa * (arriba - abajo) / 2];
}
function radioCuerpo(y) {
  // busca el radio a esa altura recorriendo el perfil
  let mejor = 0, dist = 1;
  for (let i = 0; i <= 60; i++) {
    const [r, yy] = perfilCuerpo(-Math.PI / 2 + Math.PI * i / 60);
    if (Math.abs(yy - y) < dist) { dist = Math.abs(yy - y); mejor = r; }
  }
  return mejor;
}

/* Los cachés: una geometría por forma y un material por color. */
const GEO = new Map(), MAT = new Map();
let HUELLAS = null;

/* La textura de las huellas: un mapa de normales chiquito (128 px) con
   yemas de dedo (hoyitos ovalados) y rayitas de alisar, compartido por
   todos. Se dibuja una sola vez con un azar sembrado. Va con poco relieve:
   de cerca se ve la mano; de lejos no ensucia ni deja dibujitos repetidos. */
function huellas(THREE) {
  if (HUELLAS !== null) return HUELLAS;
  try {
    const N = 128, alto = new Float32Array(N * N), r = azar('huellas');
    const sumar = (cx, cy, rx, ry, ang, h, anillos) => {
      const c = Math.cos(ang), s = Math.sin(ang), R = Math.ceil(Math.max(rx, ry)) + 1;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry, d = Math.hypot(u, v);
        if (d >= 1) continue;
        let k = (1 - d * d) * (1 - d * d);
        if (anillos) k *= .75 + .25 * Math.cos(d * anillos);   // la yema deja anillitos
        const x = ((Math.round(cx) + dx) % N + N) % N, y = ((Math.round(cy) + dy) % N + N) % N;
        alto[y * N + x] += h * k;
      }
    };
    for (let i = 0; i < 24; i++) sumar(r() * N, r() * N, 7 + r() * 9, 5 + r() * 6, r() * 3, -(.5 + r() * .6), 12);
    for (let i = 0; i < 36; i++) sumar(r() * N, r() * N, 9 + r() * 14, 1.2 + r(), r() * 6, (r() - .5) * .45, 0);
    for (let i = 0; i < 160; i++) sumar(r() * N, r() * N, 1.5 + r() * 2, 1.5 + r() * 2, 0, (r() - .5) * .35, 0);
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    const h = (x, y) => alto[((y + N) % N) * N + ((x + N) % N)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const nx = (h(x - 1, y) - h(x + 1, y)) * 1.2, ny = (h(x, y - 1) - h(x, y + 1)) * 1.2, l = Math.hypot(nx, ny, 1);
      const i = (y * N + x) * 4;
      img.data[i] = (nx / l * .5 + .5) * 255; img.data[i + 1] = (ny / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
    HUELLAS = t;
  } catch (e) { HUELLAS = undefined; }   // sin documento: la arcilla sale lisa
  return HUELLAS;
}

/* La plastilina: mate, sin metal, con un poquito de luz propia de su
   mismo color para que en la sombra no se vuelva barro. `relieve` es
   cuánto se notan las huellas: menos en la piel, que se ve más lisa. */
function arcilla(THREE, color, { brillo = 0, emi = .07, liso = false, relieve = .4, doble = false, mapa = null } = {}) {
  const k = `${color}|${brillo}|${emi}|${liso}|${relieve}|${doble}|${mapa ? mapa.uuid : ''}`;
  let m = MAT.get(k);
  if (!m) {
    const tex = liso ? null : huellas(THREE);
    m = new THREE.MeshStandardMaterial({
      color, roughness: brillo ? .35 : .9, metalness: 0,
      emissive: color, emissiveIntensity: emi,
    });
    if (tex) { m.normalMap = tex; m.normalScale = new THREE.Vector2(relieve, relieve); }
    // lo pintado (rayas, bordados, cuentas) también brilla un poquito en la sombra
    if (mapa) { m.map = mapa; m.emissiveMap = mapa; }
    if (doble) m.side = THREE.DoubleSide;
    MAT.set(k, m);
  }
  return m;
}

/* ─── los tejidos ──────────────────────────────────────────── */

/* Las rayas del poncho, la faja, el bordado de la blusa, las cuentas de
   las gualcas: dibujitos pintados encima de la arcilla, como hace uno
   con un palillo y témpera. Cada uno es un canvas chiquito que se pinta
   una sola vez y se comparte; el color ya va pintado en él. Sin
   documento (o si algo falla), la pieza sale lisa de su color. */
const TEX = new Map();
const css = (THREE, h) => '#' + new THREE.Color(h).getHexString();
function tejido(THREE, k, w, h, pinta, [ru, rv] = [1, 1]) {
  if (TEX.has(k)) return TEX.get(k);
  let t;
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    pinta(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(ru, rv);
    t.anisotropy = 4;
  } catch (e) { t = undefined; }
  TEX.set(k, t);
  return t;
}
// arcilla pintada: con el tejido si hay, y si no, lisa del color de fondo
const pintada = (THREE, fondo, mapa, op = {}) => mapa ? arcilla(THREE, 0xffffff, { ...op, mapa }) : arcilla(THREE, fondo, op);

// un rombo relleno, centrado en (x, y)
function rombo(g, x, y, rx, ry, c) {
  g.fillStyle = c; g.beginPath();
  g.moveTo(x, y - ry); g.lineTo(x + rx, y); g.lineTo(x, y + ry); g.lineTo(x - rx, y); g.closePath(); g.fill();
}
// una florcita bordada: cinco pétalos y el botón al medio
function flor(g, x, y, r, c, boton) {
  g.fillStyle = c;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .72, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = boton; g.beginPath(); g.arc(x, y, r * .55, 0, Math.PI * 2); g.fill();
}

/* El perfil del poncho (radio, altura) del cuello al filo. Con él se
   arma la lámina y se sabe a qué altura del dibujo cae cada raya. */
const PONCHO = [[.07, .287], [.1, .276], [.142, .253], [.174, .22], [.194, .176], [.206, .128], [.212, .084], [.214, .052]];
function vPoncho(y) {
  for (let j = 0; j < PONCHO.length - 1; j++) {
    const a = PONCHO[j][1], b = PONCHO[j + 1][1];
    if (y <= a && y >= b) return (j + (a - y) / (a - b)) / (PONCHO.length - 1);
  }
  return y > PONCHO[0][1] ? 0 : 1;
}

/* El poncho tejido: la guarda de franjas finas paralelas al filo, como
   sale del telar. 'listas' (el de Don Segundo): el paño listado de arriba
   abajo con hilos oscuros y una guarda de cinco franjas. 'rombos' (el de
   Don Lucho): el paño liso y una guarda de rombitos entre dos hilos. */
function ponchoTex(THREE, base, franja, guarda) {
  return tejido(THREE, `poncho|${base}|${franja}|${guarda}`, 256, 256, (g, W, H) => {
    const cb = css(THREE, base), cf = css(THREE, franja), osc = css(THREE, tono(THREE, base, -.4)), hueso = '#eee2c6';
    const Y = y => (1 - vPoncho(y)) * H;   // la altura en el poncho → la fila del canvas
    const raya = (y0, y1, c) => { g.fillStyle = c; g.fillRect(0, Y(y0), W, Math.max(1.5, Y(y1) - Y(y0))); };
    g.fillStyle = cb; g.fillRect(0, 0, W, H);
    if (guarda === 'listas') {
      // las listas del paño: un hilo oscuro y uno de color, de arriba abajo
      for (let i = 0; i < 24; i++) {
        const x = i * W / 24;
        g.fillStyle = osc; g.globalAlpha = .5; g.fillRect(x, 0, 2.5, H);
        g.fillStyle = cf; g.globalAlpha = .35; g.fillRect(x + W / 48, 0, 1.2, H);
      }
      g.globalAlpha = 1;
      g.fillStyle = cb; g.fillRect(0, 0, W, Y(.124));
      raya(.068, .077, cf); raya(.081, .085, hueso); raya(.089, .101, cf); raya(.105, .109, hueso); raya(.113, .121, cf);
    } else {
      // el paño: un hilo apenitas más oscuro, que se note tejido
      g.fillStyle = osc; g.globalAlpha = .18;
      for (let i = 0; i < 60; i++) g.fillRect(i * W / 60, 0, 1.2, H);
      g.globalAlpha = 1;
      g.fillStyle = cb; g.fillRect(0, 0, W, Y(.124));
      raya(.066, .071, hueso); raya(.115, .12, hueso);
      raya(.074, .077, cf); raya(.108, .111, cf);
      const yc = (Y(.08) + Y(.105)) / 2, ry = (Y(.105) - Y(.08)) / 2, n = 20;
      for (let i = 0; i <= n; i++) {
        const x = i * W / n;
        rombo(g, x, yc, W / n * .42, ry, cf);
        rombo(g, x, yc, W / n * .17, ry * .4, cb);
        g.fillStyle = hueso; g.fillRect(x + W / n * .5 - 1.5, yc - 1.5, 3, 3);
      }
    }
  });
}

/* La faja (chumbi) que amarra el anaco: roja, con sus hilos claros en los
   filos y una fila de rombitos de colores. */
function fajaTex(THREE, base) {
  return tejido(THREE, `faja|${base}`, 64, 32, (g, W, H) => {
    g.fillStyle = css(THREE, base); g.fillRect(0, 0, W, H);
    g.fillStyle = '#efe2c4'; g.fillRect(0, H * .1, W, H * .1); g.fillRect(0, H * .8, W, H * .1);
    g.fillStyle = '#e0b04a'; g.fillRect(0, H * .24, W, H * .05); g.fillRect(0, H * .71, W, H * .05);
    const cs = ['#e8c45a', '#7c9a52', '#efe2c4', '#4f7088'];
    for (let i = 0; i <= 4; i++) {
      rombo(g, i * W / 4, H / 2, W / 8 * .8, H * .17, cs[i % 4]);
      g.fillStyle = css(THREE, base); g.fillRect(i * W / 4 - 1, H / 2 - 1, 2, 2);
    }
  }, [8, 1]);
}

/* La blusa bordada: una fila de florcitas en la manga, entre dos líneas. */
function blusaTex(THREE, base, colores) {
  return tejido(THREE, `blusa|${base}|${colores}`, 64, 64, (g, W, H) => {
    g.fillStyle = css(THREE, base); g.fillRect(0, 0, W, H);
    const c = colores.map(x => css(THREE, x));
    g.fillStyle = c[0]; g.fillRect(0, H * .3, W, 2.5); g.fillRect(0, H * .7 - 2.5, W, 2.5);
    for (let i = 0; i < 2; i++) {
      flor(g, W * (.25 + i * .5), H * .5, 5, c[(i + 1) % c.length], '#e8b84a');
      g.fillStyle = '#6f8a4a';
      for (const l of [-1, 1]) { g.beginPath(); g.ellipse(W * (.5 + i * .5) + l * 4, H * .5 + l * 3, 4, 2, l * .6, 0, Math.PI * 2); g.fill(); }
    }
  }, [2, 1]);
}

/* La chompa de lana del Pato: el punto de lana y una banda con dibujo de
   rombos y dientes, como las de las ferias. Va en el frijol del cuerpo
   (las filas siguen su perfil) y en las mangas, con la banda en el puño. */
const vCuerpo = y => (Math.asin(Math.max(-1, Math.min(1, (y - (CUERPO.abajo + CUERPO.arriba) / 2) / ((CUERPO.arriba - CUERPO.abajo) / 2)))) + Math.PI / 2) / Math.PI;
function chompaTex(THREE, base, banda, dibujo, manga) {
  return tejido(THREE, `chompa|${base}|${banda}|${dibujo}|${manga}`, 128, 128, (g, W, H) => {
    g.fillStyle = css(THREE, base); g.fillRect(0, 0, W, H);
    // el punto: hilitos verticales un poco más oscuros
    g.fillStyle = css(THREE, tono(THREE, base, -.3)); g.globalAlpha = .22;
    for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1.3, H);
    g.globalAlpha = 1;
    const [y0, y1] = manga ? [H * .7, H * .86] : [(1 - vCuerpo(.235)) * H, (1 - vCuerpo(.165)) * H];
    const cb = css(THREE, banda), cd = css(THREE, dibujo), n = manga ? 6 : 12;
    g.fillStyle = cb; g.fillRect(0, y0, W, y1 - y0);
    g.fillStyle = cd; g.fillRect(0, y0 + 1, W, 2); g.fillRect(0, y1 - 3, W, 2);
    for (let i = 0; i <= n; i++) {
      const x = i * W / n, ym = (y0 + y1) / 2;
      rombo(g, x, ym, W / n * .3, (y1 - y0) * .26, cd);
      rombo(g, x, ym, W / n * .1, (y1 - y0) * .09, cb);
      // los dientes de arriba y abajo
      g.fillStyle = cd;
      for (const [yb, s] of [[y0 + 3, 1], [y1 - 3, -1]]) { g.beginPath(); g.moveTo(x + W / n * .3, yb); g.lineTo(x + W / n * .5, yb + s * (y1 - y0) * .16); g.lineTo(x + W / n * .7, yb); g.fill(); }
    }
  });
}

/* Una cuenta de mullo: gris de luz al medio y oscura en las juntas; el
   color lo pone el material. Se repite a lo largo de la sarta. */
function cuentasTex(THREE) {
  return tejido(THREE, 'cuentas', 32, 16, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = Math.sin(Math.PI * (x + .5) / W), v = (y + .5) / H;
      const b = Math.min(1, .3 + .7 * Math.pow(s, .45) + .5 * s * Math.exp(-((v - .3) ** 2) / .012));
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [34, 1]);
}

/* La planta de cabuya de la alpargata: la soga enrollada en espiral, que
   en la media esfera de abajo sale como anillos alrededor del centro. */
function plantaTex(THREE) {
  return tejido(THREE, 'planta', 16, 64, (g, W, H) => {
    g.fillStyle = '#d2bb92'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b49870';
    for (let i = 0; i < 6; i++) g.fillRect(0, H * (.52 + i * .08), W, 1.6);
    g.fillStyle = '#8a6a48'; g.fillRect(0, H * .44, W, 2.5);   // la costura con el empeine
  });
}

/* La gorra del Kevin: seis gajos con su costura, el frente de otro color
   con un parchecito, y el pespunte del filo. El frente mira a +z (u = ¼). */
function gorraTex(THREE, base, panel) {
  return tejido(THREE, `gorra|${base}|${panel}`, 128, 64, (g, W, H) => {
    g.fillStyle = css(THREE, base); g.fillRect(0, 0, W, H);
    g.fillStyle = css(THREE, panel); g.fillRect(W * (.25 - .12), H * .12, W * .24, H);
    g.fillStyle = css(THREE, tono(THREE, base, -.4));
    for (let i = 0; i < 6; i++) { const x = W * (.25 + .12 + i / 6) % W; g.fillRect(x - 1, 0, 2, H); }
    g.fillRect(0, H * .86, W, 2.5);
    flor(g, W * .25, H * .55, 4, css(THREE, base), '#e0b04a');
  });
}

/* El gorrito de lana: franjas, una fila de rombitos y el punto. */
function gorroTex(THREE, base, raya) {
  return tejido(THREE, `gorro|${base}|${raya}`, 128, 64, (g, W, H) => {
    const cb = css(THREE, base), cr = css(THREE, raya);
    g.fillStyle = cb; g.fillRect(0, 0, W, H);
    g.fillStyle = cr; g.fillRect(0, H * .3, W, H * .07); g.fillRect(0, H * .78, W, H * .07);
    for (let i = 0; i <= 10; i++) rombo(g, i * W / 10, H * .57, W / 10 * .32, H * .1, cr);
    g.fillStyle = css(THREE, tono(THREE, base, -.35)); g.globalAlpha = .25;
    for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1.3, H);
    g.globalAlpha = 1;
  });
}

/* Aclara (k > 0, hacia el hueso) u oscurece (k < 0) un color sin perder lo ocre. */
function tono(THREE, hex, k) {
  const c = new THREE.Color(hex);
  if (k > 0) c.lerp(new THREE.Color(0xfff1d8), k); else c.multiplyScalar(1 + k);
  return c.getHex();
}

/* El poncho cuadrado puesto cae en punta adelante y atrás, y los lados
   quedan más arriba (sobre los brazos). Baja los vértices según hacia
   dónde miran; `peso(y)` dice cuánto se mueve cada altura. */
function enPunta(g, cuanto, peso) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const c = -Math.cos(2 * Math.atan2(z, x)), w = peso(y);
    p.setY(i, y - cuanto * w * (Math.max(0, c) * Math.abs(c) - .3 * Math.max(0, -c)));
  }
  g.computeVertexNormals();
  return g;
}

/* ─── la figura ────────────────────────────────────────────── */

export class Persona {
  constructor(THREE, a = {}) {
    this.T = THREE;
    const s = a.escala || 1;
    this.pose = a.pose || 'suelo';          // 'suelo' (sentado en el piso) | 'silla'
    const silla = this.pose === 'silla';
    const anaco = !!a.anaco;

    // los colores
    const cPiel = a.piel ?? PIELES[Math.floor(Math.random() * PIELES.length)];
    const cPelo = a.pelo ?? PELOS[Math.floor(Math.random() * PELOS.length)];
    const piel = arcilla(THREE, cPiel, { emi: .13, relieve: .2 });
    const pelo = arcilla(THREE, cPelo, { emi: .05 });
    const cRopa = a.ropa ?? 0xb5652f, ropa = arcilla(THREE, cRopa);
    const pantalon = arcilla(THREE, a.pantalon ?? (anaco ? a.anaco : 0x4e3a2c));
    const zapato = arcilla(THREE, 0x5a3a28, { emi: .06 });
    const negro = arcilla(THREE, 0x1c120e, { brillo: 1, emi: 0, liso: true });
    const bocaM = arcilla(THREE, 0x4a1e18, { emi: .05, liso: true });
    const brilloM = MAT.get('brillo') || new THREE.MeshBasicMaterial({ color: 0xfff8ec });
    MAT.set('brillo', brilloM);
    const rubor = arcilla(THREE, 0xd9806a, { emi: .12 });

    // piezas cacheadas: cada forma se amasa una sola vez para todos
    const pieza = (k, hacer) => { let g = GEO.get(k); if (!g) { g = hacer(); GEO.set(k, g); } return g; };
    const bola = (k, r, w = 12, h = 9, amp = .04) => pieza('bola' + k + r + w + h + amp,
      () => amasar(new THREE.SphereGeometry(r, w, h), r * amp, k + r));
    const chorizo = (k, r, l, amp = .05, rad = 7) => pieza('chorizo' + k + r + l + rad,
      () => amasar(new THREE.CapsuleGeometry(r, l, 2, rad), r * amp, k + r + l));
    const malla = (g, m, padre, [x = 0, y = 0, z = 0] = []) => {
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; padre.add(o); return o;
    };
    const grupo = (padre, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); padre.add(g); return g; };

    this.grupo = new THREE.Group();
    // todo se arma a escala 1 dentro de este grupo, y el grupo se estira:
    // así Don Segundo, más grande, usa las mismas piezas que los demás
    const muñeco = grupo(this.grupo);
    muñeco.scale.setScalar(s);
    this.s = s;
    // la cadera va a la altura del asiento: en el piso o encima de la silla.
    // Un centímetro más arriba, porque la arcilla amasada (y aplastada al
    // rebotar) se hunde un poco y si no el poto atraviesa el asiento
    this.alturaCadera = silla ? (a.asiento ?? .42) + .01 : .012;
    // en la silla se sienta adelante, en el filo: las canillas cuelgan por
    // delante del asiento y la espalda (y el poncho) no toca el espaldar
    const cadera = this.cadera = grupo(muñeco, 0, this.alturaCadera / s, silla ? .1 : 0);

    /* Piernas: chorizos gorditos. En el piso, estiradas adelante con las
       puntas para arriba; en la silla, colgando del filo. */
    this.piernas = [];
    const gMuslo = chorizo('muslo', .056, .05), gCanilla = chorizo('canilla', .05, .035);
    const gPie = pieza('pie', () => amasar(poner(THREE, new THREE.SphereGeometry(.046, 10, 7), [0, 0, .024], [], [1, .8, 1.3]), .003, 'pie'));
    /* Alpargatas: el empeine de tela (el mismo pie, del color de la tela) y
       la planta de cabuya, una suela clarita y gruesa que asoma alrededor.
       Sentados en el piso, con las puntas para arriba, es lo que se ve. */
    const gPlanta = pieza('planta', () => amasar(poner(THREE, new THREE.SphereGeometry(.046, 10, 4), [0, -.021, .024], [], [1.07, .34, 1.36]), .0015, 'planta', 1));
    const empeine = a.alpargatas ? arcilla(THREE, a.alpargatas) : zapato;
    const planta = pintada(THREE, 0xcdb48a, plantaTex(THREE), { emi: .1 });
    for (const lado of [-1, 1]) {
      const muslo = grupo(cadera, lado * .074, .056, .02);
      muslo.rotation.order = 'YXZ';
      if (!anaco) malla(gMuslo, pantalon, muslo, [0, -.05, 0]);   // con anaco, la falda tapa el muslo
      const rodilla = grupo(muslo, 0, -.105, 0);
      malla(gCanilla, pantalon, rodilla, [0, -.045, 0]);
      const pie = malla(gPie, empeine, rodilla, [0, -.1, .0]);
      if (a.alpargatas) malla(gPlanta, planta, pie);
      this.piernas.push({ muslo, rodilla, pie, lado });
    }
    this.sentar();

    /* Torso: el frijol. Se inclina desde la cadera. */
    const torso = this.torso = grupo(cadera, 0, .05, 0);
    const pivote = this.pivote = grupo(torso);        // aquí rebota la arcilla (squash & stretch)
    // con anaco y chalina el cuerpo casi no se ve: va con menos gajos
    const filas = anaco ? 8 : 12;
    const gCuerpo = pieza('cuerpo' + filas, () => {
      const pts = [];
      for (let i = 0; i <= filas; i++) { const [r, y] = perfilCuerpo(-Math.PI / 2 + Math.PI * i / filas); pts.push(new THREE.Vector2(r, y)); }
      return amasar(poner(THREE, new THREE.LatheGeometry(pts, anaco ? 12 : 16), [], [], [1, 1, CUERPO.hondo]), .008, 'cuerpo', 5);
    });
    // la chompa de lana lleva su banda con dibujo
    const chompa = a.chompa ? [a.chompa[0] ?? 0x7a3a2a, a.chompa[1] ?? 0xeee2c6] : null;
    this.cuerpo = malla(gCuerpo, chompa ? pintada(THREE, cRopa, chompaTex(THREE, cRopa, ...chompa, false)) : ropa, pivote);

    /* Una lámina de arcilla encima del cuerpo: el poncho y la chalina.
       Calza en el frijol (lo sigue a una distancia) y se abre abajo. */
    const lamina = (k, yArriba, yAbajo, abre, grueso, n = 6) => pieza(k, () => {
      const pts = [];
      const radio = (y, t) => radioCuerpo(y) + .012 + abre * t * t;
      for (let i = 0; i <= n; i++) {            // por dentro, de arriba abajo
        const t = i / n, y = yArriba + (yAbajo - yArriba) * t;
        pts.push(new THREE.Vector2(radio(y, t), y));
      }
      // el filo, redondeado como cuando aplastas la masa con el dedo
      const rb = radio(yAbajo, 1);
      pts.push(new THREE.Vector2(rb + grueso * .5, yAbajo - grueso * .45));
      for (let i = n; i >= 0; i--) {            // por fuera, de abajo arriba
        const t = i / n, y = yArriba + (yAbajo - yArriba) * t;
        pts.push(new THREE.Vector2(radio(y, t) + grueso * (1 - .3 * (1 - t)), y + grueso * .3));
      }
      pts.push(new THREE.Vector2(radioCuerpo(yArriba) + .01, yArriba + grueso * .9));
      return amasar(poner(THREE, new THREE.LatheGeometry(pts, 16), [], [], [1, 1, CUERPO.hondo + .03]), .005, k, 4);
    });
    this.conPoncho = !!a.poncho;
    if (a.poncho) {
      /* El poncho: una lámina de arcilla que cae del cuello por encima de
         los hombros y se abre como capa, con el borde enrollado. Lleva
         pintada su guarda de franjas finas (ver ponchoTex). Más ancho que
         el cuerpo, para que desde arriba se lea poncho y no chompa. En el
         piso cae en punta adelante y atrás; en la silla no, que se
         montaría en los muslos. */
      const franja = a.franja ?? 0xd09a45;
      const mp = pintada(THREE, a.poncho, ponchoTex(THREE, a.poncho, franja, a.guarda || 'rombos'), { doble: true });
      const cae = silla ? 0 : .035, hondo = .93;
      const peso = y => Math.min(1, Math.max(0, (.2 - y) / .13));
      const gPoncho = pieza('poncho' + cae, () => {
        const g = poner(THREE, new THREE.LatheGeometry(PONCHO.map(([r, y]) => new THREE.Vector2(r, y)), 22), [], [], [1, 1, hondo]);
        return amasar(cae ? enPunta(g, cae, peso) : g, .004, 'poncho', 4);
      });
      malla(gPoncho, mp, pivote);
      // el borde enrollado, tejido aparte como un cordoncito de otro color,
      // que cae igual que la lámina
      const gBorde = pieza('bordeP' + cae, () => {
        const g = poner(THREE, new THREE.TorusGeometry(.215, .014, 5, 30), [0, .05, 0], [Math.PI / 2, 0, 0], [1, hondo, 1]);
        return amasar(cae ? enPunta(g, cae, peso) : g, .0015, 'bordeP', 2);
      });
      malla(gBorde, arcilla(THREE, a.borde ?? tono(THREE, a.poncho, -.35)), pivote);
    }
    if (a.chalina) {
      const mc = arcilla(THREE, a.chalina);
      malla(lamina('chalina', .27, .14, .03, .02, 3), mc, pivote);
      // el nudo adelante, una bolita aplastada
      const nudo = malla(pieza('nudo', () => amasar(new THREE.SphereGeometry(.032, 8, 6), .003, 'nudo', 1)), mc, pivote, [0, a.collar ? .172 : .19, .118]);
      nudo.scale.set(1.25, .9, .7);
    }
    if (a.collar) {
      /* Las gualcas: varias vueltas de mullos (cuentas doradas, y una de
         coral) que caen en U encima de la chalina, más bajas adelante. Cada
         vuelta es un chorizo finito con las cuentas pintadas (cuentasTex);
         las del mismo color van en una sola malla. Siguen la forma de la
         chalina por fuera para no atravesarla. */
      const colores = Array.isArray(a.collar) ? a.collar : [a.collar, a.collar, 0xb4432e];
      const fuera = y => {                    // el radio de la chalina por fuera, a esa altura
        const t = Math.min(1, Math.max(0, (.27 - y) / .13));
        return radioCuerpo(y) + .012 + .03 * t * t + .02 * (1 - .3 * (1 - t)) + .007;
      };
      const vuelta = i => {
        const yAtras = .262 - i * .006, yAdelante = .238 - i * .02, rc = .0085, pts = [];
        for (let k = 0; k < 16; k++) {
          const f = k / 16 * Math.PI * 2, adelante = Math.pow((1 + Math.cos(f)) / 2, 1.6);
          const y = yAtras + (yAdelante - yAtras) * adelante, r = fuera(y) + rc + .004 * adelante;
          pts.push(new THREE.Vector3(Math.sin(f) * r, y, Math.cos(f) * r * (CUERPO.hondo + .03)));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 22, rc, 3, true);
      };
      const porColor = new Map();
      colores.forEach((c, i) => { if (!porColor.has(c)) porColor.set(c, []); porColor.get(c).push(i); });
      for (const [c, vueltas] of porColor) {
        const g = pieza('gualcas' + vueltas.join(), () => unir(THREE, vueltas.map(vuelta)));
        malla(g, arcilla(THREE, c, { brillo: 1, liso: true, emi: .12, mapa: cuentasTex(THREE) }), pivote).castShadow = false;
      }
    }
    if (anaco) {
      /* El anaco: una campana plisada que tapa los muslos, con un ribete
         claro en el filo que hace festón con los pliegues. Va en la cadera,
         así no se ladea cuando el torso se inclina. En la silla el frente
         se descuelga sobre las rodillas, como cae la tela de verdad. */
      const zA = silla ? .03 : .045, hondo = silla ? 1 : 1.12, cae = silla ? .045 : 0, ARRIBA = .158;
      // ocho pliegues con cinco gajos cada uno: con menos, el seno se
      // muestrea en zigzag y el filo se ve dentado
      const campana = (k, perfil, amp = .003, huellas = 3) => pieza(k + (silla ? 'S' : 'P'), () => {
        const g = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 40);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const abajo = Math.min(1, Math.max(0, (ARRIBA - y) / .12));
          const pl = 1 + .04 * Math.cos(Math.atan2(x, z) * 8) * abajo;   // los pliegues, uno al centro adelante
          x *= pl; z = z * pl * hondo + zA;
          if (cae && z > 0) y -= cae * Math.pow(z / .2, 2) * Math.min(1, Math.max(0, (.12 - y) / .1));
          p.setXYZ(i, x, y, z);
        }
        g.computeVertexNormals(); soldar(g);
        return amasar(g, amp, k, huellas);
      });
      const y0 = silla ? .006 : 0;
      malla(campana('anaco', [[.19, y0], [.2, y0 + .012], [.198, .045], [.18, .085], [.148, .124], [.098, ARRIBA]]),
        arcilla(THREE, a.anaco, { doble: true }), cadera);
      // el ribete va bien por fuera del anaco y casi sin amasar, sin
      // huellas: si no, el anaco lo atraviesa a parches y parece roto
      // el ribete es el filo del anaco blanco de abajo, que asoma
      malla(campana('ribete', [[.198, y0 + .001], [.22, y0 + .018], [.204, y0 + .04]], .001, 0),
        arcilla(THREE, a.ribete ?? tono(THREE, a.anaco, .5), { doble: true }), cadera);
      /* La faja: una cinta ancha y plana bien ceñida, con su tejido. */
      const gFaja = pieza('faja2', () => {
        const pts = [[.004, .07], [.019, .075], [.022, .1], [.019, .125], [.004, .13]].map(([d, y]) => new THREE.Vector2(radioCuerpo(y) + d, y));
        return amasar(poner(THREE, new THREE.LatheGeometry(pts, 22), [], [], [1, 1, CUERPO.hondo + .02]), .0015, 'faja', 1);
      });
      const cf = a.faja ?? 0x9a3f32;
      malla(gFaja, pintada(THREE, cf, fajaTex(THREE, cf)), pivote);
    }

    /* Cabeza: una bola grande, casi tan grande como el cuerpo. */
    const cabeza = this.cabeza = grupo(pivote, 0, .27, 0);
    const RC = .155, YC = .138;              // radio y centro de la cara
    const gCara = pieza('cara', () => unir(THREE, [
      amasar(poner(THREE, new THREE.SphereGeometry(RC, 17, 12), [0, YC, 0], [], [1.06, .97, 1]), .005, 'cabeza', 3),
      amasar(poner(THREE, new THREE.SphereGeometry(.026, 8, 6), [0, YC - .028, RC - .004], [], [1.15, .95, 1]), .002, 'nariz', 1),
      ...[-1, 1].map(l => amasar(poner(THREE, new THREE.SphereGeometry(.034, 7, 5), [l * RC * 1.03, YC - .012, -.006], [0, 0, l * .2], [.55, 1, .85]), .002, 'oreja' + l, 1)),
    ]));
    malla(gCara, piel, cabeza);
    // ojos: bolitas negras brillantes, con su puntito de luz
    const ojoX = .056, ojoY = YC + .006, ojoZ = Math.sqrt(RC * RC - ojoX * ojoX - .0001) + .002;
    const gOjos = pieza('ojos', () => unir(THREE, [-1, 1].map(l =>
      poner(THREE, new THREE.SphereGeometry(.024, 9, 7), [l * ojoX * 1.06, ojoY, ojoZ - .004], [0, l * .35, 0], [.9, 1.12, .55]))));
    malla(gOjos, negro, cabeza).castShadow = false;
    // dos brillitos por ojo, uno grande arriba y uno chiquito abajo: ojos de mirar bonito
    const gLuz = pieza('luces2', () => unir(THREE, [-1, 1].flatMap(l => [
      poner(THREE, new THREE.SphereGeometry(.0078, 6, 4), [l * ojoX * 1.06 + .007, ojoY + .009, ojoZ + .008]),
      poner(THREE, new THREE.SphereGeometry(.0038, 5, 3), [l * ojoX * 1.06 - .0065, ojoY - .009, ojoZ + .0085]),
    ])));
    malla(gLuz, brilloM, cabeza).castShadow = false;
    if (a.pestañas) {
      // pestañitas: dos rabitos de arcilla negra en la esquina de afuera de cada ojo
      const gPest = pieza('pestañas', () => unir(THREE, [-1, 1].flatMap(l => [[.016, .02, .55], [.021, .009, 1.05]].map(([dx, dy, gira]) =>
        poner(THREE, new THREE.CapsuleGeometry(.0034, .011, 1, 3), [l * (ojoX * 1.06 + dx + Math.sin(gira) * .008), ojoY + dy + Math.cos(gira) * .008, ojoZ - .012 - dx * .3], [0, l * .45, -l * gira])))));
      malla(gPest, negro, cabeza).castShadow = false;
    }
    // cachetes: dos bolitas aplastadas de arcilla rosada
    const gCachetes = pieza('cachetes', () => unir(THREE, [-1, 1].map(l =>
      amasar(poner(THREE, new THREE.SphereGeometry(.028, 8, 5), [l * .092, YC - .04, .118], [0, l * .65, 0], [1.1, .75, .4]), .002, 'cachete' + l, 1))));
    malla(gCachetes, rubor, cabeza).castShadow = false;
    // cejas: chorizos de pelo, se levantan del susto y se fruncen de la rabia
    const gCeja = chorizo('ceja', .0095, .03, .03, 6);
    this.cejas = [-1, 1].map(lado => {
      const c = malla(gCeja, pelo, cabeza, [lado * .058, YC + .046, .14]);
      c.rotation.set(0, lado * .35, Math.PI / 2);
      c.castShadow = false;
      c.userData.lado = lado;
      return c;
    });
    this.yCeja = YC + .046;
    // tres bocas: sonriendo, abierta (grita) y triste
    const yBoca = YC - .058, zBoca = Math.sqrt(RC * RC - .058 * .058) - .002;
    const sonrisa = malla(pieza('sonrisa', () => new THREE.TorusGeometry(.03, .0085, 5, 10, Math.PI)), bocaM, cabeza, [0, yBoca + .012, zBoca]);
    sonrisa.rotation.set(-.35, 0, Math.PI);
    const abierta = malla(pieza('abierta', () => new THREE.SphereGeometry(.027, 8, 6)), bocaM, cabeza, [0, yBoca - .004, zBoca - .006]);
    abierta.scale.set(1, 1.15, .45);
    const triste = malla(pieza('triste', () => new THREE.TorusGeometry(.024, .0085, 5, 10, Math.PI)), bocaM, cabeza, [0, yBoca - .016, zBoca - .004]);
    triste.rotation.x = -.35;
    for (const b of [sonrisa, abierta, triste]) b.castShadow = false;
    this.bocas = { sonrisa, abierta, triste };
    this.boca('sonrisa');
    if (a.bigote) {
      // el bigote de don: dos chorizos gorditos que salen de la nariz y caen a los lados
      const gBigote = pieza('bigote', () => unir(THREE, [-1, 1].map(l => {
        const x = l * .027, y = YC - .052, z = Math.sqrt(RC * RC - x * x - .052 * .052) + .004;
        return amasar(poner(THREE, new THREE.CapsuleGeometry(.0145, .03, 2, 6), [x * 1.1, y, z], [-.25, l * .35, l * (Math.PI / 2 - .38)], [1, 1, .85]), .0015, 'bigote' + l, 1);
      })));
      malla(gBigote, arcilla(THREE, a.bigote, { emi: .05 }), cabeza).castShadow = false;
    }

    /* El pelo: un casquete grueso y tres mechones como bollitos encima
       de la frente. Debajo del sombrero casi no se ve, pero asoma. */
    const ceñido = a.gorra || a.gorro;      // gorra o gorro: el pelo va pegadito
    const gPelo = pieza('pelo' + (a.sombrero ? 's' : a.trenza ? 't' : ceñido ? 'g' : ''), () => {
      // bajo la gorra el pelo va más pegadito, para que la gorra no crezca
      const partes = [amasar(poner(THREE, new THREE.SphereGeometry(RC + (ceñido ? .006 : .013), 16, 8, 0, Math.PI * 2, 0, Math.PI * .56), [0, YC, -.006], [-.6, 0, 0], [1.07, 1.02, 1.04]), .006, 'casco', 4)];
      // el flequillo: bollitos aplastados justo encima de las cejas; con
      // trenza, dos, con la raya al medio
      // con gorra no hay flequillo: se saldría por la tela
      // con sombrero, el ala tapa la frente y no asoma nada: los mechones
      // a los lados le daban melena
      const mechones = ceñido || a.sombrero ? [] : a.trenza ? [[-.055, .1, .55], [.055, .1, -.55]] : [[-.075, .094, .35], [0, .1, 0], [.075, .094, -.35]];
      for (const [x, y, gira] of mechones) {
        const z = Math.sqrt(Math.max(0, (RC + .01) ** 2 - y * y - x * x));
        partes.push(amasar(poner(THREE, new THREE.SphereGeometry(.052, 8, 5), [x, YC + y, z],
          [-.75, x * 4, gira], [1.3, .6, .75]), .004, 'mechon' + x, 1));
      }
      if (!a.trenza && !ceñido && !a.sombrero) {
        // un remolino arriba, que asoma cuando no hay sombrero
        partes.push(amasar(poner(THREE, new THREE.SphereGeometry(.03, 7, 5), [.02, YC + RC + .01, .02], [.4, 0, -.5], [1.2, .8, .9]), .003, 'remolino', 1));
      }
      return unir(THREE, partes);
    });
    malla(gPelo, pelo, cabeza);
    if (a.trenza) {
      /* La trenza: un chorizo torcido que sale de detrás de la oreja y cae
         adelante sobre el hombro, para que se vea de frente y desde arriba.
         Con su cinta y la puntita. Cuelga por su peso: va pegada a la
         cabeza en la nuca, pero no cabecea con ella (ver actualizar), y
         queda por fuera de la chalina aunque la cabeza gire. Los puntos
         van medidos desde la nuca. */
      const colgar = this.colgar = grupo(cabeza, .12, .07, -.08);
      const pts = [[-.05, .06, -.05], [.012, -.01, .005], [.056, -.07, .07], [.064, -.115, .142], [.046, -.145, .205], [.018, -.17, .252]];
      const gTrenza = pieza('trenza', () => {
        const curva = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        const g = new THREE.TubeGeometry(curva, 18, .026, 6, false);
        // los tres mechones: abolla en espiral para que se lea trenzada
        const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const u = uv.getX(i), v = uv.getY(i);
          const d = .007 * Math.sin(v * Math.PI * 2 * 3 + u * 40) * Math.min(1, u * 8);
          p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
        }
        g.computeVertexNormals(); soldar(g);
        return g;
      });
      malla(gTrenza, pelo, colgar);
      const [fx, fy, fz] = pts[pts.length - 1];
      const gCinta = pieza('cintaTrenza', () => unir(THREE, [
        amasar(poner(THREE, new THREE.TorusGeometry(.024, .01, 4, 9), [fx, fy + .005, fz], [Math.PI / 2 - .3, 0, 0]), .001, 'cinta1', 1),
        amasar(poner(THREE, new THREE.SphereGeometry(.018, 7, 5), [fx + .02, fy, fz + .01], [0, 0, .6], [1.4, .8, .8]), .001, 'cinta2', 1),
      ]));
      malla(gCinta, arcilla(THREE, a.trenza === true ? 0xb4553a : a.trenza), colgar);
      const punta = malla(pieza('puntaTrenza', () => amasar(new THREE.SphereGeometry(.024, 7, 5), .002, 'punta', 1)), pelo, colgar, [fx - .002, fy - .03, fz + .012]);
      punta.scale.set(.85, 1.2, .85);
    }

    /* Sombrero de paño: el ala con su filo redondeado, la copa con el
       hundido de arriba, y la cinta como un chorizo alrededor. Va un
       poquito ladeado, como se lo pone la gente. */
    let tope = YC + RC + .01;                 // lo más alto de la figura (sin escala)
    if (a.sombrero) {
      const som = grupo(cabeza, 0, YC + .09, -.012);
      som.rotation.set(-.17, 0, .07);
      const gSombrero = pieza('sombrero', () => {
        const ala = [[0, -.008], [.18, -.012], [.228, -.004], [.24, .007], [.228, .017], [.18, .013], [0, .012]].map(([x, y]) => new THREE.Vector2(x, y));
        const copa = [[0, 0], [.158, 0], [.152, .07], [.136, .12], [.1, .138], [.05, .132], [0, .118]].map(([x, y]) => new THREE.Vector2(x, y));
        return unir(THREE, [
          amasar(new THREE.LatheGeometry(ala, 18), .003, 'ala', 3),
          amasar(poner(THREE, new THREE.LatheGeometry(copa, 16), [0, .004, 0], [], [1, 1, .9]), .004, 'copa', 3),
        ]);
      });
      malla(gSombrero, arcilla(THREE, a.sombrero, { emi: .06 }), som);
      const gCinta = pieza('cintaSombrero', () => amasar(poner(THREE, new THREE.TorusGeometry(.155, .014, 4, 18), [0, .028, 0], [Math.PI / 2, 0, 0], [1, .9, 1.2]), .0015, 'cintaS', 2));
      malla(gCinta, arcilla(THREE, a.cinta ?? 0x2a1a14), som);
      tope = YC + .09 + .145;
    } else if (a.gorra) {
      /* La gorra: un casquete ceñido sobre el pelo (apenas más grande que
         él), con el filo por encima de las cejas para que la cara se vea
         entera. Seis gajos con su costura, el frente claro con su
         parchecito y la visera de otro tono: así se lee gorra y no casco.
         La lleva ladeada, con la visera hacia su izquierda y un poquito
         atrás: asoma en la silueta, y desde la cámara del juego (que lo ve
         por su derecha) no le tapa la cara. */
      const RG = RC + .02, ABRE = Math.PI * .4;      // radio y hasta dónde baja
      const gor = grupo(cabeza, 0, YC, -.006);
      gor.rotation.set(-.12, -1.3, .05);
      const gGorra = pieza('gorra3', () => amasar(poner(THREE, new THREE.SphereGeometry(RG, 16, 7, 0, Math.PI * 2, 0, ABRE), [], [], [1.07, 1.02, 1.05]), .003, 'gorra', 3));
      malla(gGorra, pintada(THREE, a.gorra, gorraTex(THREE, a.gorra, a.panel ?? 0xe8dcc0)), gor);
      const gVisera = pieza('visera2', () => unir(THREE, [
        amasar(poner(THREE, new THREE.SphereGeometry(.105, 12, 6), [0, RG * Math.cos(ABRE) + .004, .205], [-.12, 0, 0], [.95, .15, 1.08]), .002, 'visera', 1),
        amasar(new THREE.SphereGeometry(.016, 6, 4).translate(0, RG * 1.02, 0), .001, 'boton', 0),
      ]));
      malla(gVisera, arcilla(THREE, a.visera ?? tono(THREE, a.gorra, -.3)), gor);
      tope = YC + RG * 1.02 + .012;
    } else if (a.gorro) {
      /* El gorrito de lana: un casquete tejido a franjas que baja hasta
         encima de las cejas, el filo doblado y su pompón arriba. */
      const RG = RC + .022, ABRE = Math.PI * .4, raya = a.raya ?? 0xeee2c6;
      const gor = grupo(cabeza, 0, YC, -.006);
      gor.rotation.set(-.14, 0, -.06);
      const gGorro = pieza('gorro', () => amasar(poner(THREE, new THREE.SphereGeometry(RG, 16, 8, 0, Math.PI * 2, 0, ABRE), [], [], [1.07, 1.06, 1.05]), .004, 'gorro', 3));
      malla(gGorro, pintada(THREE, a.gorro, gorroTex(THREE, a.gorro, raya)), gor);
      const rFilo = RG * Math.sin(ABRE), yFilo = RG * 1.06 * Math.cos(ABRE);
      const gFilo = pieza('filoGorro', () => unir(THREE, [
        amasar(poner(THREE, new THREE.TorusGeometry(rFilo + .004, .016, 5, 22), [0, yFilo, 0], [Math.PI / 2, 0, 0], [1.07, 1.05, 1]), .002, 'filoG', 2),
        // el pompón: una bola bien amasada, que parezca mullida
        amasar(poner(THREE, new THREE.SphereGeometry(.042, 9, 6), [0, RG * 1.06 + .03, 0]), .01, 'pompon', 4),
      ]));
      malla(gFilo, arcilla(THREE, raya), gor);
      tope = YC + RG * 1.06 + .075;
    }

    /* Brazos: chorizos cortos con codo, y la mano un mitón redondo. */
    // las mangas: del poncho, de la chompa, o de la blusa bordada
    const mangas = a.poncho ? arcilla(THREE, a.poncho)
      : chompa ? pintada(THREE, cRopa, chompaTex(THREE, cRopa, ...chompa, true))
      : a.bordado ? pintada(THREE, cRopa, blusaTex(THREE, cRopa, Array.isArray(a.bordado) ? a.bordado : [0xb4432e, 0xc8603a, 0x4f7088]))
      : ropa;
    const gBrazo = chorizo('brazo', .046, .045), gAnte = chorizo('ante', .043, .035);
    const gMano = pieza('mano', () => unir(THREE, [
      amasar(poner(THREE, new THREE.SphereGeometry(.05, 9, 6), [0, 0, 0], [], [1, 1.05, .82]), .002, 'mano', 1),
      amasar(poner(THREE, new THREE.SphereGeometry(.02, 7, 5), [.035, .012, .018], [0, 0, -.6], [1, 1.4, 1]), .001, 'pulgar', 0),
    ]));
    this.brazos = [-1, 1].map(lado => {
      const hombro = grupo(pivote, lado * .135, .2, 0);
      const brazo = malla(gBrazo, mangas, hombro, [0, -.05, 0]);
      const codo = grupo(hombro, 0, -.1, 0);
      const ante = malla(gAnte, mangas, codo, [0, -.04, 0]);
      const mano = malla(gMano, piel, codo, [0, -.098, 0]);
      mano.scale.x = lado;            // el pulgar, siempre para adentro
      return { hombro, brazo, codo, ante, mano, lado };
    });

    // la altura del globo de lo que dice: encima de la cabeza (o del sombrero)
    this.alturaGlobo = this.alturaCadera + (.05 + .27 + tope + .02) * s;
    this.fase = Math.random() * 6;
    this.mira = null;              // un punto del mundo, o nada
    this.tension = 0;              // 0 tranquilo · 1 al borde
    this.gesto = null; this.tGesto = 0; this.durGesto = 0;
    this.lanzado = null;
    this.tBoing = 9;               // el rebote de arcilla al empezar un gesto
    this.ang = {};                 // ángulos actuales, que persiguen a los objetivos
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion(); this._qi = new THREE.Quaternion(); this._eje = new THREE.Vector3(0, 1, 0);
    if (this.colgar) this._nuca = this.colgar.position.clone();
  }

  /* Coloca las piernas según la pose. */
  sentar() {
    for (const { muslo, rodilla, pie, lado } of this.piernas) {
      if (this.pose === 'silla') {
        // muslos sobre el asiento, canillas colgando un poquito adelante
        muslo.rotation.set(-Math.PI / 2, lado * .06, 0);
        rodilla.rotation.x = Math.PI / 2 - .4;
        pie.rotation.x = .4;
      } else {
        // en el piso: piernas estiradas, un poco abiertas, puntas arriba
        muslo.rotation.set(-Math.PI / 2 + .04, lado * .22, 0);
        rodilla.rotation.x = .12;
        pie.rotation.x = -.15;
      }
    }
  }

  boca(cual) {
    for (const [k, m] of Object.entries(this.bocas)) m.visible = k === cual;
    this._boca = cual;
  }

  /* Gestos que duran un rato y vuelven solos a la espera. */
  hacer(gesto, dur) {
    this.gesto = gesto; this.tGesto = 0; this.durGesto = dur;
    this.tBoing = 0;
    if (gesto === 'grita' || gesto === 'celebra') this.boca('abierta');
    else if (gesto === 'lamenta') this.boca('triste');
  }
  grita(ms = 900) { if (!['lanza', 'celebra', 'lamenta'].includes(this.gesto)) this.hacer('grita', ms / 1000); }
  celebra() { this.hacer('celebra', 2.6); }
  lamenta() { this.hacer('lamenta', 2.4); }
  /* Lanza: echa el brazo atrás y lo suelta hacia la tina. `alSoltar`
     se llama en el momento en que las canicas salen de la mano. */
  lanza(alSoltar) { this.hacer('lanza', 1.05); this.lanzado = alSoltar; }

  /* Lleva un ángulo hacia su objetivo, suave. */
  _ir(clave, objetivo, dt, rapidez = 8) {
    const a = this.ang[clave] ?? objetivo;
    this.ang[clave] = a + (objetivo - a) * Math.min(1, dt * rapidez);
    return this.ang[clave];
  }

  actualizar(t, dt) {
    const g = this.gesto;
    if (g) { this.tGesto += dt; if (this.tGesto >= this.durGesto) { this.gesto = null; this.boca(this.tension > .7 ? 'abierta' : 'sonrisa'); } }
    const k = g ? this.tGesto / this.durGesto : 0;
    this.tBoing += dt;

    /* El torso: respira, se inclina sobre la tina con la tensión, se
       echa para atrás al lamentarse y rebota al celebrar. Con la cabeza
       tan grande, poquito basta; y el ladeo, más poquito todavía, que el
       poto redondo se mete en el asiento (o en la tierra). */
    let inclina = .08 + this.tension * .3 + Math.sin(t * 1.3 + this.fase) * .02;
    let rebote = 0, ladeo = Math.sin(t * .7 + this.fase) * .03;
    if (g === 'celebra') { inclina = -.06; rebote = Math.abs(Math.sin(this.tGesto * 9)) * .045; ladeo = Math.sin(this.tGesto * 9) * .04; }
    else if (g === 'lamenta') { inclina = -.14 + Math.sin(this.tGesto * 5) * .04; ladeo = Math.sin(this.tGesto * 3) * .05; }
    else if (g === 'grita') { inclina += .06; rebote = Math.abs(Math.sin(this.tGesto * 11)) * .018 * (1 - k); }
    else if (g === 'lanza') inclina = .06 + (k < .45 ? -.12 * (k / .45) : .32 * Math.min(1, (k - .45) / .2));
    if (this.pose === 'suelo') {
      // en el piso la cadera está en el suelo: echándose para atrás, el
      // poncho se mete en la tierra. La mitad basta
      if (inclina < 0) inclina *= .5;
      // y con poncho, hacia adelante tampoco tanto: la punta toca el piso
      if (this.conPoncho) inclina = Math.min(inclina, .28);
    }
    this.torso.rotation.x = this._ir('torso', inclina, dt, 6);
    this.torso.rotation.z = this._ir('ladeo', ladeo, dt, 6);
    const sube = this._ir('rebote', rebote, dt, 20);
    this.cadera.position.y = (this.alturaCadera + sube) / this.s;

    /* Boing: al empezar un gesto la arcilla se aplasta y se estira un
       ratito, y al celebrar se aplasta cada vez que cae. */
    const b = Math.exp(-this.tBoing * 5) * Math.sin(this.tBoing * 20) * .07
      + (g === 'celebra' ? (sube - .022) * 1.2 : 0);
    this.pivote.scale.set(1 - b * .5, 1 + b, 1 - b * .5);
    const respira = 1 + Math.sin(t * 2.1 + this.fase) * .018;
    this.cuerpo.scale.set(1 + (respira - 1) * .5, respira, 1 + (respira - 1) * .5);

    /* La cabeza mira lo que hay que mirar, con tope de cuello. */
    let yaw = Math.sin(t * .4 + this.fase) * .15, pitch = .1, roll = Math.sin(t * .55 + this.fase * 2) * .05;
    if (this.mira) {
      const p = this._v.copy(this.mira);
      this.cabeza.parent.worldToLocal(p);
      p.sub(this.cabeza.position);
      yaw = Math.max(-.9, Math.min(.9, Math.atan2(p.x, p.z)));
      pitch = Math.max(-.35, Math.min(.5, Math.atan2(-p.y, Math.hypot(p.x, p.z))));
    }
    if (g === 'lamenta') { pitch = .2; roll = Math.sin(this.tGesto * 4) * .15; }
    if (g === 'celebra') pitch = -.25;
    this.cabeza.rotation.y = this._ir('yaw', yaw, dt, 7);
    this.cabeza.rotation.x = this._ir('pitch', pitch, dt, 7);
    this.cabeza.rotation.z = this._ir('roll', roll, dt, 5);
    /* La trenza gira con la cabeza pero no cabecea ni se ladea: cuelga.
       Y si la cabeza mira para arriba, la nuca va atrás y arrastraría la
       trenza dentro de la chalina: entonces se queda donde estaba. */
    if (this.colgar) {
      const c = this.colgar, qi = this._qi.copy(this.cabeza.quaternion).invert();
      this._q.setFromAxisAngle(this._eje, this.cabeza.rotation.y);
      c.quaternion.copy(qi).multiply(this._q);
      const w = Math.min(1, Math.max(0, -this.cabeza.rotation.x * 10));
      this._v.copy(this._nuca).applyQuaternion(this._q).applyQuaternion(qi);
      c.position.copy(this._nuca).lerp(this._v, w);
    }

    // cejas: arriba si hay tensión o grita, inclinadas de pena si se lamenta
    const alza = (this.tension > .6 || g === 'grita' || g === 'celebra') ? .014 : 0;
    for (const c of this.cejas) {
      c.position.y = this.yCeja + this._ir('ceja', alza, dt, 10);
      c.rotation.z = Math.PI / 2 + this._ir('cejaG' + c.userData.lado, g === 'lamenta' ? c.userData.lado * -.4 : g === 'grita' ? c.userData.lado * .25 : 0, dt, 10);
    }

    /* Los brazos: en reposo con las manos en el regazo; gritando, un
       brazo arriba; celebrando, los dos; lamentando, a los cachetes;
       lanzando, el derecho atrás y luego adelante. */
    let alzado = 0;
    for (const br of this.brazos) {
      let hx = -.55, hz = br.lado * -.1, cx = -.75;
      if (this.tension > .5) { hx = -.95; hz = br.lado * -.2; cx = -.55; }
      /* Arriba de verdad: la cabeza es grande y el sombrero ancho, así que
         el brazo sube abierto por fuera del ala y el antebrazo se dobla
         hacia adentro, para que la mano quede encima de la cabeza (y no al
         lado del cachete). Se resta lo que el torso esté inclinado, para
         que apunte al cielo. La mano hace chao-chao doblando el codo. */
      const vertical = -3.08 - this.torso.rotation.x * .8;
      let cz = 0;
      const arriba = (g === 'grita' && br.lado === 1) || g === 'celebra';
      if (arriba) {
        const w = g === 'grita' ? this.tGesto * 14 : this.tGesto * 11 + br.lado;
        hx = vertical + Math.sin(w * .5) * .06; cx = -.05;
        hz = br.lado * (.62 + Math.sin(w) * .05);
        cz = -br.lado * (1.45 + Math.sin(w + 1) * .3);
      }
      if (g === 'lamenta') { hx = -2.45; hz = br.lado * -.22; cx = -.35; }
      if (g === 'lanza' && br.lado === 1) {
        // cargando, el brazo va atrás y se abre hacia afuera: así la mano
        // asoma al lado del poncho y se ve que toma impulso
        if (k < .45) { const r = k / .45; hx = .7 * r; hz = .85 * r; cx = -.9; }
        else { const r = Math.min(1, (k - .45) / .18); hx = .7 - 2.3 * r; hz = .85 - .8 * r; cx = -.9 + .8 * r; } // suelta
      }
      /* Los bracitos son cortos y la cabeza es grande: para que la mano
         pase bien arriba de la cabeza al gritar o celebrar, la arcilla se
         estira (el brazo y el antebrazo, no la mano) y el hombro sube. */
      const e = this._ir('estira' + br.lado, arriba ? 2.25 : 1, dt, 12);
      alzado = Math.max(alzado, (e - 1) / 1.25);
      br.hombro.position.y = .2 + (e - 1) * .13;
      br.brazo.scale.y = e; br.brazo.position.y = -.05 * e;
      br.codo.position.y = -.1 * e;
      br.ante.scale.y = e; br.ante.position.y = -.04 * e;
      br.mano.position.y = -.098 - .06 * (e - 1);
      br.hombro.rotation.x = this._ir('hx' + br.lado, hx, dt, g === 'lanza' ? 22 : 9);
      br.hombro.rotation.z = this._ir('hz' + br.lado, hz, dt, g === 'lanza' ? 22 : 9);
      br.codo.rotation.x = this._ir('cx' + br.lado, cx, dt, g === 'lanza' ? 22 : 9);
      br.codo.rotation.z = this._ir('cz' + br.lado, cz, dt, 10);
    }
    this.alzado = alzado;
    if (g === 'lanza' && this.lanzado && k >= .55) { const f = this.lanzado; this.lanzado = null; f(); }
  }

  /* Dónde va el globo: encima de la cabeza, en el mundo. Con la mano
     arriba (gritando, celebrando) sube un poquito con ella, para que el
     globo no le tape la mano. */
  globo(destino) {
    destino.set(0, this.alturaGlobo + .06 + (this.alzado || 0) * .13 * this.s, 0);
    return this.grupo.localToWorld(destino);
  }
}
