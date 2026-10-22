/* La tina del boliche: la física, sin dibujo.
   La tina es una hondonada honda y redonda —un casquete de esfera—, como
   las de Guano y Píllaro: las paredes son empinadas cerca del borde y el
   fondo es curvo. En el fondo hay dos agujeros, juntos, sin nada
   en medio: un redondo y una cajita cuadrada. Un poco más arriba, entre
   los dos, está el tope —la «l» del «.l.»—, que reparte lo que baja por
   ese lado.

   La regla: las ocho canicas terminan en los agujeros y se cuentan. Si
   quedan pares en cada uno (4 y 4, 2 y 6, 0 y 8) es PARES; si quedan
   impares (3 y 5, 1 y 7) es NONES. Como son ocho, las dos cuentas son
   siempre pares o siempre impares, y la última canica decide.

   Se simula en el plano (x, z), en unidades de radio (el borde está en
   r = 1, unos 60 cm), con la física de una bola que RUEDA sobre una
   superficie curva: la gravedad la jala cuesta abajo con 5/7 de su fuerza
   (el resto se va en hacerla girar), y la curvatura la aprieta contra la
   pared cuando va rápido, que es lo que la deja dar vueltas por arriba.
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
    rodadura: 0.5,   // frenado constante de rodar sobre cemento
    rebote: 0.5,     // contra el borde y el tope
    bola: 0.024,     // radio de una canica: unos 1,5 cm de diámetro
    // los dos agujeros, juntos en el fondo: en cada uno caben cuatro
    // canicas abajo y cuatro encima
    redondo: { x: -0.066, z: 0, r: 0.06 },
    cajita: { x: 0.06, z: 0, lado: 0.106 },
    // el tope: recto, un poco más arriba que los agujeros, entre los dos
    tope: { z0: -0.085, z1: -0.23, ancho: 0.022 },
    lomo: 2.5,       // entre los dos agujeros el fondo hace un lomito: nadie se queda ahí
    cae: 2.4,        // por debajo de esta velocidad, una canica sobre el agujero cae
    duracion: 12,    // a partir de aquí todo se frena más: nadie espera para siempre
  };

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
    return { cfg, bolas: [], t: 0, primera: null, ultima: null };
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

  /* ¿Está sobre un agujero? Cae si su centro ya pasó el borde —con un
     poco de margen— y no va tan rápido como para pasar por encima. */
  function sobre(c, b) {
    const R = c.redondo, K = c.cajita, m = c.bola * 0.3;
    if (Math.hypot(b.x - R.x, b.z - R.z) < R.r - m) return { cual: 'redondo', x: R.x, z: R.z };
    if (Math.abs(b.x - K.x) < K.lado / 2 - m && Math.abs(b.z - K.z) < K.lado / 2 - m) return { cual: 'cajita', x: K.x, z: K.z };
    return null;
  }

  /* Un paso de dt segundos. Devuelve los sucesos —choques y caídas—
     para que quien dibuja ponga el sonido. */
  function paso(tina, dt) {
    const c = tina.cfg, ev = [];
    tina.t += dt;
    // pasado el tiempo, más roce del que frena según la velocidad —que no
    // deja ninguna parada en la cuesta— y caen aunque vayan algo rápido
    const tarde = Math.max(0, tina.t - c.duracion);
    const roce = c.roce + tarde * 0.6, cae = c.cae * (1 + tarde * 0.3);
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
      /* El lomito entre los agujeros: lo que se para en medio se va para
         un lado o para el otro. */
      const R = c.redondo;
      if (Math.abs(b.z) < R.r && Math.abs(b.x) < 0.03) {
        const lado = b.x === 0 ? (b.vx >= 0 ? 1 : -1) : Math.sign(b.x);
        ax += lado * c.lomo * (1 - Math.abs(b.x) / 0.03);
      }

      const h = sobre(c, b);
      if (h && Math.hypot(b.vx, b.vz) < cae) {
        b.hueco = h.cual; b.fx = h.x; b.fz = h.z; b.vx = b.vz = 0;
        if (!tina.primera) tina.primera = b;
        const dentro = tina.bolas.filter(o => o.hueco).length;
        if (dentro === tina.bolas.length) tina.ultima = b;
        ev.push({ tipo: 'cae', bola: b, hueco: h.cual, dentro, ultima: tina.ultima === b });
        continue;
      }

      b.vx += ax * dt; b.vz += az * dt;
      const v = Math.hypot(b.vx, b.vz);
      if (v > 0) {
        const f = Math.max(0, 1 - roce * dt - (c.rodadura * dt) / v);
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
      // el tope: un tramo recto sobre el eje z, más arriba que los agujeros
      const T = c.tope, cz = Math.max(Math.min(T.z0, T.z1), Math.min(Math.max(T.z0, T.z1), b.z));
      const dx = b.x, dz = b.z - cz, d = Math.hypot(dx, dz), m = T.ancho / 2 + c.bola;
      if (d < m && d > 0) {
        const nx = dx / d, nz = dz / d;
        b.x = nx * m; b.z = cz + nz * m;
        rebotar(b, nx, nz, c.rebote, ev, 'tope');
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

  /* El tiro termina cuando cayeron todas (y terminaron de hundirse), o
     cuando ya nada se mueve. */
  function quietas(tina) {
    return tina.bolas.length > 0 && tina.bolas.every(b =>
      b.hueco ? b.cayendo >= 1 : tina.t >= b.espera && Math.hypot(b.vx, b.vz) < 0.02);
  }
  const todasDentro = tina => tina.bolas.length > 0 && tina.bolas.every(b => b.hueco);

  /* La regla: se cuentan las que cayeron en cada agujero. Pares si las
     cuentas son pares; nones si son impares. Si alguna quedó afuera, el
     tiro no vale. */
  function resultado(tina) {
    const redondo = tina.bolas.filter(b => b.hueco === 'redondo').length;
    const cajita = tina.bolas.filter(b => b.hueco === 'cajita').length;
    return { nulo: !todasDentro(tina), redondo, cajita, par: redondo % 2 === 0 };
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
    const lado = Math.atan2(Math.sin(angulo - dentro), Math.cos(angulo - dentro));
    for (let i = 0; i < c.canicas; i++) {
      const o = origen + (azar() - 0.5) * 0.5;     // la mano abierta: cada una sale de un sitio
      const x0 = Math.cos(o) * (r - azar() * c.bola * 2), z0 = Math.sin(o) * (r - azar() * c.bola * 2);
      // tres de cada diez se van para el otro lado
      const espejo = azar() < 0.3 ? -1 : 1;
      const a = o + Math.PI + espejo * lado + (azar() - 0.5) * 0.9;
      const vv = v * (0.65 + azar() * 0.6);
      const b = lanzar(tina, x0, z0, Math.cos(a) * vv, Math.sin(a) * vv, i % 2 ? 'blanca' : 'celeste');
      b.espera = azar() * 0.25;                    // se sueltan en un cuarto de segundo
    }
  }

  raiz.Tina = { CFG, crear, lanzar, paso, quietas, todasDentro, resultado, tirar, altura };
})(typeof window !== 'undefined' ? window : globalThis);
