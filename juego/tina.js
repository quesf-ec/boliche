/* La tina del boliche: la física, sin dibujo.
   La tina es una hondonada honda y redonda —un casquete de esfera—, como
   las de Guano y Píllaro: las paredes son empinadas cerca del borde y el
   fondo es curvo. En el fondo hay dos agujeros —uno redondo, grande, que
   es PARES, y una cajita cuadrada que es NONES— y un tope de madera al
   lado que reparte las canicas.
   Se simula en el plano (x, z), en unidades de radio (el borde está en
   r = 1, unos 60 cm), pero con la física de una bola que RUEDA sobre una
   superficie curva: la gravedad la jala cuesta abajo con 5/7 de su fuerza
   (el resto se va en hacerla girar), y la curvatura la aprieta contra la
   pared cuando va rápido, que es lo que la deja dar vueltas por arriba.
   Un tiro fuerte da varias vueltas y baja; uno suave cae enseguida al
   fondo. La primera que cae en un agujero decide.
   Va aparte para poder tirarla miles de veces en node y medir que salga
   parejo. Quien la dibuja (Three.js) lee x, z, altura(x, z) y `cayendo`. */
(function (raiz) {
  'use strict';

  const CFG = {
    canicas: 8,
    hondo: 0.55,     // lo que baja la tina del borde al fondo (en radios)
    g: 16.3,         // gravedad: 9,8 m/s² con el radio de unos 60 cm
    rueda: 5 / 7,    // una bola que rueda acelera 5/7 de lo que acelera una que resbala
    roce: 0.08,      // frenado proporcional a la velocidad: el aire y el cemento
    rodadura: 0.5,   // frenado constante de rodar sobre cemento, el que al final las para
    rebote: 0.5,     // contra el borde y el tope
    bola: 0.03,      // radio de una canica
    redondo: { x: 0.054, z: 0.007, r: 0.045 },   // PARES
    cajita: { x: -0.072, z: -0.014, lado: 0.042 }, // NONES: un cuadrado de este lado
    tope: { x: 0.086, z: -0.065, angulo: -0.6, largo: 0.13 },  // la cuña de madera, cuidando el redondo
    labio: 0.035,    // cuánto más allá del agujero ya se siente la caída
    atrae: 2.2,
    cae: 0.6,        // por debajo de esta velocidad, una canica sobre el agujero cae
    duracion: 10,    // a partir de aquí el roce sube: nadie espera para siempre
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

  /* La tina es un casquete de esfera de radio E que baja `hondo` del
     borde al centro: E = (1 + hondo²) / (2·hondo). */
  const esfera = cfg => (1 + cfg.hondo * cfg.hondo) / (2 * cfg.hondo);
  /* Altura del fondo en (x, z): 0 en el borde, -hondo en el centro. */
  function altura(cfg, x, z) {
    const E = esfera(cfg), r2 = Math.min(x * x + z * z, 1);
    return -cfg.hondo + E - Math.sqrt(E * E - r2);
  }
  // la pendiente h'(r) y la curvatura h''(r) del casquete
  function forma(cfg, r) {
    const E = esfera(cfg), q = E * E - Math.min(r * r, 1);
    return { h1: r / Math.sqrt(q), h2: E * E / Math.pow(q, 1.5) };
  }

  function crear(cfg) {
    cfg = Object.assign({}, CFG, cfg || {});
    return { cfg, tope: tope(cfg), bolas: [], t: 0, primera: null };
  }

  function lanzar(tina, x, z, vx, vz, color) {
    const b = { x, z, vx, vz, color, hueco: null, cayendo: 0, fx: 0, fz: 0, espera: 0 };
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
      if (b.hueco) { b.cayendo = Math.min(1, b.cayendo + dt * 2.6); continue; }
      if (tina.t < b.espera) continue;          // todavía en la mano
      /* Una bola sobre la superficie y = h(x, z), vista desde arriba:
           a = -(g·5/7 + vᵀHv) · ∇h / (1 + |∇h|²)
         ∇h es la cuesta y H la curvatura. El término vᵀHv es lo que la
         pega a la pared cuando va rápido —la fuerza de la pared que la
         hace girar— y lo que la deja subir y bajar con la velocidad que
         le toca. */
      const r = Math.hypot(b.x, b.z) || 1e-6, ux = b.x / r, uz = b.z / r;
      const { h1, h2 } = forma(c, r);
      const vr = b.vx * ux + b.vz * uz, vt = -b.vx * uz + b.vz * ux;
      const vHv = h2 * vr * vr + (h1 / r) * vt * vt;
      const k = (c.g * c.rueda + vHv) * h1 / (1 + h1 * h1);
      let ax = -k * ux, az = -k * uz;
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
    const vivas = tina.bolas.filter(b => !b.hueco && tina.t >= b.espera);
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
      b.hueco ? b.cayendo >= 1 : tina.t >= b.espera && Math.hypot(b.vx, b.vz) < 0.02);
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

  /* El tiro. Las canicas no salen todas para el mismo lado: se juega con
     ellas en la mano y se sueltan desparramadas, unas un poco antes que
     otras, la mayoría hacia donde va el gesto y algunas para el otro
     lado, cada una con su fuerza. Salen del borde alrededor del punto
     `origen` (ángulo, radianes); `angulo` es la dirección del gesto y
     `fuerza` va de 0 a 1. */
  function tirar(tina, origen, angulo, fuerza, azar) {
    azar = azar || Math.random;
    const c = tina.cfg, r = 1 - c.bola * 1.6;
    const v = 1.4 + fuerza * 5.6;                  // de 1,4 a 7 radios/s: de 0,8 a 4,2 m/s
    const dentro = origen + Math.PI;
    let lado = Math.atan2(Math.sin(angulo - dentro), Math.cos(angulo - dentro));
    for (let i = 0; i < c.canicas; i++) {
      const o = origen + (azar() - 0.5) * 0.5;     // la mano abierta: cada una sale de un sitio
      const x0 = Math.cos(o) * (r - azar() * c.bola * 2), z0 = Math.sin(o) * (r - azar() * c.bola * 2);
      // dos de cada diez se van para el otro lado
      const espejo = azar() < 0.3 ? -1 : 1;
      const a = o + Math.PI + espejo * lado + (azar() - 0.5) * 0.9;
      const vv = v * (0.65 + azar() * 0.6);
      const b = lanzar(tina, x0, z0, Math.cos(a) * vv, Math.sin(a) * vv, i % 2 ? 'blanca' : 'celeste');
      b.espera = azar() * 0.25;                    // se sueltan en un cuarto de segundo
    }
  }

  raiz.Tina = { CFG, crear, lanzar, paso, quietas, resultado, tirar, altura };
})(typeof window !== 'undefined' ? window : globalThis);
