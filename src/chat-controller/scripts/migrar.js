'use strict';

/**
 * Ejecutor de migraciones versionadas.
 *
 *   npm run migrar          aplica las pendientes
 *   npm run migrar:estado   muestra que hay aplicado y que falta
 *
 * Cada archivo de `db/migraciones` se aplica una sola vez, en orden de nombre,
 * y queda registrado en `schema_migraciones` junto a su checksum. Tres
 * propiedades que importan:
 *
 *  - Cada migracion corre en su propia transaccion: si una falla, esa queda sin
 *    aplicar y las anteriores se conservan.
 *  - Un lock consultivo impide que dos instancias arrancando a la vez apliquen
 *    la misma migracion en paralelo.
 *  - El checksum detecta que alguien edito una migracion YA aplicada. Ese
 *    cambio no se ejecutaria nunca, y las bases del equipo quedarian distintas
 *    en silencio. Se corta con un error en vez de dejarlo pasar.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../src/config/db');
const log = require('../src/utils/log');

const DIRECTORIO = path.join(__dirname, '..', 'db', 'migraciones');

// Identificador arbitrario pero estable del lock consultivo de migraciones.
const LOCK_ID = 728194;

function checksum(contenido) {
  return crypto.createHash('sha256').update(contenido, 'utf8').digest('hex').slice(0, 16);
}

function leerMigraciones() {
  if (!fs.existsSync(DIRECTORIO)) {
    throw new Error(`No existe el directorio de migraciones: ${DIRECTORIO}`);
  }

  return fs
    .readdirSync(DIRECTORIO)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort()
    .map((archivo) => {
      const sql = fs.readFileSync(path.join(DIRECTORIO, archivo), 'utf8');
      return { version: archivo.replace(/\.sql$/, ''), archivo, sql, checksum: checksum(sql) };
    });
}

async function asegurarTablaControl(cliente) {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS schema_migraciones (
      version     TEXT        PRIMARY KEY,
      checksum    TEXT        NOT NULL,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      duracion_ms INTEGER     NOT NULL DEFAULT 0
    )
  `);
}

async function aplicadas(cliente) {
  const { rows } = await cliente.query(
    'SELECT version, checksum, aplicada_en FROM schema_migraciones ORDER BY version'
  );
  return new Map(rows.map((fila) => [fila.version, fila]));
}

async function conLock(trabajo) {
  // El lock consultivo es de sesion, asi que hay que usar SIEMPRE el mismo
  // cliente para tomarlo, trabajar y soltarlo.
  const cliente = await db.pool.connect();
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    return await trabajo(cliente);
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    cliente.release();
  }
}

async function migrar() {
  const migraciones = leerMigraciones();

  return conLock(async (cliente) => {
    await asegurarTablaControl(cliente);
    const yaAplicadas = await aplicadas(cliente);

    const conocidas = new Set(migraciones.map((m) => m.version));
    for (const version of yaAplicadas.keys()) {
      if (!conocidas.has(version)) {
        log.warn('Hay una migracion aplicada sin archivo correspondiente', { version });
      }
    }

    const nuevas = [];

    for (const migracion of migraciones) {
      const previa = yaAplicadas.get(migracion.version);

      if (previa) {
        if (previa.checksum !== migracion.checksum) {
          throw new Error(
            `La migracion ${migracion.archivo} cambio despues de haberse aplicado ` +
            `(esperado ${previa.checksum}, actual ${migracion.checksum}). ` +
            'No se puede reaplicar: cree una migracion nueva con el cambio.'
          );
        }
        continue;
      }

      const inicio = Date.now();
      try {
        await cliente.query('BEGIN');
        await cliente.query(migracion.sql);
        await cliente.query(
          'INSERT INTO schema_migraciones (version, checksum, duracion_ms) VALUES ($1, $2, $3)',
          [migracion.version, migracion.checksum, Date.now() - inicio]
        );
        await cliente.query('COMMIT');
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw new Error(`Fallo la migracion ${migracion.archivo}: ${error.message}`);
      }

      nuevas.push(migracion.version);
      log.info('Migracion aplicada', {
        version: migracion.version,
        duracionMs: Date.now() - inicio
      });
    }

    return { aplicadas: nuevas, total: migraciones.length };
  });
}

async function estado() {
  const migraciones = leerMigraciones();

  return conLock(async (cliente) => {
    await asegurarTablaControl(cliente);
    const yaAplicadas = await aplicadas(cliente);

    return migraciones.map((migracion) => {
      const previa = yaAplicadas.get(migracion.version);
      if (!previa) return { version: migracion.version, estado: 'pendiente' };
      if (previa.checksum !== migracion.checksum) {
        return { version: migracion.version, estado: 'MODIFICADA', aplicadaEn: previa.aplicada_en };
      }
      return { version: migracion.version, estado: 'aplicada', aplicadaEn: previa.aplicada_en };
    });
  });
}

async function principal() {
  const modo = process.argv[2] === '--estado' ? 'estado' : 'migrar';

  if (modo === 'estado') {
    const filas = await estado();
    console.log('\nEstado de las migraciones:\n');
    for (const fila of filas) {
      const marca = { aplicada: '  ok  ', pendiente: ' PEND ', MODIFICADA: ' !!!! ' }[fila.estado];
      const fecha = fila.aplicadaEn ? new Date(fila.aplicadaEn).toISOString() : '';
      console.log(`${marca} ${fila.version.padEnd(36)} ${fila.estado.padEnd(11)} ${fecha}`);
    }
    const modificadas = filas.filter((f) => f.estado === 'MODIFICADA');
    console.log('');
    if (modificadas.length > 0) {
      console.log(`ATENCION: ${modificadas.length} migracion(es) fueron editadas despues de aplicarse.`);
      process.exitCode = 1;
    }
    return;
  }

  const resultado = await migrar();
  if (resultado.aplicadas.length === 0) {
    console.log(`Sin migraciones pendientes (${resultado.total} aplicadas en total).`);
  } else {
    console.log(`Aplicadas ${resultado.aplicadas.length} migracion(es): ${resultado.aplicadas.join(', ')}`);
  }
}

if (require.main === module) {
  principal()
    .then(() => db.cerrar())
    .then(() => process.exit(process.exitCode || 0))
    .catch(async (error) => {
      log.error('Fallo la migracion', { error: error.message });
      console.error(`\n${error.message}\n`);
      await db.cerrar().catch(() => {});
      process.exit(1);
    });
}

module.exports = { migrar, estado, leerMigraciones };
