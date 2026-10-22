/* La tina del boliche: la física, sin dibujo.
   La tina es una hondonada de cemento en cono, como las de Guano y
   Píllaro. En el fondo hay dos agujeros —uno redondo, grande, que es
   PARES, y una cajita cuadrada, pequeña, que es NONES— y un tope de
   madera al lado que reparte las canicas.
   Se simula en el plano (x, z), en unidades de radio: el borde de la
   tina está en r = 1. La gravedad empuja cuesta abajo por el cono, así
   que lo que se lanza baja dando vueltas, choca con el tope y con las
   otras canicas y cae en un agujero. La primera que cae decide.
   Va aparte para poder tirarla miles de veces en node y medir que salga
   parejo. Quien la dibuja (Three.js) lee x, z, altura(x, z) y `cayendo`. */
(function (raiz) {
  'use strict';

  const CFG = {
    canicas: 8,
    hondo: 0.42,     // lo que baja el cono del borde al fondo (en radios)
    fondo: 0.15,     // radio del fondo, que es casi plano
    g: 6.5,          // gravedad, en radios por segundo²
    roce: 0.15,      // frenado proporcional a la velocidad
    rodadura: 0.08,  // frenado constante, el que al final las para
    rebote: 0.5,     // contra el borde y el tope
    bola: 0.03,      // radio de una canica
    redondo: { x: 0.054, z: 0.007, r: 0.045 },   // PARES
    cajita: { x: -0.061, z: -0.014, lado: 0.05 }, // NONES: un cuadrado de este lado
    tope: { x: 0.086, z: -0.065, angulo: -0.6, largo: 0.13 },  // la cuña de madera, cuidando el redondo
    labio: 0.035,    // cuánto más allá del agujero ya se siente la caída
    atrae: 2.2,
    cae: 0.6,        // por debajo de esta velocidad, una canica sobre el agujero cae
    duracion: 14,    // a partir de aquí el roce sube: nadie espera para siempre
  };

  /* El tope: una cuña de madera tirada en el fondo. Para chocar es una
     fila de círculos. */
  function tope(cfg) {
    const { x: x0, z: z0, angulo: a, largo } = cfg.tope, out = [];
    for (let i = 0; i < 4; i++) {
      const t = (i / 3 - 0.5) * largo;
      out.push({ x: x0 + Math.cos(a) * t, z: z0 + Math.sin(a) * t, r: 0.019 });
    }
    return { x: x0, z: z0, angulo: a, largo, ancho: 0.05, circulos: out };
  }

  /* Altura del fondo en (x, z): 0 en el borde, -hondo en el centro.
     Cono recto, con el fondo redondeado para que no haya pico. */
  function altura(cfg, x, z) {
    const r = Math.hypot(x, z), b = cfg.fondo, pend = cfg.hondo / (1 - b * 0.5);
    if (r >= b) return -cfg.hondo + pend * (r - b * 0.5);
    return -cfg.hondo + pend * (r * r) / (2 * b);
  }
  // la pendiente: lo que empuja cuesta abajo
  function pendiente(cfg, r) {
    const b = cfg.fondo, pend = cfg.hondo / (1 - b * 0.5);
    return r >= b ? pend : pend * r / b;
  }

  function crear(cfg) {
    cfg = Object.assign({}, CFG, cfg || {});
    return { cfg, tope: tope(cfg), bolas: [], t: 0, primera: null };
  }

  function lanzar(tina, x, z, vx, vz, color) {
    const b = { x, z, vx, vz, color, hueco: null, cayendo: 0, fx: 0, fz: 0 };
    tina.bolas.push(b);
    return b;
  }

  function rebotar(b, nx, nz, e, ev, tipo) {
    const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) {
      b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz;
      if (-vn > 0.1) ev.push({ tipo, fuerza: -vn });
    }
  }

  /* ¿Sobre qué agujero está y a qué distancia de su centro? */
  function sobre(c, b) {
    const R = c.redondo, dr = Math.hypot(b.x - R.x, b.z - R.z);
    const K = c.cajita, dx = Math.abs(b.x - K.x), dz = Math.abs(b.z - K.z);
    const medio = K.lado / 2;
    return [
      { cual: 'redondo', x: R.x, z: R.z, dentro: dr < R.r * 0.7, cerca: dr < R.r + c.labio, d: dr, alcance: R.r + c.labio },
      { cual: 'cajita', x: K.x, z: K.z, dentro: dx < medio * 0.75 && dz < medio * 0.75,
        cerca: dx < medio + c.labio && dz < medio + c.labio, d: Math.hypot(dx, dz), alcance: (medio + c.labio) * 1.41 },
    ];
  }

  /* Un paso de dt segundos. Devuelve los sucesos —choques y caídas—
     para que quien dibuja ponga el sonido. */
  function paso(tina, dt) {
    const c = tina.cfg, ev = [];
    tina.t += dt;
    const lento = tina.t > c.duracion ? 1 + (tina.t - c.duracion) * 0.8 : 1;
    for (const b of tina.bolas) {
      if (b.hueco) { b.cayendo = Math.min(1, b.cayendo + dt * 2.2); continue; }
      const r = Math.hypot(b.x, b.z) || 1e-6;
      const p = pendiente(c, r);
      // cuesta abajo, proyectado sobre el plano
      let ax = -c.g * p / Math.sqrt(1 + p * p) * (b.x / r);
      let az = -c.g * p / Math.sqrt(1 + p * p) * (b.z / r);
      for (const h of sobre(c, b)) {
        if (!h.cerca) continue;
        const dx = h.x - b.x, dz = h.z - b.z, d = Math.hypot(dx, dz) || 1;
        const f = c.atrae * Math.max(0, 1 - h.d / h.alcance);
        ax += (dx / d) * f; az += (dz / d) * f;
        if (h.dentro && Math.hypot(b.vx, b.vz) < c.cae) {
          b.hueco = h.cual; b.fx = h.x; b.fz = h.z; b.vx = b.vz = 0;
          if (!tina.primera) tina.primera = b;
          ev.push({ tipo: 'cae', bola: b, hueco: h.cual, primera: tina.primera === b });
          break;
        }
      }
      if (b.hueco) continue;
      b.vx += ax * dt; b.vz += az * dt;
      const v = Math.hypot(b.vx, b.vz);
      if (v > 0) {
        const f = Math.max(0, 1 - c.roce * lento * dt - (c.rodadura * lento * dt) / v);
        b.vx *= f; b.vz *= f;
      }
      b.x += b.vx * dt; b.z += b.vz * dt;
      // el borde de la tina
      const r2 = Math.hypot(b.x, b.z), lim = 1 - c.bola;
      if (r2 > lim) {
        const nx = -b.x / r2, nz = -b.z / r2;
        b.x = -nx * lim; b.z = -nz * lim;
        rebotar(b, nx, nz, c.rebote, ev, 'pared');
      }
      // el tope
      for (const t of tina.tope.circulos) {
        const dx = b.x - t.x, dz = b.z - t.z, d = Math.hypot(dx, dz), m = t.r + c.bola;
        if (d < m && d > 0) {
          const nx = dx / d, nz = dz / d;
          b.x = t.x + nx * m; b.z = t.z + nz * m;
          rebotar(b, nx, nz, c.rebote, ev, 'tope');
        }
      }
    }
    // entre canicas
    const vivas = tina.bolas.filter(b => !b.hueco);
    for (let i = 0; i < vivas.length; i++) for (let j = i + 1; j < vivas.length; j++) {
      const a = vivas[i], b = vivas[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = c.bola * 2;
      if (d > 0 && d < m) {
        const nx = dx / d, nz = dz / d, solapa = (m - d) / 2;
        a.x -= nx * solapa; a.z -= nz * solapa; b.x += nx * solapa; b.z += nz * solapa;
        const vr = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (vr < 0) {
          const imp = -(1 + 0.92) * vr / 2;
          a.vx -= imp * nx; a.vz -= imp * nz; b.vx += imp * nx; b.vz += imp * nz;
          if (-vr > 0.08) ev.push({ tipo: 'choque', fuerza: -vr });
        }
      }
    }
    return ev;
  }

  /* Ya se sabe el resultado en cuanto cae la primera; el tiro termina
     cuando todo lo demás también cayó o se quedó quieto. */
  function quietas(tina) {
    return tina.bolas.length > 0 && tina.bolas.every(b =>
      b.hueco ? b.cayendo >= 1 : Math.hypot(b.vx, b.vz) < 0.015);
  }

  /* La regla de Guano: la primera canica que cae decide. En el redondo,
     pares; en la cajita, nones. Si no cae ninguna, el tiro no vale. */
  function resultado(tina) {
    const p = tina.primera;
    return {
      nulo: !p,
      par: !!p && p.hueco === 'redondo',
      redondo: tina.bolas.filter(b => b.hueco === 'redondo').length,
      cajita: tina.bolas.filter(b => b.hueco === 'cajita').length,
    };
  }

  /* El tiro: las ocho salen juntas de la mano, desde el borde en el
     punto `origen` (ángulo, radianes), hacia `angulo`, con `fuerza` de
     0 a 1. Se tiran de costado para que den vueltas. */
  function tirar(tina, origen, angulo, fuerza, azar) {
    azar = azar || Math.random;
    const c = tina.cfg, r = 1 - c.bola * 1.6;
    const tx = -Math.sin(origen), tz = Math.cos(origen);
    const v = 0.85 + fuerza * 3.6;
    for (let i = 0; i < c.canicas; i++) {
      const fila = i % 2, col = (i >> 1) - (c.canicas / 2 - 1) / 2;
      const x0 = Math.cos(origen) * (r - fila * c.bola * 2.2) + tx * col * c.bola * 2.2;
      const z0 = Math.sin(origen) * (r - fila * c.bola * 2.2) + tz * col * c.bola * 2.2;
      const a = angulo + col * 0.03 + (azar() - 0.5) * 0.25;
      const vv = v * (1 + (azar() - 0.5) * 0.3);
      lanzar(tina, x0, z0, Math.cos(a) * vv, Math.sin(a) * vv, i % 2 ? 'blanca' : 'celeste');
    }
  }

  raiz.Tina = { CFG, crear, lanzar, paso, quietas, resultado, tirar, altura };
})(typeof window !== 'undefined' ? window : globalThis);
