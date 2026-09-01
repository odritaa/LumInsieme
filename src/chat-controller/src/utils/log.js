'use strict';

const config = require('../config');

const NIVELES = { error: 0, warn: 1, info: 2, debug: 3 };
const nivelActual = NIVELES[process.env.LOG_LEVEL] ?? (config.esProduccion ? NIVELES.info : NIVELES.debug);

function emitir(nivel, mensaje, datos) {
  if (NIVELES[nivel] > nivelActual) return;

  const linea = {
    ts: new Date().toISOString(),
    nivel,
    servicio: 'chat-controller',
    instancia: config.instanciaId,
    mensaje,
    ...datos
  };

  const salida = nivel === 'error' || nivel === 'warn' ? process.stderr : process.stdout;
  salida.write(`${JSON.stringify(linea)}\n`);
}

module.exports = {
  error: (mensaje, datos) => emitir('error', mensaje, datos),
  warn: (mensaje, datos) => emitir('warn', mensaje, datos),
  info: (mensaje, datos) => emitir('info', mensaje, datos),
  debug: (mensaje, datos) => emitir('debug', mensaje, datos)
};
