'use strict';

const { enTransaccion } = require('../config/db');
const gruposRepo = require('../repositories/grupos.repo');
const miembrosRepo = require('../repositories/miembros.repo');
const mensajesRepo = require('../repositories/mensajes.repo');
const invitacionesRepo = require('../repositories/invitaciones.repo');
const cache = require('./cache.service');
const reunionClient = require('../clients/reunion.client');
const { errores } = require('../utils/errores');
const config = require('../config');

const VIOLACION_UNICO = '23505';

/** Inserta un mensaje de sistema reutilizando el lock ya tomado en la transaccion. */
async function mensajeDeSistema(cliente, chatId, contenido) {
  const seq = await gruposRepo.siguienteSeq(cliente, chatId);
  return mensajesRepo.insertar(cliente, {
    chatId,
    seq,
    autorId: null,
    tipo: 'sistema',
    contenido,
    clientMsgId: null
  });
}

async function crear({ nombre, maxMiembros, eventoId, creadorId, token = null }) {
  if (maxMiembros > config.chat.maxMiembrosPermitido) {
    throw errores.invalido(`El maximo de miembros no puede superar ${config.chat.maxMiembrosPermitido}`);
  }

  // Se valida ANTES de abrir la transaccion: una llamada de red dentro de una
  // transaccion la mantendria abierta durante todo el viaje de ida y vuelta,
  // reteniendo una conexion del pool sin necesidad.
  if (eventoId !== null && eventoId !== undefined) {
    await reunionClient.exigirEventoExistente(eventoId, token);
  }

  return enTransaccion(async (cliente) => {
    let grupo;
    try {
      grupo = await gruposRepo.crear(cliente, { nombre, eventoId, creadorId, maxMiembros });
    } catch (error) {
      // Un evento solo puede tener un chat: la restriccion UNIQUE de la base
      // es la que decide, no una comprobacion previa que dos peticiones
      // simultaneas pasarian a la vez.
      if (error.code === VIOLACION_UNICO) {
        throw errores.conflicto('Ese evento ya tiene un chat grupal');
      }
      throw error;
    }

    await miembrosRepo.altaOReingreso(cliente, {
      chatId: grupo.id,
      usuarioId: creadorId,
      rol: 'admin'
    });

    const mensaje = await mensajeDeSistema(cliente, grupo.id, `Se creo el grupo "${grupo.nombre}"`);

    return { grupo: { ...grupo, ultimoSeq: mensaje.seq, miembrosActivos: 1 }, mensaje };
  });
}

/**
 * Alta de un usuario en el grupo respetando el cupo.
 *
 * Los grupos son abiertos: cualquier usuario autenticado puede unirse por su
 * cuenta si hay lugar. Nadie puede dar de alta a un tercero; para eso existen
 * las invitaciones, que el destinatario tiene que aceptar.
 *
 * Todo ocurre bajo `FOR UPDATE` sobre la fila del grupo. Sin ese lock, dos
 * personas que entran al mismo tiempo leen ambas "quedan 1 lugar", ambas
 * insertan y el grupo termina con un miembro de mas.
 */
async function altaEnTransaccion(cliente, { chatId, usuarioId, grupo }) {
  const existente = await miembrosRepo.obtener(chatId, usuarioId, cliente);
  if (existente && existente.activo) {
    return { yaEraMiembro: true, grupo, miembro: existente, mensaje: null };
  }

  const activos = await miembrosRepo.contarActivos(chatId, cliente);
  if (activos >= grupo.maxMiembros) {
    throw errores.cupoLleno(`El grupo alcanzo su cupo maximo de ${grupo.maxMiembros} miembros`);
  }

  const miembro = await miembrosRepo.altaOReingreso(cliente, {
    chatId,
    usuarioId,
    rol: 'miembro',
    // Quien entra ahora no arrastra como "no leido" toda la conversacion
    // anterior: el historial sigue accesible, pero el contador arranca en cero.
    leidoInicial: grupo.ultimoSeq
  });

  const mensaje = await mensajeDeSistema(cliente, chatId, `El usuario ${usuarioId} se unio al grupo`);

  return { yaEraMiembro: false, grupo, miembro, mensaje, miembrosActivos: activos + 1 };
}

async function unirse({ chatId, usuarioId }) {
  const resultado = await enTransaccion(async (cliente) => {
    const grupo = await gruposRepo.bloquear(cliente, chatId);
    if (!grupo) throw errores.noEncontrado('El grupo no existe');
    if (grupo.estado !== 'activo') throw errores.conflicto('El grupo esta archivado');

    const alta = await altaEnTransaccion(cliente, { chatId, usuarioId, grupo });

    // Si entro por su cuenta teniendo una invitacion abierta, esta deja de
    // tener sentido: sin cerrarla le seguiria apareciendo el aviso.
    if (!alta.yaEraMiembro) {
      await invitacionesRepo.cerrarPendienteDeUsuario(cliente, chatId, usuarioId, 'aceptada');
    }

    return alta;
  });

  if (resultado.mensaje) await cache.empujarReciente(chatId, resultado.mensaje);
  return resultado;
}

