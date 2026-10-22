/* La gente del boliche: figuras armadas con piezas simples —cápsulas,
   esferas, cilindros— pero con esqueleto: cadera, torso, cabeza, brazos
   con codo y piernas con rodilla. Así pueden mirar la canica que va
   adelante, inclinarse cuando una está por caer, gritar con el brazo
   arriba, celebrar, agarrarse la cabeza y lanzar.

   Cada figura se arma con `new Persona(THREE, aspecto)` y se anima con
   `persona.actualizar(t, dt)` en cada cuadro. Mira hacia +z: quien la
   pone en la escena la gira hacia la tina con `lookAt`. */

const PIELES = [0xc68a5c, 0xa86f48, 0xd29b72, 0x8d5a3a, 0xb97d55];
const PELOS = [0x1a1210, 0x2b1d14, 0x3a2a1e, 0x16110e];

export class Persona {
  constructor(THREE, a = {}) {
    this.T = THREE;
    const s = a.escala || 1;
    this.pose = a.pose || 'suelo';          // 'suelo' (agachado en el piso) | 'silla'
    const mat = (color, rough = .85) => new THREE.MeshStandardMaterial({ color, roughness: rough });
    const piel = mat(a.piel ?? PIELES[Math.floor(Math.random() * PIELES.length)], .75);
    const pelo = mat(a.pelo ?? PELOS[Math.floor(Math.random() * PELOS.length)], .9);
    const ropa = mat(a.ropa ?? 0x9b1d2a);
    const pantalon = mat(a.pantalon ?? 0x2c2c38);
    const zapato = mat(0x1d1714, .6);
    const oscuro = new THREE.MeshBasicMaterial({ color: 0x140e0c });
    const blanco = mat(0xf5f1e8, .5);

    const capsula = (r, largo, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r * s, largo * s, 4, 10), m);
    const esfera = (r, m, seg = 14) => new THREE.Mesh(new THREE.SphereGeometry(r * s, seg, Math.round(seg * .75)), m);
    const cil = (r1, r2, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(r1 * s, r2 * s, h * s, seg), m);
    const grupo = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x * s, y * s, z * s); return g; };

    this.grupo = new THREE.Group();
    // la cadera sube o baja según el asiento: en el piso o en una silla
    this.alturaCadera = (this.pose === 'silla' ? (a.asiento ?? .42) : .1);
    const cadera = this.cadera = grupo(0, this.alturaCadera / s, 0);
    this.grupo.add(cadera);

    /* Piernas. Agachado: rodillas arriba y pies en el piso. En silla:
       muslos para adelante y canillas para abajo. */
    this.piernas = [];
    for (const lado of [-1, 1]) {
      const muslo = grupo(lado * .07, 0, .02);
      const m = capsula(.045, .17, pantalon); m.position.y = -.11 * s; muslo.add(m);
      const rodilla = grupo(0, -.22, 0);
      const c = capsula(.038, .17, pantalon); c.position.y = -.1 * s; rodilla.add(c);
      const pie = new THREE.Mesh(new THREE.BoxGeometry(.075 * s, .05 * s, .14 * s), zapato);
      pie.position.set(0, -.21 * s, .035 * s); rodilla.add(pie);
      muslo.add(rodilla); cadera.add(muslo);
      this.piernas.push({ muslo, rodilla, pie });
    }
    this.sentar();

    /* Torso: se inclina desde la cadera. */
    const torso = this.torso = grupo();
    cadera.add(torso);
    const cuerpo = capsula(.105, .2, ropa);
    cuerpo.position.y = .2 * s; cuerpo.scale.set(1, 1, .78);
    torso.add(cuerpo);
    this.cuerpo = cuerpo;

    // la ropa de encima: poncho, chalina o nada
    if (a.poncho) {
      const p = cil(.07, .27, .3, mat(a.poncho), 20); p.position.y = .28 * s; p.scale.z = .82; torso.add(p);
      const franja = cil(.215, .235, .035, mat(a.franja ?? 0xf3e6c8), 20); franja.position.y = .19 * s; franja.scale.z = .82; torso.add(franja);
      const cuello = cil(.06, .075, .04, mat(a.poncho)); cuello.position.y = .44 * s; torso.add(cuello);
    }
    if (a.chalina) {
      const c = cil(.12, .17, .1, mat(a.chalina), 20); c.position.y = .36 * s; c.scale.z = .85; torso.add(c);
    }
    if (a.anaco) {
      // la falda: cubre las piernas, como una campana sobre el asiento
      const f = cil(.12, this.pose === 'silla' ? .22 : .28, .22, mat(a.anaco), 20);
      f.position.set(0, (this.pose === 'silla' ? -.05 : .02) * s, .07 * s); f.scale.z = 1.1;
      cadera.add(f);
      const faja = cil(.115, .12, .03, mat(a.faja ?? 0xd8392b)); faja.position.y = .07 * s; torso.add(faja);
    }

    /* Cabeza: cuello, cara, pelo y sombrero. */
    const cuello = cil(.04, .045, .07, piel); cuello.position.y = .43 * s; torso.add(cuello);
    const cabeza = this.cabeza = grupo(0, .52, 0);
    torso.add(cabeza);
    const craneo = esfera(.095, piel, 20); craneo.scale.set(1, 1.08, 1); cabeza.add(craneo);
    const nariz = esfera(.022, piel, 8); nariz.position.set(0, -.008 * s, .093 * s); nariz.scale.set(.9, 1, 1.1); cabeza.add(nariz);
    for (const lado of [-1, 1]) {
      const ojo = esfera(.017, blanco, 10); ojo.position.set(lado * .035 * s, .018 * s, .083 * s); ojo.scale.z = .6;
      const nina = esfera(.01, oscuro, 8); nina.position.set(lado * .035 * s, .018 * s, .093 * s);
      const oreja = esfera(.022, piel, 8); oreja.position.set(lado * .094 * s, 0, 0); oreja.scale.set(.5, 1, .8);
      cabeza.add(ojo, nina, oreja);
    }
    // las cejas se levantan del susto y se fruncen de la rabia
    this.cejas = [-1, 1].map(lado => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(.035 * s, .008 * s, .008 * s), pelo);
      c.position.set(lado * .035 * s, .045 * s, .088 * s);
      c.userData.lado = lado;
      cabeza.add(c); return c;
    });
    // tres bocas: sonriendo, abierta (grita) y triste
    const sonrisa = new THREE.Mesh(new THREE.TorusGeometry(.026 * s, .006 * s, 6, 12, Math.PI), oscuro);
    sonrisa.rotation.z = Math.PI; sonrisa.position.set(0, -.035 * s, .087 * s);
    const abierta = esfera(.022, oscuro, 10); abierta.scale.set(1, 1.15, .5); abierta.position.set(0, -.045 * s, .084 * s);
    const triste = new THREE.Mesh(new THREE.TorusGeometry(.022 * s, .006 * s, 6, 12, Math.PI), oscuro);
    triste.position.set(0, -.058 * s, .085 * s);
    cabeza.add(sonrisa, abierta, triste);
    this.bocas = { sonrisa, abierta, triste };
    this.boca('sonrisa');

    // pelo: un casquete, y trenza si va
    const casco = new THREE.Mesh(new THREE.SphereGeometry(.1 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI * .55), pelo);
    casco.position.y = .012 * s; casco.rotation.x = -.25; casco.scale.set(1.04, 1.1, 1.06);
    cabeza.add(casco);
    if (a.trenza) {
      const t = capsula(.024, .2, pelo); t.position.set(0, -.12 * s, -.085 * s); t.rotation.x = .2; cabeza.add(t);
      const cinta = cil(.027, .027, .025, mat(a.trenza === true ? 0xd8392b : a.trenza)); cinta.position.set(0, -.24 * s, -.11 * s); cabeza.add(cinta);
    }
    if (a.sombrero) {
      const fieltro = mat(a.sombrero, .9);
      const ala = cil(.175, .175, .012, fieltro, 24); ala.position.y = .085 * s;
      const copa = cil(.072, .088, .1, fieltro, 20); copa.position.y = .14 * s;
      const cinta = cil(.09, .09, .022, mat(a.cinta ?? 0x1a1210), 20); cinta.position.y = .1 * s;
      cabeza.add(ala, copa, cinta);
    } else if (a.gorra) {
      const tela = mat(a.gorra);
      const g = new THREE.Mesh(new THREE.SphereGeometry(.1 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI * .5), tela);
      g.position.y = .03 * s;
      const visera = new THREE.Mesh(new THREE.BoxGeometry(.13 * s, .01 * s, .09 * s), tela);
      visera.position.set(0, .035 * s, .12 * s); visera.rotation.x = .15;
      cabeza.add(g, visera);
    }

    /* Brazos: hombro, codo y mano. */
    this.brazos = [-1, 1].map(lado => {
      const hombro = grupo(lado * .135, .37, 0);
      const brazo = capsula(.035, .13, a.poncho ? mat(a.poncho) : ropa); brazo.position.y = -.09 * s; hombro.add(brazo);
      const codo = grupo(0, -.18, 0);
      const ante = capsula(.032, .12, a.poncho ? mat(a.poncho) : ropa); ante.position.y = -.08 * s; codo.add(ante);
      const mano = esfera(.034, piel, 10); mano.position.y = -.17 * s; codo.add(mano);
      hombro.add(codo); torso.add(hombro);
      return { hombro, codo, mano, lado };
    });

    this.grupo.traverse(m => { if (m.isMesh && m.material !== oscuro) { m.castShadow = true; } });

    // la altura del globo de lo que dice: encima de la cabeza (o del sombrero)
    this.alturaGlobo = this.alturaCadera + (.52 + (a.sombrero ? .22 : .14)) * s;
    this.s = s;
    this.fase = Math.random() * 6;
    this.mira = null;              // un punto del mundo, o nada
    this.tension = 0;              // 0 tranquilo · 1 al borde
    this.gesto = null; this.tGesto = 0; this.durGesto = 0;
    this.lanzado = null;
    this.ang = {};                 // ángulos actuales, que persiguen a los objetivos
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  /* Coloca las piernas según la pose. */
  sentar() {
    for (const { muslo, rodilla } of this.piernas) {
      if (this.pose === 'silla') { muslo.rotation.x = -Math.PI / 2 + .05; rodilla.rotation.x = Math.PI / 2 - .05; }
      else { muslo.rotation.x = -(Math.PI / 2 + .62); rodilla.rotation.x = Math.PI / 2 + .62 + .12; }
      muslo.rotation.z = 0;
    }
    if (this.pose !== 'silla') this.piernas.forEach(({ muslo }, i) => { muslo.rotation.z = (i ? -1 : 1) * .12; });
  }

  boca(cual) {
    for (const [k, m] of Object.entries(this.bocas)) m.visible = k === cual;
    this._boca = cual;
  }

  /* Gestos que duran un rato y vuelven solos a la espera. */
  hacer(gesto, dur) {
    this.gesto = gesto; this.tGesto = 0; this.durGesto = dur;
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

    /* El torso: respira, se inclina sobre la tina con la tensión, se
       echa para atrás al lamentarse y rebota al celebrar. */
    let inclina = .12 + this.tension * .38 + Math.sin(t * 1.3 + this.fase) * .02;
    let rebote = 0;
    if (g === 'celebra') { inclina = -.08; rebote = Math.abs(Math.sin(this.tGesto * 9)) * .05; }
    else if (g === 'lamenta') inclina = -.18 + Math.sin(this.tGesto * 5) * .05;
    else if (g === 'grita') inclina += .06;
    else if (g === 'lanza') inclina = .1 + (k < .45 ? -.12 * (k / .45) : .4 * Math.min(1, (k - .45) / .2));
    this.torso.rotation.x = this._ir('torso', inclina, dt, 6);
    this.cadera.position.y = this.alturaCadera + this._ir('rebote', rebote, dt, 20);
    const respira = 1 + Math.sin(t * 2.1 + this.fase) * .015;
    this.cuerpo.scale.set(1, respira, .78);

    /* La cabeza mira lo que hay que mirar, con tope de cuello. */
    let yaw = Math.sin(t * .4 + this.fase) * .15, pitch = .15;
    if (this.mira) {
      const p = this._v.copy(this.mira);
      this.cabeza.parent.worldToLocal(p);
      p.sub(this.cabeza.position);
      yaw = Math.max(-1, Math.min(1, Math.atan2(p.x, p.z)));
      pitch = Math.max(-.4, Math.min(.75, Math.atan2(-p.y, Math.hypot(p.x, p.z))));
    }
    if (g === 'lamenta') pitch = -.25;
    if (g === 'celebra') pitch = -.3;
    this.cabeza.rotation.y = this._ir('yaw', yaw, dt, 7);
    this.cabeza.rotation.x = this._ir('pitch', pitch, dt, 7);

    // cejas: arriba si hay tensión o grita, juntas si se lamenta
    const sube = (this.tension > .6 || g === 'grita' || g === 'celebra') ? .012 : 0;
    for (const c of this.cejas) {
      c.position.y = this._ir('ceja', .045 * this.s + sube * this.s, dt, 10);
      c.rotation.z = g === 'lamenta' ? c.userData.lado * .35 : 0;
    }

    /* Los brazos: en reposo con las manos en las rodillas; gritando, un
       brazo arriba; celebrando, los dos; lamentando, a la cabeza;
       lanzando, el derecho atrás y luego adelante. */
    for (const b of this.brazos) {
      let hx = this.pose === 'silla' ? -.55 : -.75, hz = b.lado * -.12, cx = -.5;
      if (this.tension > .5) { hx = -.95; cx = -.35; }
      if (g === 'grita' && b.lado === 1) { hx = -2.6 + Math.sin(this.tGesto * 14) * .25; hz = .25; cx = -.4; }
      if (g === 'celebra') { hx = -2.9 + Math.sin(this.tGesto * 12 + b.lado) * .2; hz = b.lado * .35; cx = -.2; }
      if (g === 'lamenta') { hx = -2.5; hz = b.lado * -.75; cx = -2.1; }
      if (g === 'lanza' && b.lado === 1) {
        if (k < .45) { hx = .6 * (k / .45); cx = -.9; }            // atrás, cargando
        else { const r = Math.min(1, (k - .45) / .18); hx = .6 - 2.2 * r; cx = -.9 + .8 * r; } // suelta
        hz = -.1;
      }
      b.hombro.rotation.x = this._ir('hx' + b.lado, hx, dt, g === 'lanza' ? 22 : 9);
      b.hombro.rotation.z = this._ir('hz' + b.lado, hz, dt, 9);
      b.codo.rotation.x = this._ir('cx' + b.lado, cx, dt, g === 'lanza' ? 22 : 9);
    }
    if (g === 'lanza' && this.lanzado && k >= .55) { const f = this.lanzado; this.lanzado = null; f(); }
  }

  /* Dónde va el globo: encima de la cabeza, en el mundo. */
  globo(destino) {
    destino.set(0, this.alturaGlobo + .06, 0);
    return this.grupo.localToWorld(destino);
  }
}
