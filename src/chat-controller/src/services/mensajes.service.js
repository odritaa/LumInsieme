'use strict';

const { enTransaccion } = require('../config/db');
const gruposRepo = require('../repositories/grupos.repo');
const miembrosRepo = require('../repositories/miembros.repo');
const mensajesRepo = require('../repositories/mensajes.repo');
const gruposService = require('./grupos.service');
const cache = require('./cache.service');
const { errores } = require('../utils/errores');
const config = require('../config');

const VIOLACION_UNICO = '23505';

/**
 * Publica un mensaje de usuario.
 *
 * Secuencia dentro de una unica transaccion, con el grupo bloqueado:
 *   1. FOR UPDATE sobre el grupo   -> serializa el chat, valida estado
 *   2. membresia activa            -> nadie escribe en un grupo del que salio
 *   3. busqueda por client_msg_id  -> reintento del cliente = mismo mensaje
 *   4. seq + INSERT                -> orden total y sin huecos
 *
 * Los pasos 2 y 3 van DENTRO del lock a proposito: comprobarlos antes seria
 * una lectura obsoleta y volveria a abrir la carrera que el lock cierra.
 */
async function publicar({ chatId, autorId, contenido, clientMsgId }) {
  const limpio = contenido;

  const resultado = await enTransaccion(async (cliente) => {
    const grupo = await gruposRepo.bloquear(cliente, chatId);
    if (!grupo) throw errores.noEncontrado('El grupo no existe o no tenes acceso');
    if (grupo.estado !== 'activo') throw errores.conflicto('El grupo esta archivado');

    const miembro = await miembrosRepo.obtener(chatId, autorId, cliente);
    if (!miembro || !miembro.activo) {
      throw errores.noEncontrado('El grupo no existe o no tenes acceso');
    }

    const previo = await mensajesRepo.porClientMsgId(cliente, { chatId, autorId, clientMsgId });
    if (previo) {
      return { mensaje: previo, duplicado: true };
    }

    const seq = await gruposRepo.siguienteSeq(cliente, chatId);

    let mensaje;
    try {
      mensaje = await mensajesRepo.insertar(cliente, {
        chatId,
        seq,
        autorId,
        tipo: 'texto',
        contenido: limpio,
        clientMsgId
      });
    } catch (error) {
      // Red de seguridad: si dos envios identicos llegasen a colarse, el indice
      // unico corta el duplicado en lugar de guardarlo dos veces.
      if (error.code === VIOLACION_UNICO) {
        const existente = await mensajesRepo.porClientMsgId(cliente, { chatId, autorId, clientMsgId });
        if (existente) return { mensaje: existente, duplicado: true };
      }
      throw error;
    }

    // El autor ya leyo lo que acaba de escribir.
    await miembrosRepo.actualizarLeido(chatId, autorId, seq, cliente);

    return { mensaje, duplicado: false };
  });

  // Fuera de la transaccion y solo tras el COMMIT: la cache nunca debe
  // adelantarse a la fuente de verdad.
  if (!resultado.duplicado) {
    await cache.empujarReciente(chatId, resultado.mensaje);
  }

  return resultado;
}

/**
 * Historial paginado hacia atras.
 * La primera pagina (sin cursor) intenta salir de Redis; el resto va a la base.
 */
async function historial({ chatId, usuarioId, antesDe, limite }) {
  await gruposService.exigirMembresia(chatId, usuarioId);

  const tope = Math.min(limite || config.chat.paginaHistorial, config.chat.paginaHistorialMax);

  // Cursor de la pagina siguiente: el `seq` mas antiguo devuelto. Es null
  // cuando ya se llego al principio del chat, y ambos caminos (cache y base)
  // tienen que coincidir en eso o el cliente pediria una pagina de mas.
  const calcularCursor = (mensajes, completa) => {
    if (mensajes.length === 0) return null;
    if (mensajes[0].seq <= 1) return null;
    return completa ? mensajes[0].seq : null;
  };

  if (antesDe === null || antesDe === undefined) {
    const enCache = await cache.recientes(chatId, tope);
    if (enCache && enCache.length > 0) {
      return {
        mensajes: enCache,
        origen: 'cache',
        cursor: calcularCursor(enCache, enCache.length === tope)
      };
    }
  }

  const mensajes = await mensajesRepo.historial(chatId, { antesDe, limite: tope });
  return {
    mensajes,
    origen: 'postgres',
    cursor: calcularCursor(mensajes, mensajes.length === tope)
  };
}

/** Mensajes perdidos durante una desconexion. */
async function ponerseAlDia({ chatId, usuarioId, desdeSeq, limite }) {
  await gruposService.exigirMembresia(chatId, usuarioId);
  const tope = Math.min(limite || config.chat.paginaHistorial, config.chat.paginaHistorialMax);
  const mensajes = await mensajesRepo.desdeSeq(chatId, desdeSeq, tope);
  return { mensajes, hayMas: mensajes.length === tope };
}

async function marcarLeido({ chatId, usuarioId, seq }) {
  const miembro = await miembrosRepo.actualizarLeido(chatId, usuarioId, seq);
  if (!miembro) throw errores.noEncontrado('El grupo no existe o no tenes acceso');
  return miembro;
}

module.exports = { publicar, historial, ponerseAlDia, marcarLeido };
