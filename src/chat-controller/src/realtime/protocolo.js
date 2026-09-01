'use strict';

const validar = require('../utils/validar');
const config = require('../config');
const { errores } = require('../utils/errores');

// --- Cliente -> servidor ---
const ENTRANTE = {
  SUSCRIBIR: 'suscribir',
  DESUSCRIBIR: 'desuscribir',
  MENSAJE: 'mensaje',
  LEIDO: 'leido',
  ESCRIBIENDO: 'escribiendo',
  PING: 'ping'
};

// --- Servidor -> cliente ---
const SALIENTE = {
  BIENVENIDA: 'bienvenida',
  SUSCRITO: 'suscrito',
  DESUSCRITO: 'desuscrito',
  MENSAJE: 'mensaje',
  ACK: 'ack',
  PRESENCIA: 'presencia',
  ESCRIBIENDO: 'escribiendo',
  MIEMBRO: 'miembro',
  CHAT_ELIMINADO: 'chat-eliminado',
  INVITACION: 'invitacion',
  LEIDO: 'leido',
  PONG: 'pong',
  ERROR: 'error'
};

// A quien va dirigido un evento del bus. Los avisos de invitacion no pueden
// viajar por el canal del chat: su destinatario todavia no pertenece al grupo.
const DESTINO = {
  CHAT: 'chat',
  USUARIO: 'usuario'
};

// Codigos de cierre en el rango privado (4000-4999) de la RFC 6455.
const CIERRE = {
  NO_AUTENTICADO: 4401,
  PROHIBIDO: 4403,
  SESION_EXPIRADA: 4440,
  SIN_LATIDO: 4408,
  RATE_LIMIT: 4429,
  MENSAJE_GRANDE: 4413,
  CLIENTE_LENTO: 4499,
  APAGANDO: 1001
};

function analizar(datos) {
  let sobre;
  try {
    sobre = JSON.parse(datos);
  } catch (error) {
    throw errores.invalido('El marco recibido no es JSON valido');
  }

  if (!sobre || typeof sobre !== 'object' || Array.isArray(sobre)) {
    throw errores.invalido('El marco debe ser un objeto JSON');
  }
  if (typeof sobre.tipo !== 'string') {
    throw errores.invalido('El marco debe incluir el campo "tipo"');
  }

  switch (sobre.tipo) {
    case ENTRANTE.PING:
      return { tipo: ENTRANTE.PING };

    case ENTRANTE.SUSCRIBIR:
      return {
        tipo: ENTRANTE.SUSCRIBIR,
        chatId: validar.idEntero(sobre.chatId, 'chatId'),
        desdeSeq: validar.seqOpcional(sobre.desdeSeq, 'desdeSeq')
      };

    case ENTRANTE.DESUSCRIBIR:
      return {
        tipo: ENTRANTE.DESUSCRIBIR,
        chatId: validar.idEntero(sobre.chatId, 'chatId')
      };

    case ENTRANTE.MENSAJE:
      return {
        tipo: ENTRANTE.MENSAJE,
        chatId: validar.idEntero(sobre.chatId, 'chatId'),
        // Lo genera el cliente (crypto.randomUUID) y es la clave de
        // idempotencia: sin el no hay forma de reintentar sin duplicar.
        clientMsgId: validar.uuid(sobre.clientMsgId, 'clientMsgId'),
        contenido: validar.contenidoMensaje(sobre.contenido, 'contenido', config.chat.maxLongitudMensaje)
      };

    case ENTRANTE.LEIDO:
      return {
        tipo: ENTRANTE.LEIDO,
        chatId: validar.idEntero(sobre.chatId, 'chatId'),
        seq: validar.seqOpcional(sobre.seq, 'seq') ?? 0
      };

    case ENTRANTE.ESCRIBIENDO:
      return {
        tipo: ENTRANTE.ESCRIBIENDO,
        chatId: validar.idEntero(sobre.chatId, 'chatId')
      };

    default:
      throw errores.invalido(`Tipo de marco desconocido: ${sobre.tipo}`);
  }
}

module.exports = { ENTRANTE, SALIENTE, CIERRE, DESTINO, analizar };