async function salir({ chatId, usuarioId, expulsadoPor = null }) {
  const resultado = await enTransaccion(async (cliente) => {
    const grupo = await gruposRepo.bloquear(cliente, chatId);
    if (!grupo) throw errores.noEncontrado('El grupo no existe');

    if (expulsadoPor !== null && expulsadoPor !== usuarioId) {
      const admin = await miembrosRepo.obtener(chatId, expulsadoPor, cliente);
      if (!admin || !admin.activo || admin.rol !== 'admin') {
        throw errores.prohibido('Solo un administrador puede expulsar miembros');
      }
    }

    const miembro = await miembrosRepo.marcarSalida(cliente, chatId, usuarioId);
    if (!miembro) throw errores.noEncontrado('El usuario no es miembro activo del grupo');

    const texto = expulsadoPor !== null && expulsadoPor !== usuarioId
      ? `El usuario ${usuarioId} fue removido del grupo`
      : `El usuario ${usuarioId} salio del grupo`;

    const mensaje = await mensajeDeSistema(cliente, chatId, texto);
    const restantes = await miembrosRepo.contarActivos(chatId, cliente);

    // Sin nadie que pueda volver a abrir la conversacion, conservarla solo
    // ocupa espacio. Ojo con la distincion: esto es que TODOS se dieron de
    // baja del grupo, no que se hayan cerrado las sesiones. Al desconectarse,
    // los mensajes se conservan intactos.
    if (restantes === 0) {
      await gruposRepo.eliminar(cliente, chatId);
      return { miembro, mensaje: null, restantes: 0, grupoEliminado: true, nuevoAdmin: null };
    }

    // Un grupo sin administrador queda sin nadie que pueda expulsar o moderar.
    // El ascenso ocurre bajo el mismo lock que la baja, asi que dos salidas
    // simultaneas no pueden ascender a dos personas distintas.
    let nuevoAdmin = null;
    if (!(await miembrosRepo.hayAdminActivo(chatId, cliente))) {
      nuevoAdmin = await miembrosRepo.promoverAleatorio(cliente, chatId);
    }

    const mensajeAdmin = nuevoAdmin
      ? await mensajeDeSistema(cliente, chatId,
        `El usuario ${nuevoAdmin.usuarioId} es el nuevo administrador del grupo`)
      : null;

    return { miembro, mensaje, mensajeAdmin, restantes, grupoEliminado: false, nuevoAdmin };
  });

  if (resultado.grupoEliminado) {
    // La cache sobrevive al borrado de la fila: hay que limpiarla a mano o
    // quedaria ocupando memoria en Redis hasta que venza su TTL.
    await cache.invalidarRecientes(chatId);
  } else {
    await cache.empujarReciente(chatId, resultado.mensaje);
    if (resultado.mensajeAdmin) await cache.empujarReciente(chatId, resultado.mensajeAdmin);
  }

  await cache.marcarAusente(chatId, usuarioId);
  return resultado;
}

/** Verifica pertenencia. Es la unica puerta de acceso al contenido del grupo. */
async function exigirMembresia(chatId, usuarioId) {
  const miembro = await miembrosRepo.obtener(chatId, usuarioId);
  if (!miembro || !miembro.activo) {
    // Se responde 404 y no 403 para no revelar la existencia del grupo a
    // quien no pertenece.
    throw errores.noEncontrado('El grupo no existe o no tenes acceso');
  }
  return miembro;
}

async function detalle({ chatId, usuarioId }) {
  await exigirMembresia(chatId, usuarioId);

  const grupo = await gruposRepo.porId(chatId);
  if (!grupo) throw errores.noEncontrado('El grupo no existe');

  const miembros = await miembrosRepo.listarActivos(chatId);
  const conectados = await cache.presentes(chatId);

  return {
    ...grupo,
    miembrosActivos: miembros.length,
    cupoDisponible: Math.max(grupo.maxMiembros - miembros.length, 0),
    miembros: miembros.map((miembro) => ({
      usuarioId: miembro.usuarioId,
      rol: miembro.rol,
      unidoEn: miembro.unidoEn,
      conectado: conectados.includes(miembro.usuarioId)
    }))
  };
}

async function listarDeUsuario(usuarioId) {
  return miembrosRepo.chatsDeUsuario(usuarioId);
}

module.exports = {
  crear,
  unirse,
  salir,
  detalle,
  listarDeUsuario,
  exigirMembresia,
  mensajeDeSistema,
  altaEnTransaccion
};
