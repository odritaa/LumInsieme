'use strict';

class AppError extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'AppError';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
    this.esOperacional = true;
  }
}

const errores = {
  invalido: (mensaje, detalles) => new AppError(400, 'SOLICITUD_INVALIDA', mensaje, detalles),
  noAutenticado: (mensaje = 'Sesion invalida o expirada') => new AppError(401, 'NO_AUTENTICADO', mensaje),
  prohibido: (mensaje = 'No tenes acceso a este recurso') => new AppError(403, 'PROHIBIDO', mensaje),
  noEncontrado: (mensaje = 'Recurso no encontrado') => new AppError(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (mensaje, detalles) => new AppError(409, 'CONFLICTO', mensaje, detalles),
  cupoLleno: (mensaje = 'El grupo alcanzo su cupo maximo') => new AppError(409, 'CUPO_LLENO', mensaje),
  demasiadasSolicitudes: (mensaje = 'Demasiadas solicitudes') => new AppError(429, 'RATE_LIMIT', mensaje),
  interno: (mensaje = 'Error interno del servidor') => new AppError(500, 'ERROR_INTERNO', mensaje)
};

module.exports = { AppError, errores };
