'use strict';

const { Pool } = require('pg');
const config = require('./index');
const log = require('../utils/log');

const pool = new Pool({
  connectionString: config.postgres.connectionString,
  max: config.postgres.max,
  idleTimeoutMillis: config.postgres.idleTimeoutMillis,
  connectionTimeoutMillis: config.postgres.connectionTimeoutMillis,
  // Corta consultas colgadas antes de agotar el pool y tumbar el servicio.
  statement_timeout: config.postgres.statementTimeoutMillis,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Sin este handler, un corte de red en una conexion ociosa emite un 'error'
// sin listeners y Node mata el proceso entero.
pool.on('error', (error) => {
  log.error('Error en conexion ociosa de PostgreSQL', { error: error.message });
});

// BIGINT (OID 20) llega como string por defecto para no perder precision.
// Los ids y seq del chat caben de sobra en Number.MAX_SAFE_INTEGER, asi que se
// convierten a numero para que el JSON del API sea numerico y no string.
require('pg').types.setTypeParser(20, (valor) => (valor === null ? null : Number(valor)));

async function consultar(texto, parametros) {
  const inicio = Date.now();
  const resultado = await pool.query(texto, parametros);
  const duracion = Date.now() - inicio;
  if (duracion > 200) {
    log.warn('Consulta lenta', { duracionMs: duracion, consulta: texto.slice(0, 120) });
  }
  return resultado;
}

/**
 * Ejecuta `trabajo` dentro de una transaccion y garantiza la devolucion del
 * cliente al pool pase lo que pase. Si no se libera el cliente en el camino de
 * error, el pool se agota tras unos pocos fallos y el servicio deja de responder.
 */
async function enTransaccion(trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    try {
      await cliente.query('ROLLBACK');
    } catch (errorRollback) {
      log.error('Fallo el ROLLBACK', { error: errorRollback.message });
    }
    throw error;
  } finally {
    cliente.release();
  }
}

async function verificarConexion() {
  await pool.query('SELECT 1');
}

async function cerrar() {
  await pool.end();
}

module.exports = { pool, consultar, enTransaccion, verificarConexion, cerrar };
