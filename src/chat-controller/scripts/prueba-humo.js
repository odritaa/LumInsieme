'use strict';

/**
 * Pruebas de humo: no necesitan PostgreSQL ni Redis.
 *
 * Cubren el cableado de modulos, los validadores de entrada, el protocolo
 * WebSocket, la verificacion de JWT y el registro de salas en memoria.
 * Para la logica transaccional (cupo, idempotencia, seq) ver
 * `prueba-integracion.js`, que si requiere base de datos.
 *
 *   npm run prueba
 */

// Se fijan antes de cargar la configuracion: apuntan a servicios inexistentes
// a proposito, para comprobar tambien el comportamiento degradado.
process.env.DATABASE_URL = 'postgres://u:p@127.0.0.1:5432/nada';
process.env.JWT_SECRET = 'secreto-de-prueba-solo-para-humo-1234567890';
process.env.REDIS_URL = 'redis://127.0.0.1:6399';
process.env.LOG_LEVEL = 'error';
process.env.NODE_ENV = 'development';

const assert = require('assert');
const http = require('http');
const path = require('path');

const BASE = path.join(__dirname, '..', 'src');
const jwt = require('jsonwebtoken');

let fallos = 0;
function prueba(nombre, fn) {
  try {
    fn();
    console.log(`  ok   ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.log(`  FALLA ${nombre}\n        ${error.message}`);
  }
}

console.log('\n== 1. Carga de todos los modulos ==');
const modulos = [
  'config/index', 'config/db', 'config/redis',
  'utils/log', 'utils/errores', 'utils/validar',
  'auth/jwt', 'middlewares/auth', 'middlewares/errores', 'middlewares/rateLimit',
  'clients/reunion.client',
  'repositories/grupos.repo', 'repositories/miembros.repo', 'repositories/mensajes.repo',
  'repositories/invitaciones.repo',
  'services/cache.service', 'services/grupos.service', 'services/mensajes.service',
  'services/invitaciones.service', 'services/mantenimiento.service',
  'realtime/protocolo', 'realtime/salas', 'realtime/bus', 'realtime/gateway',
  'routes/chats.routes', 'routes/invitaciones.routes', 'routes/salud.routes',
  'app'
];
for (const m of modulos) {
  prueba(m, () => {
    const cargado = require(path.join(BASE, m));
    assert.ok(cargado, `${m} no exporta nada`);
  });
}

console.log('\n== 2. Validadores ==');
const validar = require(path.join(BASE, 'utils/validar'));

prueba('idEntero rechaza 0 y negativos', () => {
  assert.throws(() => validar.idEntero(0, 'x'));
  assert.throws(() => validar.idEntero(-3, 'x'));
  assert.throws(() => validar.idEntero('abc', 'x'));
  assert.strictEqual(validar.idEntero('42', 'x'), 42);
});

prueba('idEntero rechaza inyeccion tipo "1 OR 1=1"', () => {
  assert.throws(() => validar.idEntero('1 OR 1=1', 'x'));
});

prueba('contenidoMensaje rechaza vacio y solo espacios', () => {
  assert.throws(() => validar.contenidoMensaje('   ', 'c', 2000));
  assert.throws(() => validar.contenidoMensaje('', 'c', 2000));
});

prueba('contenidoMensaje rechaza mensaje de solo caracteres invisibles', () => {
  assert.throws(() => validar.contenidoMensaje('\u200B\u200B\u200B', 'c', 2000));
});

prueba('contenidoMensaje conserva saltos de linea reales', () => {
  assert.strictEqual(validar.contenidoMensaje('hola\nmundo', 'c', 2000), 'hola\nmundo');
});

prueba('contenidoMensaje corta por longitud', () => {
  assert.throws(() => validar.contenidoMensaje('a'.repeat(2001), 'c', 2000));
  assert.strictEqual(validar.contenidoMensaje('a'.repeat(2000), 'c', 2000).length, 2000);
});

prueba('texto colapsa espacios y rechaza nombre invisible', () => {
  assert.strictEqual(validar.texto('  Cine   Club  ', 'n', { min: 1, max: 120 }), 'Cine Club');
  assert.throws(() => validar.texto('\u200B\u200B', 'n', { min: 1, max: 120 }));
});

prueba('uuid acepta v4 y rechaza basura', () => {
  assert.strictEqual(
    validar.uuid('9f1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d', 'id'),
    '9f1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d'
  );
  assert.throws(() => validar.uuid('no-es-uuid', 'id'));
  assert.throws(() => validar.uuid(12345, 'id'));
});

prueba('enteroEnRango respeta limites de cupo', () => {
  assert.throws(() => validar.enteroEnRango(1, 'max', 2, 50));
  assert.throws(() => validar.enteroEnRango(51, 'max', 2, 50));
  assert.strictEqual(validar.enteroEnRango('8', 'max', 2, 50), 8);
});

console.log('\n== 3. Protocolo WebSocket ==');
const protocolo = require(path.join(BASE, 'realtime/protocolo'));

prueba('rechaza JSON invalido', () => {
  assert.throws(() => protocolo.analizar('{no json'));
});

prueba('rechaza array y null en la raiz', () => {
  assert.throws(() => protocolo.analizar('[]'));
  assert.throws(() => protocolo.analizar('null'));
});

prueba('rechaza tipo desconocido', () => {
  assert.throws(() => protocolo.analizar('{"tipo":"borrarTodo"}'));
});

prueba('mensaje exige clientMsgId valido', () => {
  assert.throws(() => protocolo.analizar(JSON.stringify({
    tipo: 'mensaje', chatId: 1, contenido: 'hola'
  })));
});

prueba('mensaje bien formado se normaliza', () => {
  const m = protocolo.analizar(JSON.stringify({
    tipo: 'mensaje',
    chatId: '7',
    contenido: '  hola   ',
    clientMsgId: '9F1B2C3D-4E5F-4A6B-8C9D-0E1F2A3B4C5D'
  }));
  assert.strictEqual(m.chatId, 7);
  assert.strictEqual(m.contenido, 'hola');
  assert.strictEqual(m.clientMsgId, '9f1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d');
});

prueba('suscribir acepta desdeSeq 0 (no lo confunde con ausente)', () => {
  const m = protocolo.analizar(JSON.stringify({ tipo: 'suscribir', chatId: 1, desdeSeq: 0 }));
  assert.strictEqual(m.desdeSeq, 0);
  const sin = protocolo.analizar(JSON.stringify({ tipo: 'suscribir', chatId: 1 }));
  assert.strictEqual(sin.desdeSeq, null);
});

console.log('\n== 4. Autenticacion JWT ==');
const auth = require(path.join(BASE, 'auth/jwt'));
const config = require(path.join(BASE, 'config'));

prueba('acepta token valido y extrae usuarioId de sub', () => {
  const token = jwt.sign({ sub: 99, nombre: 'Audrey' }, config.jwt.secreto, { expiresIn: '1h' });
  const id = auth.verificarToken(token);
  assert.strictEqual(id.usuarioId, 99);
  assert.ok(id.expiraEnMs > Date.now());
});

prueba('rechaza token expirado', () => {
  const token = jwt.sign({ sub: 99 }, config.jwt.secreto, { expiresIn: -10 });
  assert.throws(() => auth.verificarToken(token), /expiro/);
});

prueba('rechaza token firmado con otro secreto', () => {
  const token = jwt.sign({ sub: 99 }, 'otro-secreto-distinto', { expiresIn: '1h' });
  assert.throws(() => auth.verificarToken(token));
});

prueba('rechaza alg:none (ataque de algoritmo nulo)', () => {
  const cabecera = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const carga = Buffer.from(JSON.stringify({ sub: 1 })).toString('base64url');
  assert.throws(() => auth.verificarToken(`${cabecera}.${carga}.`));
});

prueba('rechaza token sin identificador de usuario', () => {
  const token = jwt.sign({ email: 'a@b.c' }, config.jwt.secreto, { expiresIn: '1h' });
  assert.throws(() => auth.verificarToken(token));
});

prueba('extrae token de la cookie de sesion', () => {
  const token = jwt.sign({ sub: 7 }, config.jwt.secreto, { expiresIn: '1h' });
  const req = { headers: { cookie: `otra=x; ${config.jwt.nombreCookie}=${token}; mas=y` } };
  assert.strictEqual(auth.extraerToken(req), token);
});

prueba('extrae token del header Authorization', () => {
  const req = { headers: { authorization: 'Bearer abc.def.ghi' } };
  assert.strictEqual(auth.extraerToken(req), 'abc.def.ghi');
});

console.log('\n== 5. Registro de salas en memoria ==');
const salas = require(path.join(BASE, 'realtime/salas'));

function socketFalso(usuarioId) {
  return { estado: { usuarioId, suscripciones: new Set(), conectadoEn: Date.now() } };
}

prueba('eliminarConexion no deja restos (sin fugas de memoria)', () => {
  const s1 = socketFalso(1);
  const s2 = socketFalso(2);
  salas.registrarConexion(s1);
  salas.registrarConexion(s2);
  salas.suscribir(s1, 10);
  salas.suscribir(s2, 10);
  assert.strictEqual(salas.socketsDeChat(10).size, 2);

  salas.eliminarConexion(s1);
  assert.strictEqual(salas.socketsDeChat(10).size, 1);

  salas.eliminarConexion(s2);
  assert.strictEqual(salas.socketsDeChat(10).size, 0);
  assert.deepStrictEqual(salas.metricas(), { sockets: 0, usuarios: 0, chats: 0 });
});

prueba('dos pestanas del mismo usuario cuentan como un usuario presente', () => {
  const a = socketFalso(5);
  const b = socketFalso(5);
  salas.registrarConexion(a);
  salas.registrarConexion(b);
  salas.suscribir(a, 20);
  salas.suscribir(b, 20);
  assert.deepStrictEqual(Array.from(salas.usuariosLocalesEnChat(20)), [5]);

  salas.eliminarConexion(a);
  assert.strictEqual(salas.usuariosLocalesEnChat(20).has(5), true, 'sigue presente con la otra pestana');

  salas.eliminarConexion(b);
  assert.strictEqual(salas.usuariosLocalesEnChat(20).has(5), false);
});

prueba('respeta el tope de suscripciones por conexion', () => {
  const s = socketFalso(9);
  salas.registrarConexion(s);
  const tope = config.websocket.maxSuscripcionesPorConexion;
  for (let i = 0; i < tope; i += 1) {
    assert.strictEqual(salas.suscribir(s, 1000 + i), true);
  }
  assert.strictEqual(salas.suscribir(s, 9999), false, 'deberia rechazar pasado el tope');
  salas.eliminarConexion(s);
});

console.log('\n== 6. Enrutado de eventos en tiempo real ==');
const gateway = require(path.join(BASE, 'realtime/gateway'));
const { DESTINO, SALIENTE } = require(path.join(BASE, 'realtime/protocolo'));

// Socket falso con lo minimo que usa `enviar()`.
function socketEspia(usuarioId) {
  const recibidos = [];
  return {
    OPEN: 1,
    readyState: 1,
    bufferedAmount: 0,
    send: (datos, cb) => { recibidos.push(JSON.parse(datos)); if (cb) cb(); },
    recibidos,
    estado: { usuarioId, suscripciones: new Set(), conectadoEn: Date.now() }
  };
}

const pruebasAsync = [];
function pruebaAsync(nombre, fn) { pruebasAsync.push([nombre, fn]); }

pruebaAsync('un evento de chat llega solo a los suscritos a ese chat', async () => {
  const dentro = socketEspia(1);
  const fuera = socketEspia(2);
  salas.registrarConexion(dentro);
  salas.registrarConexion(fuera);
  salas.suscribir(dentro, 500);

  // Con Redis caido, difundir cae al camino local: es el que se ejercita aca.
  await gateway.difundir(500, { tipo: SALIENTE.MENSAJE, chatId: 500, mensaje: { seq: 1 } });

  assert.strictEqual(dentro.recibidos.length, 1, 'el suscrito no recibio el mensaje');
  assert.strictEqual(fuera.recibidos.length, 0, 'lo recibio alguien que no estaba suscrito');

  salas.eliminarConexion(dentro);
  salas.eliminarConexion(fuera);
});

pruebaAsync('una invitacion llega a quien NO pertenece a ningun chat', async () => {
  // Es el caso que justifica el canal por usuario: el invitado todavia no es
  // miembro, asi que por la sala del chat no le llegaria nada.
  const invitado = socketEspia(77);
  const ajeno = socketEspia(88);
  salas.registrarConexion(invitado);
  salas.registrarConexion(ajeno);
  assert.strictEqual(invitado.estado.suscripciones.size, 0, 'el invitado no deberia estar suscrito a nada');

  await gateway.notificarUsuario(77, {
    tipo: SALIENTE.INVITACION,
    accion: 'recibida',
    invitacion: { id: 9, chat: { id: 500, nombre: 'Cine Club' } }
  });

  assert.strictEqual(invitado.recibidos.length, 1, 'el invitado no recibio el aviso');
  assert.strictEqual(invitado.recibidos[0].tipo, 'invitacion');
  assert.strictEqual(invitado.recibidos[0].accion, 'recibida');
  assert.strictEqual(ajeno.recibidos.length, 0, 'el aviso se filtro a otro usuario');

  salas.eliminarConexion(invitado);
  salas.eliminarConexion(ajeno);
});

pruebaAsync('el aviso llega a todas las pestanas del invitado', async () => {
  const pestana1 = socketEspia(99);
  const pestana2 = socketEspia(99);
  salas.registrarConexion(pestana1);
  salas.registrarConexion(pestana2);

  await gateway.notificarUsuario(99, { tipo: SALIENTE.INVITACION, accion: 'cancelada', invitacionId: 3 });

  assert.strictEqual(pestana1.recibidos.length, 1);
  assert.strictEqual(pestana2.recibidos.length, 1);

  salas.eliminarConexion(pestana1);
  salas.eliminarConexion(pestana2);
});

pruebaAsync('la baja de un miembro corta su suscripcion al chat', async () => {
  const echado = socketEspia(11);
  const queda = socketEspia(12);
  salas.registrarConexion(echado);
  salas.registrarConexion(queda);
  salas.suscribir(echado, 600);
  salas.suscribir(queda, 600);

  await gateway.difundir(600, {
    tipo: SALIENTE.MIEMBRO, chatId: 600, usuarioId: 11, accion: 'baja', miembrosActivos: 1
  });

  // Recibe DOS marcos y en este orden: primero la confirmacion de su propia
  // baja, despues el aviso de que se le corto la suscripcion. Al reves se
  // quedaria sin enterarse de por que dejo de recibir mensajes.
  assert.strictEqual(echado.recibidos.length, 2, 'deberia recibir la baja y el corte de suscripcion');
  assert.strictEqual(echado.recibidos[0].tipo, SALIENTE.MIEMBRO);
  assert.strictEqual(echado.recibidos[0].accion, 'baja');
  assert.strictEqual(echado.recibidos[1].tipo, SALIENTE.DESUSCRITO);

  assert.strictEqual(salas.socketsDeChat(600).has(echado), false, 'sigue suscrito tras la baja');
  assert.strictEqual(salas.socketsDeChat(600).has(queda), true, 'se desuscribio a quien no correspondia');

  // Un mensaje posterior ya no le llega: es la garantia de que un expulsado
  // deja de ver la conversacion.
  await gateway.difundir(600, { tipo: SALIENTE.MENSAJE, chatId: 600, mensaje: { seq: 2 } });
  assert.strictEqual(echado.recibidos.length, 2, 'sigue recibiendo mensajes despues de la baja');
  assert.strictEqual(queda.recibidos.length, 2, 'quien se queda deberia haber recibido ambos eventos');

  salas.eliminarConexion(echado);
  salas.eliminarConexion(queda);
});

pruebaAsync('DESTINO distingue los dos canales del bus', async () => {
  assert.strictEqual(DESTINO.CHAT, 'chat');
  assert.strictEqual(DESTINO.USUARIO, 'usuario');
});

const { crearApp } = require(path.join(BASE, 'app'));

async function pedir(servidor, ruta, opciones = {}) {
  const puerto = servidor.address().port;
  const respuesta = await fetch(`http://127.0.0.1:${puerto}${ruta}`, opciones);
  const cuerpo = await respuesta.text();
  let json = null;
  try { json = JSON.parse(cuerpo); } catch (_) { /* no json */ }
  return { estado: respuesta.status, json, cuerpo };
}

(async () => {
  for (const [nombre, fn] of pruebasAsync) {
    try {
      await fn();
      console.log(`  ok   ${nombre}`);
    } catch (error) {
      fallos += 1;
      console.log(`  FALLA ${nombre}\n        ${error.message}`);
    }
  }

  console.log('\n== 7. App HTTP (cableado de middlewares) ==');

  const servidor = http.createServer(crearApp());
  await new Promise((r) => servidor.listen(0, r));

  const casos = [];
  const chequear = (nombre, condicion, detalle) => {
    if (condicion) { console.log(`  ok   ${nombre}`); }
    else { fallos += 1; console.log(`  FALLA ${nombre}\n        ${detalle}`); }
    casos.push(nombre);
  };

  const salud = await pedir(servidor, '/salud');
  chequear('GET /salud responde 200 sin tocar la base',
    salud.estado === 200 && salud.json?.estado === 'ok', JSON.stringify(salud));

  const sinAuth = await pedir(servidor, '/api/chats');
  chequear('GET /api/chats sin sesion responde 401',
    sinAuth.estado === 401 && sinAuth.json?.error?.codigo === 'NO_AUTENTICADO', JSON.stringify(sinAuth));

  const inexistente = await pedir(servidor, '/api/no-existe');
  chequear('ruta inexistente responde 404 en JSON',
    inexistente.estado === 404 && inexistente.json?.error?.codigo === 'NO_ENCONTRADO', JSON.stringify(inexistente));

  const token = jwt.sign({ sub: 42 }, config.jwt.secreto, { expiresIn: '1h' });

  const jsonRoto = await pedir(servidor, '/api/chats', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${config.jwt.nombreCookie}=${token}` },
    body: '{roto'
  });
  chequear('cuerpo JSON malformado responde 400 y no 500',
    jsonRoto.estado === 400, JSON.stringify(jsonRoto));

  const cupoInvalido = await pedir(servidor, '/api/chats', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${config.jwt.nombreCookie}=${token}` },
    body: JSON.stringify({ nombre: 'Grupo', maxMiembros: 999 })
  });
  chequear('maxMiembros fuera de rango responde 400 antes de tocar la base',
    cupoInvalido.estado === 400 && cupoInvalido.json?.error?.codigo === 'SOLICITUD_INVALIDA',
    JSON.stringify(cupoInvalido));

  const sinNombre = await pedir(servidor, '/api/chats', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${config.jwt.nombreCookie}=${token}` },
    body: JSON.stringify({ maxMiembros: 5 })
  });
  chequear('nombre ausente responde 400',
    sinNombre.estado === 400, JSON.stringify(sinNombre));

  const tokenMalo = await pedir(servidor, '/api/chats', {
    headers: { cookie: `${config.jwt.nombreCookie}=token.falsificado.aca` }
  });
  chequear('cookie con token falsificado responde 401',
    tokenMalo.estado === 401, JSON.stringify(tokenMalo));

  const agregarTercero = await pedir(servidor, '/api/chats/1/miembros', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${config.jwt.nombreCookie}=${token}` },
    body: JSON.stringify({ usuarioId: 777 })
  });
  chequear('agregar a un tercero responde 403 sin tocar la base',
    agregarTercero.estado === 403 && agregarTercero.json?.error?.codigo === 'PROHIBIDO',
    JSON.stringify(agregarTercero));

  const invitacionesSinAuth = await pedir(servidor, '/api/invitaciones');
  chequear('GET /api/invitaciones sin sesion responde 401',
    invitacionesSinAuth.estado === 401, JSON.stringify(invitacionesSinAuth));

  const listo = await pedir(servidor, '/salud/listo');
  chequear('GET /salud/listo responde 503 con PostgreSQL caido',
    listo.estado === 503 && listo.json?.estado === 'no-listo', JSON.stringify(listo));

  servidor.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log(fallos === 0 ? 'TODAS LAS PRUEBAS PASARON' : `${fallos} PRUEBA(S) FALLARON`);
  console.log('='.repeat(60));
  process.exit(fallos === 0 ? 0 : 1);
})();
