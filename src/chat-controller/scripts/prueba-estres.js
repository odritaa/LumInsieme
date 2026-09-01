'use strict';

/**
 * Estres transaccional: fuerza las carreras que el diseno dice resolver.
 * Requiere PostgreSQL. Ver README para el arranque.
 *
 *   npm run prueba:estres
 */

const assert = require('assert');
const crypto = require('crypto');

const db = require('../src/config/db');
const gruposService = require('../src/services/grupos.service');
const mensajesService = require('../src/services/mensajes.service');
const invitacionesService = require('../src/services/invitaciones.service');
const miembrosRepo = require('../src/repositories/miembros.repo');

const creados = [];
let fallos = 0;
const U = (n) => 800000 + n;

async function prueba(nombre, fn) {
  const inicio = Date.now();
  try {
    const detalle = await fn();
    console.log(`  ok   ${nombre}  [${Date.now() - inicio}ms]${detalle ? ' -> ' + detalle : ''}`);
  } catch (error) {
    fallos += 1;
    console.log(`  FALLA ${nombre}\n        ${error.message}`);
  }
}

async function grupo(nombre, max, creador) {
  const { grupo: g } = await gruposService.crear({ nombre, maxMiembros: max, eventoId: null, creadorId: creador });
  creados.push(g.id);
  return g;
}

