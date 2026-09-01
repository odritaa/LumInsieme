'use strict';

/**
 * Pruebas de integracion contra PostgreSQL real.
 *
 * Verifican lo que no se puede comprobar en memoria: el respeto del cupo bajo
 * concurrencia, la idempotencia de los reintentos y que `seq` quede sin huecos
 * y en el orden correcto. Requieren la base levantada y el esquema aplicado:
 *
 *   docker compose up -d
 *   npm run migrar
 *   npm run prueba:integracion
 *
 * Crea sus propios grupos y los borra al terminar (ON DELETE CASCADE limpia
 * miembros y mensajes).
 */

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');

const config = require('../src/config');
const db = require('../src/config/db');
const gruposService = require('../src/services/grupos.service');
const mensajesService = require('../src/services/mensajes.service');
const invitacionesService = require('../src/services/invitaciones.service');
const mantenimiento = require('../src/services/mantenimiento.service');
const migrador = require('./migrar');
const mensajesRepo = require('../src/repositories/mensajes.repo');
const miembrosRepo = require('../src/repositories/miembros.repo');

const gruposCreados = [];
let fallos = 0;

// Ids de usuario ficticios, fuera del rango que usaria la app real.
const U = (n) => 900000 + n;

async function prueba(nombre, fn) {
  try {
    await fn();
    console.log(`  ok   ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.log(`  FALLA ${nombre}\n        ${error.message}`);
  }
}

/**
 * Levanta un reunion-controller falso y apunta la configuracion hacia el
 * mientras corre `fn`. `falso.modo` decide como responde en cada caso.
 */
async function conReunionSimulado(fn) {
  const falso = { modo: 'existe', pedidos: [] };

  const servidor = http.createServer((req, res) => {
    falso.pedidos.push(req.url);
    if (falso.modo === 'colgado') return; // nunca responde: dispara el timeout
    if (falso.modo === 'no-existe') { res.writeHead(404).end('{}'); return; }
    if (falso.modo === 'error') { res.writeHead(500).end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 4242, titulo: 'Funcion de prueba' }));
  });

  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));

  const previo = config.reunion.url;
  const previoTimeout = config.reunion.timeoutMs;
  config.reunion.url = `http://127.0.0.1:${servidor.address().port}`;
  config.reunion.timeoutMs = 400;

  try {
    await fn(falso);
  } finally {
    config.reunion.url = previo;
    config.reunion.timeoutMs = previoTimeout;
    // closeAllConnections evita que el socket colgado impida cerrar el servidor.
    servidor.closeAllConnections?.();
    await new Promise((r) => servidor.close(r));
  }
}

async function crearGrupo(nombre, maxMiembros, creadorId) {
  const { grupo } = await gruposService.crear({ nombre, maxMiembros, eventoId: null, creadorId });
  gruposCreados.push(grupo.id);
  return grupo;
}

async function principal() {
  await db.verificarConexion();
  console.log('\n== Integracion contra PostgreSQL ==\n');

  // -------------------------------------------------------------------------
  await prueba('el cupo se respeta con altas simultaneas (no hay sobrecupo)', async () => {
    const grupo = await crearGrupo('Cupo bajo carrera', 3, U(1));

    // 8 personas intentan entrar a la vez en un grupo de 3 (el creador ya ocupa
    // un lugar): deben entrar exactamente 2 y fallar 6 con CUPO_LLENO.
    const intentos = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        gruposService.unirse({ chatId: grupo.id, usuarioId: U(10 + i) })
      )
    );

    const exitosos = intentos.filter((r) => r.status === 'fulfilled').length;
    const porCupo = intentos.filter(
      (r) => r.status === 'rejected' && r.reason.codigo === 'CUPO_LLENO'
    ).length;

    assert.strictEqual(exitosos, 2, `entraron ${exitosos}, se esperaban 2`);
    assert.strictEqual(porCupo, 6, `rechazados por cupo ${porCupo}, se esperaban 6`);

    const activos = await miembrosRepo.contarActivos(grupo.id);
    assert.strictEqual(activos, 3, `el grupo quedo con ${activos} miembros y el maximo era 3`);
  });

  // -------------------------------------------------------------------------
  await prueba('reintentar con el mismo clientMsgId no duplica el mensaje', async () => {
    const grupo = await crearGrupo('Idempotencia', 5, U(2));
    const clientMsgId = crypto.randomUUID();

    const primero = await mensajesService.publicar({
      chatId: grupo.id, autorId: U(2), contenido: 'nos vemos a las 20', clientMsgId
    });
    const reintento = await mensajesService.publicar({
      chatId: grupo.id, autorId: U(2), contenido: 'nos vemos a las 20', clientMsgId
    });

    assert.strictEqual(primero.duplicado, false);
    assert.strictEqual(reintento.duplicado, true, 'el reintento deberia detectarse como duplicado');
    assert.strictEqual(reintento.mensaje.id, primero.mensaje.id, 'deberia devolver el mismo mensaje');
    assert.strictEqual(reintento.mensaje.seq, primero.mensaje.seq, 'no debe consumir un seq nuevo');
  });

  // -------------------------------------------------------------------------
  await prueba('dos envios simultaneos con el mismo UUID producen un solo mensaje', async () => {
    const grupo = await crearGrupo('Idempotencia concurrente', 5, U(3));
    const clientMsgId = crypto.randomUUID();

    const resultados = await Promise.all([
      mensajesService.publicar({ chatId: grupo.id, autorId: U(3), contenido: 'doble click', clientMsgId }),
      mensajesService.publicar({ chatId: grupo.id, autorId: U(3), contenido: 'doble click', clientMsgId })
    ]);

    const ids = new Set(resultados.map((r) => r.mensaje.id));
    assert.strictEqual(ids.size, 1, 'se crearon dos mensajes distintos para el mismo UUID');
    assert.strictEqual(resultados.filter((r) => r.duplicado).length, 1);
  });

  // -------------------------------------------------------------------------
  await prueba('seq queda correlativa y sin huecos con envios concurrentes', async () => {
    const grupo = await crearGrupo('Orden de seq', 10, U(4));
    for (let i = 0; i < 5; i += 1) {
      await gruposService.unirse({ chatId: grupo.id, usuarioId: U(40 + i) });
    }

    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        mensajesService.publicar({
          chatId: grupo.id,
          autorId: U(40 + (i % 5)),
          contenido: `mensaje ${i}`,
          clientMsgId: crypto.randomUUID()
        })
      )
    );

    const { rows } = await db.consultar(
      'SELECT seq FROM chat_mensajes WHERE chat_id = $1 ORDER BY seq ASC',
      [grupo.id]
    );
    const seqs = rows.map((f) => f.seq);

    assert.strictEqual(new Set(seqs).size, seqs.length, 'hay seq repetidos');
    for (let i = 0; i < seqs.length; i += 1) {
      assert.strictEqual(seqs[i], i + 1, `hueco en seq: se esperaba ${i + 1} y hay ${seqs[i]}`);
    }
  });

  // -------------------------------------------------------------------------
  await prueba('la paginacion por keyset recorre el historial sin saltos ni repeticiones', async () => {
    const grupo = await crearGrupo('Paginacion', 5, U(5));
    for (let i = 0; i < 25; i += 1) {
      await mensajesService.publicar({
        chatId: grupo.id, autorId: U(5), contenido: `linea ${i}`, clientMsgId: crypto.randomUUID()
      });
    }

    const vistos = [];
    let cursor = null;
    for (let pagina = 0; pagina < 10; pagina += 1) {
      const lote = await mensajesRepo.historial(grupo.id, { antesDe: cursor, limite: 7 });
      if (lote.length === 0) break;
      vistos.push(...lote.map((m) => m.seq));
      cursor = lote[0].seq;
    }

    const { rows } = await db.consultar(
      'SELECT count(*)::int AS total FROM chat_mensajes WHERE chat_id = $1', [grupo.id]
    );

    assert.strictEqual(new Set(vistos).size, vistos.length, 'la paginacion repitio mensajes');
    assert.strictEqual(vistos.length, rows[0].total, 'la paginacion se salteo mensajes');
  });

  // -------------------------------------------------------------------------
  await prueba('quien salio del grupo no puede seguir escribiendo', async () => {
    const grupo = await crearGrupo('Baja', 5, U(6));
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(60) });
    await gruposService.salir({ chatId: grupo.id, usuarioId: U(60) });

    await assert.rejects(
      mensajesService.publicar({
        chatId: grupo.id, autorId: U(60), contenido: 'sigo aca?', clientMsgId: crypto.randomUUID()
      }),
      (error) => error.codigo === 'NO_ENCONTRADO'
    );
  });

  // -------------------------------------------------------------------------
  await prueba('quien no es miembro no puede leer el historial', async () => {
    const grupo = await crearGrupo('Privacidad', 5, U(7));
    await assert.rejects(
      mensajesService.historial({ chatId: grupo.id, usuarioId: U(999), antesDe: null, limite: 10 }),
      (error) => error.codigo === 'NO_ENCONTRADO'
    );
  });

  // -------------------------------------------------------------------------
  await prueba('el reingreso reactiva la membresia sin duplicar la fila', async () => {
    const grupo = await crearGrupo('Reingreso', 5, U(8));
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(80) });
    await gruposService.salir({ chatId: grupo.id, usuarioId: U(80) });
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(80) });

    const { rows } = await db.consultar(
      'SELECT count(*)::int AS total FROM chat_miembros WHERE chat_id = $1 AND usuario_id = $2',
      [grupo.id, U(80)]
    );
    assert.strictEqual(rows[0].total, 1, 'se duplico la fila de membresia');

    const miembro = await miembrosRepo.obtener(grupo.id, U(80));
    assert.strictEqual(miembro.activo, true);
  });

  // -------------------------------------------------------------------------
  await prueba('el cursor de leido nunca retrocede (ACK fuera de orden)', async () => {
    const grupo = await crearGrupo('Cursor de lectura', 5, U(9));
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(90) });

    await mensajesService.marcarLeido({ chatId: grupo.id, usuarioId: U(90), seq: 10 });
    const tarde = await mensajesService.marcarLeido({ chatId: grupo.id, usuarioId: U(90), seq: 4 });

    assert.strictEqual(tarde.ultimoLeidoSeq, 10, 'un ACK atrasado hizo retroceder el cursor');
  });

  // -------------------------------------------------------------------------
  await prueba('los mensajes sobreviven mientras quede al menos un miembro', async () => {
    const grupo = await crearGrupo('Persistencia', 3, U(11));
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(110) });
    await mensajesService.publicar({
      chatId: grupo.id, autorId: U(110), contenido: 'quedamos en el Gaumont', clientMsgId: crypto.randomUUID()
    });

    // Se va uno solo: la conversacion queda intacta. Esto es lo que garantiza
    // el requisito de que los mensajes sobrevivan al cierre de las sesiones.
    await gruposService.salir({ chatId: grupo.id, usuarioId: U(110) });

    const texto = await mensajesRepo.historial(grupo.id, { antesDe: null, limite: 50 });
    assert.ok(
      texto.some((m) => m.contenido === 'quedamos en el Gaumont'),
      'el mensaje ya no se puede recuperar'
    );
  });

  // -------------------------------------------------------------------------
  await prueba('si se va el ultimo admin, se designa a otro miembro al azar', async () => {
    const grupo = await crearGrupo('Traspaso de admin', 5, U(12));
    for (let i = 0; i < 3; i += 1) {
      await gruposService.unirse({ chatId: grupo.id, usuarioId: U(120 + i) });
    }

    const salida = await gruposService.salir({ chatId: grupo.id, usuarioId: U(12) });

    assert.ok(salida.nuevoAdmin, 'no se designo un nuevo administrador');
    assert.ok(
      [U(120), U(121), U(122)].includes(salida.nuevoAdmin.usuarioId),
      'el nuevo admin no es uno de los miembros restantes'
    );

    const admins = await db.consultar(
      `SELECT usuario_id FROM chat_miembros
        WHERE chat_id = $1 AND salio_en IS NULL AND rol = 'admin'`,
      [grupo.id]
    );
    assert.strictEqual(admins.rows.length, 1, `quedaron ${admins.rows.length} admins, se esperaba 1`);
    assert.strictEqual(admins.rows[0].usuario_id, salida.nuevoAdmin.usuarioId);
  });

  // -------------------------------------------------------------------------
  await prueba('no se designa un admin nuevo si el que se va no era el ultimo', async () => {
    const grupo = await crearGrupo('Admin que sobra', 5, U(13));
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(130) });
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(131) });

    // Se asciende a mano a un segundo admin.
    await db.consultar(
      `UPDATE chat_miembros SET rol = 'admin' WHERE chat_id = $1 AND usuario_id = $2`,
      [grupo.id, U(130)]
    );

    const salida = await gruposService.salir({ chatId: grupo.id, usuarioId: U(13) });
    assert.strictEqual(salida.nuevoAdmin, null, 'no deberia ascender a nadie: ya habia otro admin');
  });

  // -------------------------------------------------------------------------
  await prueba('cuando se va el ultimo miembro, el grupo se elimina por completo', async () => {
    const grupo = await crearGrupo('Grupo que se vacia', 3, U(14));
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(140) });
    await mensajesService.publicar({
      chatId: grupo.id, autorId: U(140), contenido: 'me voy', clientMsgId: crypto.randomUUID()
    });

    await gruposService.salir({ chatId: grupo.id, usuarioId: U(140) });
    const ultima = await gruposService.salir({ chatId: grupo.id, usuarioId: U(14) });

    assert.strictEqual(ultima.grupoEliminado, true, 'el grupo deberia haberse eliminado');

    // El ON DELETE CASCADE tiene que arrastrar mensajes, miembros e invitaciones.
    for (const tabla of ['chat_grupos', 'chat_miembros', 'chat_mensajes', 'chat_invitaciones']) {
      const columna = tabla === 'chat_grupos' ? 'id' : 'chat_id';
      const { rows } = await db.consultar(
        `SELECT count(*)::int AS total FROM ${tabla} WHERE ${columna} = $1`, [grupo.id]
      );
      assert.strictEqual(rows[0].total, 0, `quedaron ${rows[0].total} filas huerfanas en ${tabla}`);
    }
  });

  // -------------------------------------------------------------------------
  await prueba('nadie puede sumar a un tercero: la invitacion la acepta el invitado', async () => {
    const grupo = await crearGrupo('Consentimiento', 5, U(15));

    const { invitacion } = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(150), invitadorId: U(15)
    });

    // Invitar NO da de alta: hasta que no acepte, no es miembro.
    const antes = await miembrosRepo.obtener(grupo.id, U(150));
    assert.strictEqual(antes, null, 'la invitacion dio de alta sin consentimiento');
    assert.strictEqual(invitacion.estado, 'pendiente');

    const pendientes = await invitacionesService.misPendientes(U(150));
    assert.strictEqual(pendientes.length, 1);
    assert.strictEqual(pendientes[0].chat.id, grupo.id);

    await invitacionesService.aceptar({ invitacionId: invitacion.id, usuarioId: U(150) });

    const despues = await miembrosRepo.obtener(grupo.id, U(150));
    assert.ok(despues && despues.activo, 'aceptar no dio de alta al invitado');
  });

  // -------------------------------------------------------------------------
  await prueba('cualquier miembro puede invitar, no solo el administrador', async () => {
    const grupo = await crearGrupo('Invita cualquiera', 5, U(16));
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(160) });

    const miembro = await miembrosRepo.obtener(grupo.id, U(160));
    assert.strictEqual(miembro.rol, 'miembro', 'el invitador no deberia ser admin');

    const { invitacion } = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(161), invitadorId: U(160)
    });
    assert.strictEqual(invitacion.estado, 'pendiente');
  });

  // -------------------------------------------------------------------------
  await prueba('quien no es miembro no puede invitar', async () => {
    const grupo = await crearGrupo('Invitacion ajena', 5, U(17));
    await assert.rejects(
      invitacionesService.invitar({ chatId: grupo.id, invitadoId: U(171), invitadorId: U(999) }),
      (e) => e.codigo === 'NO_ENCONTRADO'
    );
  });

  // -------------------------------------------------------------------------
  await prueba('una invitacion rechazada no se puede aceptar despues', async () => {
    const grupo = await crearGrupo('Rechazo', 5, U(18));
    const { invitacion } = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(180), invitadorId: U(18)
    });

    await invitacionesService.rechazar({ invitacionId: invitacion.id, usuarioId: U(180) });

    await assert.rejects(
      invitacionesService.aceptar({ invitacionId: invitacion.id, usuarioId: U(180) }),
      (e) => e.codigo === 'CONFLICTO'
    );
    assert.strictEqual(await miembrosRepo.obtener(grupo.id, U(180)), null);
  });

  // -------------------------------------------------------------------------
  await prueba('nadie puede aceptar una invitacion dirigida a otra persona', async () => {
    const grupo = await crearGrupo('Invitacion robada', 5, U(19));
    const { invitacion } = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(190), invitadorId: U(19)
    });

    await assert.rejects(
      invitacionesService.aceptar({ invitacionId: invitacion.id, usuarioId: U(191) }),
      (e) => e.codigo === 'NO_ENCONTRADO'
    );
    assert.strictEqual(await miembrosRepo.obtener(grupo.id, U(191)), null);
  });

  // -------------------------------------------------------------------------
  // Validacion de evento_id contra el reunion-controller, simulado con un
  // servidor falso que puede responder 200, 404, 500 o directamente colgarse.
  // -------------------------------------------------------------------------
  await conReunionSimulado(async (falso) => {
    await prueba('con el evento existente, el chat se crea', async () => {
      falso.modo = 'existe';
      const { grupo } = await gruposService.crear({
        nombre: 'Chat con evento', maxMiembros: 4, eventoId: 4242, creadorId: U(21), token: 'tok'
      });
      gruposCreados.push(grupo.id);
      assert.strictEqual(grupo.eventoId, 4242);
      assert.ok(falso.pedidos.some((p) => p.includes('/api/eventos/4242')), 'no se consulto al servicio');
    });

    await prueba('con el evento inexistente, la creacion se rechaza con 400', async () => {
      falso.modo = 'no-existe';
      await assert.rejects(
        gruposService.crear({
          nombre: 'Chat fantasma', maxMiembros: 4, eventoId: 9999, creadorId: U(22), token: 'tok'
        }),
        (e) => e.codigo === 'SOLICITUD_INVALIDA' && e.estado === 400
      );
    });

    await prueba('si el servicio de eventos no responde, se falla con 503 y no se crea el chat', async () => {
      falso.modo = 'colgado';
      await assert.rejects(
        gruposService.crear({
          nombre: 'Chat sin validar', maxMiembros: 4, eventoId: 7777, creadorId: U(23), token: 'tok'
        }),
        (e) => e.estado === 503 && e.codigo === 'SERVICIO_EVENTOS_NO_DISPONIBLE'
      );

      const { rows } = await db.consultar(
        'SELECT count(*)::int AS total FROM chat_grupos WHERE evento_id = $1', [7777]
      );
      assert.strictEqual(rows[0].total, 0, 'se creo el chat pese a no poder validar el evento');
    });

    await prueba('un chat sin evento no consulta al reunion-controller', async () => {
      falso.modo = 'colgado';
      const antes = falso.pedidos.length;
      const { grupo } = await gruposService.crear({
        nombre: 'Chat suelto', maxMiembros: 4, eventoId: null, creadorId: U(24), token: 'tok'
      });
      gruposCreados.push(grupo.id);
      assert.strictEqual(falso.pedidos.length, antes, 'consulto al servicio sin necesidad');
    });
  });

  await prueba('sin REUNION_SERVICE_URL configurada, la validacion se omite', async () => {
    const previo = config.reunion.url;
    config.reunion.url = null;
    try {
      const { grupo } = await gruposService.crear({
        nombre: 'Sin validacion', maxMiembros: 4, eventoId: 123456, creadorId: U(25), token: null
      });
      gruposCreados.push(grupo.id);
      assert.strictEqual(grupo.eventoId, 123456);
    } finally {
      config.reunion.url = previo;
    }
  });

  // -------------------------------------------------------------------------
  await prueba('la purga borra las invitaciones vencidas y libera el indice unico', async () => {
    const grupo = await crearGrupo('Purga de vencidas', 5, U(30));
    const { invitacion } = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(300), invitadorId: U(30)
    });

    // Se la envejece a mano para no esperar 7 dias.
    await db.consultar(
      "UPDATE chat_invitaciones SET expira_en = now() - INTERVAL '1 hour' WHERE id = $1",
      [invitacion.id]
    );

    // Mientras la fila existe, el indice unico parcial impide volver a invitar.
    await assert.rejects(
      invitacionesService.invitar({ chatId: grupo.id, invitadoId: U(300), invitadorId: U(30) }),
      (e) => e.codigo === 'CONFLICTO',
      'deberia chocar con la invitacion vencida que sigue en la tabla'
    );

    const resultado = await mantenimiento.purgarInvitaciones();
    assert.ok(resultado, 'la purga no se ejecuto (no pudo tomar el lock)');
    assert.ok(resultado.vencidas >= 1, `se borraron ${resultado.vencidas} vencidas, se esperaba al menos 1`);

    const { rows } = await db.consultar(
      'SELECT count(*)::int AS total FROM chat_invitaciones WHERE id = $1', [invitacion.id]
    );
    assert.strictEqual(rows[0].total, 0, 'la invitacion vencida sigue en la tabla');

    // Y ahora si se puede volver a invitar a la misma persona.
    const reintento = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(300), invitadorId: U(30)
    });
    assert.strictEqual(reintento.invitacion.estado, 'pendiente');
  });

  // -------------------------------------------------------------------------
  await prueba('la purga respeta la retencion de las invitaciones resueltas', async () => {
    const grupo = await crearGrupo('Retencion', 5, U(31));

    const reciente = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(310), invitadorId: U(31)
    });
    await invitacionesService.rechazar({ invitacionId: reciente.invitacion.id, usuarioId: U(310) });

    const antigua = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(311), invitadorId: U(31)
    });
    await invitacionesService.rechazar({ invitacionId: antigua.invitacion.id, usuarioId: U(311) });
    await db.consultar(
      `UPDATE chat_invitaciones SET respondida_en = now() - ($2 || ' days')::interval WHERE id = $1`,
      [antigua.invitacion.id, String(config.mantenimiento.retencionInvitacionesDias + 1)]
    );

    await mantenimiento.purgarInvitaciones();

    const quedaReciente = await db.consultar(
      'SELECT count(*)::int AS total FROM chat_invitaciones WHERE id = $1', [reciente.invitacion.id]
    );
    const quedaAntigua = await db.consultar(
      'SELECT count(*)::int AS total FROM chat_invitaciones WHERE id = $1', [antigua.invitacion.id]
    );

    assert.strictEqual(quedaReciente.rows[0].total, 1, 'borro una invitacion dentro del periodo de retencion');
    assert.strictEqual(quedaAntigua.rows[0].total, 0, 'no borro la invitacion fuera de retencion');
  });

  // -------------------------------------------------------------------------
  await prueba('las migraciones quedan registradas y son idempotentes', async () => {
    const { rows } = await db.consultar('SELECT version, checksum FROM schema_migraciones ORDER BY version');
    assert.ok(rows.length >= 2, `solo hay ${rows.length} migraciones registradas`);
    assert.ok(rows.every((f) => f.checksum && f.checksum.length === 16), 'falta el checksum de alguna');

    // Volver a migrar no debe aplicar nada ni fallar.
    const segunda = await migrador.migrar();
    assert.strictEqual(segunda.aplicadas.length, 0, 're-aplico migraciones ya aplicadas');
    assert.strictEqual(segunda.total, rows.length);
  });

  // -------------------------------------------------------------------------
  await prueba('editar una migracion ya aplicada se detecta y se rechaza', async () => {
    // Se altera el checksum guardado para simular que el archivo cambio.
    const { rows } = await db.consultar(
      'SELECT version, checksum FROM schema_migraciones ORDER BY version LIMIT 1'
    );
    const original = rows[0];

    await db.consultar(
      "UPDATE schema_migraciones SET checksum = 'cafecafecafecafe' WHERE version = $1",
      [original.version]
    );

    try {
      await assert.rejects(
        migrador.migrar(),
        (e) => /cambio despues de haberse aplicado/.test(e.message),
        'la migracion modificada deberia cortar el arranque'
      );
    } finally {
      await db.consultar(
        'UPDATE schema_migraciones SET checksum = $2 WHERE version = $1',
        [original.version, original.checksum]
      );
    }
  });

  // -------------------------------------------------------------------------
  await prueba('unirse por cuenta propia cierra la invitacion pendiente', async () => {
    const grupo = await crearGrupo('Invitacion redundante', 5, U(20));
    const { invitacion } = await invitacionesService.invitar({
      chatId: grupo.id, invitadoId: U(200), invitadorId: U(20)
    });

    // Los grupos son abiertos: puede entrar sin usar la invitacion.
    await gruposService.unirse({ chatId: grupo.id, usuarioId: U(200) });

    const pendientes = await invitacionesService.misPendientes(U(200));
    assert.strictEqual(
      pendientes.filter((i) => i.id === invitacion.id).length, 0,
      'la invitacion sigue apareciendo pendiente para un grupo en el que ya esta'
    );
  });
}

async function limpiar() {
  if (gruposCreados.length > 0) {
    await db.consultar('DELETE FROM chat_grupos WHERE id = ANY($1::bigint[])', [gruposCreados]);
  }
}

principal()
  .catch((error) => {
    fallos += 1;
    console.error(`\nError fatal: ${error.message}\n${error.stack}`);
  })
  .then(limpiar)
  .catch((error) => console.error(`No se pudo limpiar: ${error.message}`))
  .then(async () => {
    await db.cerrar();
    console.log(`\n${'='.repeat(60)}`);
    console.log(fallos === 0 ? 'TODAS LAS PRUEBAS DE INTEGRACION PASARON' : `${fallos} PRUEBA(S) FALLARON`);
    console.log('='.repeat(60));
    process.exit(fallos === 0 ? 0 : 1);
  });
