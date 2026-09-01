'use strict';

const { AppError } = require('../utils/errores');
const config = require('../config');
const log = require('../utils/log');

function noEncontrado(req, res) {
  res.status(404).json({
    error: { codigo: 'NO_ENCONTRADO', mensaje: `Ruta no encontrada: ${req.method} ${req.path}` }
  });
}

// Express 4 identifica el manejador de errores por su aridad de 4 argumentos:
// quitar `siguiente` lo convertiria en un middleware normal y nunca se llamaria.
function manejadorErrores(error, req, res, siguiente) { // eslint-disable-line no-unused-vars
  if (error instanceof AppError) {
    return res.status(error.estado).json({
      error: { codigo: error.codigo, mensaje: error.message, detalles: error.detalles }
    });
  }

  // JSON malformado en el cuerpo: body-parser lanza un SyntaxError con `status`.
  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return res.status(400).json({
      error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la peticion no es JSON valido' }
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: { codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'El cuerpo de la peticion es demasiado grande' }
    });
  }

  log.error('Error no controlado', {
    error: error.message,
    stack: config.esProduccion ? undefined : error.stack,
    ruta: `${req.method} ${req.path}`
  });

  return res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' }
  });
}

// Envuelve handlers async para que un rechazo llegue al manejador de errores.
// Sin esto, en Express 4 una promesa rechazada deja la peticion colgada.
function asincrono(handler) {
  return (req, res, siguiente) => Promise.resolve(handler(req, res, siguiente)).catch(siguiente);
}

module.exports = { noEncontrado, manejadorErrores, asincrono };