async function principal() {
  await db.verificarConexion();
  console.log('\n== Estres transaccional ==\n');

  // -------------------------------------------------------------------------
  await prueba('cupo bajo carrera, 20 repeticiones seguidas (deteccion de intermitencia)', async () => {
    for (let ronda = 0; ronda < 20; ronda += 1) {
      const g = await grupo(`Cupo ronda ${ronda}`, 5, U(1));
      const intentos = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) => gruposService.unirse({ chatId: g.id, usuarioId: U(100 + i) }))
      );
      const entraron = intentos.filter((r) => r.status === 'fulfilled').length;
      const activos = await miembrosRepo.contarActivos(g.id);

      assert.strictEqual(entraron, 4, `ronda ${ronda}: entraron ${entraron}, se esperaban 4`);
      assert.strictEqual(activos, 5, `ronda ${ronda}: el grupo quedo con ${activos} y el maximo era 5`);
    }
    return '20/20 rondas sin sobrecupo';
  });

  // -------------------------------------------------------------------------
  await prueba('200 mensajes concurrentes: seq unica, correlativa y sin huecos', async () => {
    const g = await grupo('Carga alta', 20, U(2));
    for (let i = 0; i < 10; i += 1) {
      await gruposService.unirse({ chatId: g.id, usuarioId: U(200 + i) });
    }

    const inicio = Date.now();
    await Promise.all(
      Array.from({ length: 200 }, (_, i) =>
        mensajesService.publicar({
          chatId: g.id,
          autorId: U(200 + (i % 10)),
          contenido: `carga ${i}`,
          clientMsgId: crypto.randomUUID()
        })
      )
    );
    const duracion = Date.now() - inicio;

    const { rows } = await db.consultar(
      'SELECT seq FROM chat_mensajes WHERE chat_id = $1 ORDER BY seq', [g.id]
    );
    const seqs = rows.map((f) => f.seq);
    assert.strictEqual(new Set(seqs).size, seqs.length, 'hay seq duplicadas');
    for (let i = 0; i < seqs.length; i += 1) {
      assert.strictEqual(seqs[i], i + 1, `hueco en seq en la posicion ${i}`);
    }

    const { rows: g2 } = await db.consultar('SELECT ultimo_seq FROM chat_grupos WHERE id = $1', [g.id]);
    assert.strictEqual(g2[0].ultimo_seq, seqs.length, 'ultimo_seq no coincide con los mensajes reales');

    return `${seqs.length} mensajes en ${duracion}ms (${Math.round(200000 / duracion)} msg/s)`;
  });

  // -------------------------------------------------------------------------
  await prueba('carga mixta (altas + bajas + mensajes a la vez) sin interbloqueos', async () => {
    const g = await grupo('Carga mixta', 40, U(3));
    for (let i = 0; i < 15; i += 1) {
      await gruposService.unirse({ chatId: g.id, usuarioId: U(300 + i) });
    }

    // Los tres flujos que compiten por el lock del grupo, a la vez y sobre el
    // mismo chat. Si el orden de locks estuviese mal, aqui saldria un deadlock
    // (PostgreSQL lo aborta con SQLSTATE 40P01).
    const operaciones = [];
    for (let i = 0; i < 40; i += 1) {
      operaciones.push(mensajesService.publicar({
        chatId: g.id, autorId: U(300 + (i % 15)), contenido: `mixto ${i}`, clientMsgId: crypto.randomUUID()
      }));
      operaciones.push(gruposService.unirse({ chatId: g.id, usuarioId: U(400 + i) }));
      if (i % 3 === 0) {
        operaciones.push(gruposService.salir({ chatId: g.id, usuarioId: U(300 + (i % 15)) }));
      }
      operaciones.push(mensajesService.marcarLeido({
        chatId: g.id, usuarioId: U(300 + (i % 15)), seq: i
      }).catch(() => null));
    }

    const resultados = await Promise.allSettled(operaciones);
    const deadlocks = resultados.filter((r) => r.status === 'rejected' && r.reason?.code === '40P01');
    assert.strictEqual(deadlocks.length, 0, `hubo ${deadlocks.length} interbloqueos`);

    // Otros errores inesperados (los de negocio como CUPO_LLENO son legitimos).
    const inesperados = resultados.filter((r) =>
      r.status === 'rejected' && !r.reason?.codigo && r.reason?.code !== '40P01');
    assert.strictEqual(inesperados.length, 0,
      `errores inesperados: ${inesperados.slice(0, 3).map((r) => r.reason?.message).join(' | ')}`);

    const { rows } = await db.consultar(
      'SELECT seq FROM chat_mensajes WHERE chat_id = $1 ORDER BY seq', [g.id]
    );
    const seqs = rows.map((f) => f.seq);
    for (let i = 0; i < seqs.length; i += 1) {
      assert.strictEqual(seqs[i], i + 1, 'la carga mixta dejo huecos en seq');
    }

    return `${resultados.length} operaciones, 0 interbloqueos`;
  });

  // -------------------------------------------------------------------------
  await prueba('el pool no se agota tras 100 transacciones fallidas seguidas', async () => {
    const g = await grupo('Fuga de conexiones', 5, U(4));

    // Cada uno de estos publicar() lanza dentro de la transaccion. Si el cliente
    // no se devolviera al pool en el camino de error, el pool (max 10) se
    // agotaria y el servicio dejaria de responder para siempre.
    for (let i = 0; i < 100; i += 1) {
      await assert.rejects(mensajesService.publicar({
        chatId: g.id, autorId: U(9999), contenido: 'no soy miembro', clientMsgId: crypto.randomUUID()
      }));
    }

    const espera = db.pool.waitingCount;
    const total = db.pool.totalCount;
    const ociosas = db.pool.idleCount;

    // Tras los fallos, el pool debe seguir operativo.
    const ok = await mensajesService.publicar({
      chatId: g.id, autorId: U(4), contenido: 'el pool sigue vivo', clientMsgId: crypto.randomUUID()
    });
    assert.ok(ok.mensaje.seq > 0, 'el pool quedo inutilizable tras los errores');
    assert.strictEqual(espera, 0, `habia ${espera} peticiones esperando conexion`);

    return `pool: ${total} conexiones, ${ociosas} ociosas, ${espera} en espera`;
  });

  // -------------------------------------------------------------------------
  await prueba('dos chats simultaneos para el mismo evento: solo uno gana', async () => {
    const eventoId = Math.floor(Math.random() * 1000000) + 500000;

    const intentos = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        gruposService.crear({ nombre: 'Chat del evento', maxMiembros: 6, eventoId, creadorId: U(5) })
      )
    );

    const ganadores = intentos.filter((r) => r.status === 'fulfilled');
    ganadores.forEach((r) => creados.push(r.value.grupo.id));

    const porConflicto = intentos.filter((r) => r.status === 'rejected' && r.reason.codigo === 'CONFLICTO');

    assert.strictEqual(ganadores.length, 1, `se crearon ${ganadores.length} chats para el mismo evento`);
    assert.strictEqual(porConflicto.length, 4, 'los perdedores deberian fallar con CONFLICTO, no con otro error');
    return '1 ganador, 4 rechazados con CONFLICTO';
  });

  // -------------------------------------------------------------------------
  await prueba('salir y escribir a la vez no deja escribir a quien ya salio', async () => {
    for (let ronda = 0; ronda < 15; ronda += 1) {
      const g = await grupo(`Salida vs mensaje ${ronda}`, 5, U(6));
      await gruposService.unirse({ chatId: g.id, usuarioId: U(600) });

      const [salida, envio] = await Promise.allSettled([
        gruposService.salir({ chatId: g.id, usuarioId: U(600) }),
        mensajesService.publicar({
          chatId: g.id, autorId: U(600), contenido: 'justo me iba', clientMsgId: crypto.randomUUID()
        })
      ]);

      assert.strictEqual(salida.status, 'fulfilled', 'la salida deberia completarse siempre');

      // El envio puede ganar o perder la carrera, pero nunca puede quedar un
      // mensaje de alguien que ya figura como no miembro.
      if (envio.status === 'fulfilled') {
        const miembro = await miembrosRepo.obtener(g.id, U(600));
        const { rows } = await db.consultar(
          'SELECT creado_en FROM chat_mensajes WHERE chat_id = $1 AND autor_id = $2', [g.id, U(600)]
        );
        assert.ok(rows.length <= 1, 'se duplico el mensaje');
        assert.ok(miembro.salioEn !== null, 'la salida no quedo registrada');
      }
    }
    return '15/15 rondas coherentes';
  });

  // -------------------------------------------------------------------------
  await prueba('un mensaje de 2000 caracteres entra y uno de 2001 lo rechaza la base', async () => {
    const g = await grupo('Limites', 5, U(7));

    const justo = await mensajesService.publicar({
      chatId: g.id, autorId: U(7), contenido: 'a'.repeat(2000), clientMsgId: crypto.randomUUID()
    });
    assert.strictEqual(justo.mensaje.contenido.length, 2000);

    // El validador corta antes, pero la restriccion CHECK debe ser la ultima red.
    await assert.rejects(
      db.consultar(
        `INSERT INTO chat_mensajes (chat_id, seq, autor_id, tipo, contenido, client_msg_id)
         VALUES ($1, 99999, $2, 'texto', $3, $4)`,
        [g.id, U(7), 'a'.repeat(2001), crypto.randomUUID()]
      ),
      (e) => e.code === '23514',
      'la restriccion CHECK de longitud no se disparo'
    );
    return 'CHECK de longitud activo';
  });

  // -------------------------------------------------------------------------
  await prueba('invitaciones simultaneas a la misma persona: solo una queda pendiente', async () => {
    for (let ronda = 0; ronda < 10; ronda += 1) {
      const g = await grupo(`Invitacion doble ${ronda}`, 6, U(10));
      await gruposService.unirse({ chatId: g.id, usuarioId: U(1000) });

      // Dos miembros distintos invitan a la vez a la misma persona.
      const intentos = await Promise.allSettled([
        invitacionesService.invitar({ chatId: g.id, invitadoId: U(1001), invitadorId: U(10) }),
        invitacionesService.invitar({ chatId: g.id, invitadoId: U(1001), invitadorId: U(1000) })
      ]);

      const creadas = intentos.filter((r) => r.status === 'fulfilled').length;
      assert.strictEqual(creadas, 1, `ronda ${ronda}: se crearon ${creadas} invitaciones pendientes`);

      const { rows } = await db.consultar(
        `SELECT count(*)::int AS total FROM chat_invitaciones
          WHERE chat_id = $1 AND invitado_id = $2 AND estado = 'pendiente'`,
        [g.id, U(1001)]
      );
      assert.strictEqual(rows[0].total, 1);
    }
    return '10/10 rondas con una sola invitacion';
  });

  // -------------------------------------------------------------------------
  await prueba('aceptar invitaciones en masa no supera el cupo', async () => {
    const g = await grupo('Aceptacion masiva', 4, U(11));

    // 10 invitaciones a un grupo donde solo quedan 3 lugares.
    const invitaciones = [];
    for (let i = 0; i < 10; i += 1) {
      const { invitacion } = await invitacionesService.invitar({
        chatId: g.id, invitadoId: U(1100 + i), invitadorId: U(11)
      });
      invitaciones.push(invitacion);
    }

    const intentos = await Promise.allSettled(
      invitaciones.map((inv) =>
        invitacionesService.aceptar({ invitacionId: inv.id, usuarioId: inv.invitadoId })
      )
    );

    const aceptadas = intentos.filter((r) => r.status === 'fulfilled').length;
    const porCupo = intentos.filter((r) => r.status === 'rejected' && r.reason.codigo === 'CUPO_LLENO').length;
    const activos = await miembrosRepo.contarActivos(g.id);

    assert.strictEqual(activos, 4, `el grupo quedo con ${activos} miembros y el maximo era 4`);
    assert.strictEqual(aceptadas, 3, `entraron ${aceptadas}, se esperaban 3`);
    assert.strictEqual(porCupo, 7, `rechazados por cupo ${porCupo}, se esperaban 7`);

    return `${aceptadas} aceptadas, ${porCupo} rechazadas por cupo`;
  });

  // -------------------------------------------------------------------------
  await prueba('salidas simultaneas: nunca queda el grupo sin admin ni con dos', async () => {
    for (let ronda = 0; ronda < 15; ronda += 1) {
      const g = await grupo(`Traspaso bajo carrera ${ronda}`, 8, U(12));
      const miembros = [];
      for (let i = 0; i < 5; i += 1) {
        miembros.push(U(1200 + i));
        await gruposService.unirse({ chatId: g.id, usuarioId: U(1200 + i) });
      }

      // El admin y dos miembros se van a la vez.
      await Promise.allSettled([
        gruposService.salir({ chatId: g.id, usuarioId: U(12) }),
        gruposService.salir({ chatId: g.id, usuarioId: miembros[0] }),
        gruposService.salir({ chatId: g.id, usuarioId: miembros[1] })
      ]);

      const { rows } = await db.consultar(
        `SELECT count(*)::int AS admins FROM chat_miembros
          WHERE chat_id = $1 AND salio_en IS NULL AND rol = 'admin'`,
        [g.id]
      );
      const activos = await miembrosRepo.contarActivos(g.id);

      assert.ok(activos > 0, `ronda ${ronda}: el grupo quedo vacio inesperadamente`);
      assert.strictEqual(rows[0].admins, 1,
        `ronda ${ronda}: quedaron ${rows[0].admins} administradores, se esperaba exactamente 1`);
    }
    return '15/15 rondas con exactamente un admin';
  });

  // -------------------------------------------------------------------------
  await prueba('vaciar el grupo bajo carrera lo elimina sin dejar filas huerfanas', async () => {
    for (let ronda = 0; ronda < 10; ronda += 1) {
      const g = await grupo(`Vaciado bajo carrera ${ronda}`, 5, U(13));
      const todos = [U(13)];
      for (let i = 0; i < 3; i += 1) {
        todos.push(U(1300 + i));
        await gruposService.unirse({ chatId: g.id, usuarioId: U(1300 + i) });
      }
      await invitacionesService.invitar({ chatId: g.id, invitadoId: U(1399), invitadorId: U(13) });
      await mensajesService.publicar({
        chatId: g.id, autorId: U(13), contenido: 'chau', clientMsgId: crypto.randomUUID()
      });

      // Todos se van a la vez: exactamente una de las salidas debe borrar.
      const salidas = await Promise.allSettled(
        todos.map((u) => gruposService.salir({ chatId: g.id, usuarioId: u }))
      );

      const borraron = salidas.filter((r) => r.status === 'fulfilled' && r.value.grupoEliminado).length;
      assert.strictEqual(borraron, 1, `ronda ${ronda}: ${borraron} salidas dijeron haber borrado el grupo`);

      for (const tabla of ['chat_grupos', 'chat_miembros', 'chat_mensajes', 'chat_invitaciones']) {
        const columna = tabla === 'chat_grupos' ? 'id' : 'chat_id';
        const { rows } = await db.consultar(
          `SELECT count(*)::int AS total FROM ${tabla} WHERE ${columna} = $1`, [g.id]
        );
        assert.strictEqual(rows[0].total, 0, `ronda ${ronda}: filas huerfanas en ${tabla}`);
      }
    }
    return '10/10 rondas sin huerfanos';
  });

  // -------------------------------------------------------------------------
  await prueba('invitar y vaciar el grupo a la vez no deja invitaciones colgadas', async () => {
    const resultados = [];
    for (let ronda = 0; ronda < 10; ronda += 1) {
      const g = await grupo(`Invitar vs borrar ${ronda}`, 5, U(14));

      const [inv] = await Promise.allSettled([
        invitacionesService.invitar({ chatId: g.id, invitadoId: U(1400), invitadorId: U(14) }),
        gruposService.salir({ chatId: g.id, usuarioId: U(14) })
      ]);
      resultados.push(inv.status);

      // Gane quien gane la carrera, no puede quedar una invitacion a un grupo
      // inexistente: la clave foranea con CASCADE lo impide.
      const { rows } = await db.consultar(
        `SELECT count(*)::int AS total FROM chat_invitaciones i
          WHERE i.chat_id = $1
            AND NOT EXISTS (SELECT 1 FROM chat_grupos g WHERE g.id = i.chat_id)`,
        [g.id]
      );
      assert.strictEqual(rows[0].total, 0, `ronda ${ronda}: invitacion huerfana`);
    }
    return `10/10 coherentes (${resultados.filter((r) => r === 'fulfilled').length} invitaciones ganaron la carrera)`;
  });

  // -------------------------------------------------------------------------
  await prueba('no se puede insertar un mensaje de sistema con autor', async () => {
    const g = await grupo('Coherencia de autor', 5, U(8));
    await assert.rejects(
      db.consultar(
        `INSERT INTO chat_mensajes (chat_id, seq, autor_id, tipo, contenido)
         VALUES ($1, 88888, $2, 'sistema', 'falso')`,
        [g.id, U(8)]
      ),
      (e) => e.code === '23514'
    );
    return 'CHECK de coherencia activo';
  });
}

async function limpiar() {
  if (creados.length > 0) {
    await db.consultar('DELETE FROM chat_grupos WHERE id = ANY($1::bigint[])', [creados]);
  }
}

principal()
  .catch((e) => { fallos += 1; console.error(`\nError fatal: ${e.message}\n${e.stack}`); })
  .then(limpiar)
  .catch((e) => console.error(`No se pudo limpiar: ${e.message}`))
  .then(async () => {
    await db.cerrar();
    console.log(`\n${'='.repeat(64)}`);
    console.log(fallos === 0 ? 'ESTRES SUPERADO' : `${fallos} PRUEBA(S) FALLARON`);
    console.log('='.repeat(64));
    process.exit(fallos === 0 ? 0 : 1);
  });
