/* La tina del boliche: la física, sin dibujo.
   Vista desde arriba, en unidades de radio (el borde está en r = 1).
   El fondo es un cuenco: todo lo que rueda tiende al centro. Las bolas
   entran por el borde, dan vueltas, se frenan y caen en un hueco del
   anillo —que lleva su número— o, si lo cruzan sin caer, acaban en el
   ombligo del centro, que es de la casa y vale cero.
   Va aparte para poder tirarla mil veces en node y medir que la regla
   «pares gana la banca, nones paga al triple» sea pareja. */
(function (raiz) {
  'use strict';

  const CFG = {
    k: 2.4,          // lo hondo del cuenco: aceleración hacia el centro por unidad de radio
    roce: 0.3,       // frenado proporcional a la velocidad
    rodadura: 0.07,  // frenado constante, el que al final las para
    pared: 0.97,     // radio de la pared interior
    rebote: 0.55,
    bola: 0.045,     // radio de una bola
    anillo: 0.56,    // radio del anillo de huecos
    huecos: 12,
    hueco: 0.062,    // radio de un hueco
    tiro: 0.075,     // el hueco atrae dentro de este radio: el labio
    atrae: 3.2,
    cae: 0.95,       // velocidad por debajo de la cual una bola que pisa un hueco cae
    ombligo: 0.085,
  };

  /* Los números van salteados alrededor del anillo, como en las tinas
     pintadas a mano: un par nunca tiene al lado otro par fácil. */
  const NUMEROS = [1, 8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6];

  function huecos(cfg) {
    const out = [];
    for (let i = 0; i < cfg.huecos; i++) {
      const a = -Math.PI / 2 + (i / cfg.huecos) * Math.PI * 2;
      out.push({ x: Math.cos(a) * cfg.anillo, y: Math.sin(a) * cfg.anillo, n: NUMEROS[i % NUMEROS.length] });
    }
    out.push({ x: 0, y: 0, n: 0, ombligo: true });
    return out;
  }

  function crear(cfg) {
    cfg = Object.assign({}, CFG, cfg || {});
    return { cfg, huecos: huecos(cfg), bolas: [], t: 0 };
  }

  /* Una bola entra por el borde con velocidad (vx, vy). */
  function lanzar(tina, x, y, vx, vy, color) {
    const b = { x, y, vx, vy, color, hueco: null, cayendo: 0, giro: 0 };
    tina.bolas.push(b);
    return b;
  }

  /* Un paso de dt segundos. Devuelve los sucesos —choques y caídas—
     para que quien dibuja ponga el sonido. */
  function paso(tina, dt) {
    const c = tina.cfg, ev = [];
    tina.t += dt;
    const lento = tina.t > 18 ? 1 + (tina.t - 18) * 0.6 : 1; // nadie espera para siempre
    for (const b of tina.bolas) {
      if (b.hueco) { b.cayendo = Math.min(1, b.cayendo + dt * 4); continue; }
      let ax = -c.k * b.x, ay = -c.k * b.y;
      for (const h of tina.huecos) {
        // en un hueco del anillo cabe una sola bola; la que llega después pasa por encima
        if (!h.ombligo && tina.bolas.some(o => o.hueco === h)) continue;
        const r = h.ombligo ? c.ombligo : c.hueco;
        const dx = h.x - b.x, dy = h.y - b.y, d = Math.hypot(dx, dy);
        if (d < r + c.tiro - c.hueco) {
          const f = c.atrae * (1 - d / (r + c.tiro - c.hueco));
          ax += (dx / (d || 1)) * f; ay += (dy / (d || 1)) * f;
          const v = Math.hypot(b.vx, b.vy);
          if (d < r * 0.7 && (v < c.cae || h.ombligo)) {
            b.hueco = h; b.vx = b.vy = 0;
            ev.push({ tipo: 'cae', bola: b, hueco: h, v });
            break;
          }
        }
      }
      if (b.hueco) continue;
      b.vx += ax * dt; b.vy += ay * dt;
      const v = Math.hypot(b.vx, b.vy);
      if (v > 0) {
        const f = Math.max(0, 1 - (c.roce * lento * dt) - (c.rodadura * lento * dt) / v);
        b.vx *= f; b.vy *= f;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.giro += v * dt / c.bola;
      const r = Math.hypot(b.x, b.y), lim = c.pared - c.bola;
      if (r > lim) {
        const nx = b.x / r, ny = b.y / r, vn = b.vx * nx + b.vy * ny;
        b.x = nx * lim; b.y = ny * lim;
        if (vn > 0) {
          b.vx -= (1 + c.rebote) * vn * nx; b.vy -= (1 + c.rebote) * vn * ny;
          if (vn > 0.15) ev.push({ tipo: 'pared', fuerza: vn });
        }
      }
    }
    // choques entre bolas que siguen rodando
    const vivas = tina.bolas.filter(b => !b.hueco);
    for (let i = 0; i < vivas.length; i++) for (let j = i + 1; j < vivas.length; j++) {
      const a = vivas[i], b = vivas[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = c.bola * 2;
      if (d > 0 && d < m) {
        const nx = dx / d, ny = dy / d, solapa = (m - d) / 2;
        a.x -= nx * solapa; a.y -= ny * solapa; b.x += nx * solapa; b.y += ny * solapa;
        const vr = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vr < 0) {
          const imp = -(1 + 0.9) * vr / 2;
          a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
          ev.push({ tipo: 'choque', fuerza: -vr });
        }
      }
    }
    return ev;
  }

  const quietas = tina => tina.bolas.length > 0 && tina.bolas.every(b => b.hueco && b.cayendo >= 1);

  /* La regla: se suman los huecos. Par, gana la banca; non, paga al
     triple. Y el ombligo es de la casa: una bola ahí y gana la banca,
     sume lo que sume. Es lo que hace que pagar al triple no la arruine. */
  function resultado(tina) {
    const suma = tina.bolas.reduce((s, b) => s + (b.hueco ? b.hueco.n : 0), 0);
    const casa = tina.bolas.some(b => b.hueco && b.hueco.ombligo);
    return { suma, casa, par: casa || suma % 2 === 0 };
  }

  /* El tiro de la banca: dos bolas que salen juntas desde el borde, en
     el punto `origen` (ángulo, en radianes), empujadas en la dirección
     del gesto. `fuerza` va de 0 a 1. */
  function tirar(tina, origen, angulo, fuerza, azar) {
    azar = azar || Math.random;
    const c = tina.cfg, r = c.pared - c.bola - 0.01;
    const x0 = Math.cos(origen) * r, y0 = Math.sin(origen) * r;
    const tx = -Math.sin(origen), ty = Math.cos(origen); // tangente, para separarlas
    const v = 1.1 + fuerza * 2.6;
    ['celeste', 'blanca'].forEach((color, i) => {
      const lado = i === 0 ? -1 : 1;
      const a = angulo + lado * 0.05 + (azar() - 0.5) * 0.12;
      const vv = v * (1 + (azar() - 0.5) * 0.14);
      lanzar(tina, x0 + tx * lado * c.bola * 1.15, y0 + ty * lado * c.bola * 1.15,
        Math.cos(a) * vv, Math.sin(a) * vv, color);
    });
  }

  raiz.Tina = { CFG, crear, lanzar, paso, quietas, resultado, tirar };
})(typeof window !== 'undefined' ? window : globalThis);
