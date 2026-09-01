'use strict';

const { enTransaccion } = require('../config/db');
const gruposRepo = require('../repositories/grupos.repo');
const miembrosRepo = require('../repositories/miembros.repo');
const invitacionesRepo = require('../repositories/invitaciones.repo');
const gruposService = require('./grupos.service');
const cache = require('./cache.service');
const { errores } = require('../utils/errores');

const VIOLACION_UNICO = '23505';

/**
 * Emite una invitacion.
 *
 * Cualquier miembro activo puede invitar, no solo los administradores: el chat
 * es una herramienta de coordinacion entre pares, no una jerarquia. La
 * invitacion no da de alta a nadie ni reserva cupo; solo el destinatario puede
 * convertirla en una membresia.
 */
async function invitar({ chatId, invitadoId, invitadorId }) {
  if (invitadoId === invitadorId) {
    throw errores.invalido('No podes invitarte a vos mismo; unite directamente al grupo');
  }

  return enTransaccion(async (cliente) => {
    const grupo = await gruposRepo.bloquear(cliente, chatId);
    if (!grupo) throw errores.noEncontrado('El grupo no existe o no tenes acceso');
    if (grupo.estado !== 'activo') throw errores.conflicto('El grupo esta archivado');

    const invitador = await miembrosRepo.obtener(chatId, invitadorId, cliente);
    if (!invitador || !invitador.activo) {
      throw errores.noEncontrado('El grupo no existe o no tenes acceso');
    }

    const yaMiembro = await miembrosRepo.obtener(chatId, invitadoId, cliente);
    if (yaMiembro && yaMiembro.activo) {
      throw errores.conflicto('Esa persona ya es miembro del grupo');
    }

    // El cupo se comprueba al aceptar, no al invitar: entre una cosa y otra el
    // grupo puede vaciarse o llenarse. Aun asi se avisa si ya esta lleno, para
    // no generar una invitacion que nace condenada.
    const activos = await miembrosRepo.contarActivos(chatId, cliente);
    if (activos >= grupo.maxMiembros) {
      throw errores.cupoLleno(`El grupo alcanzo su cupo maximo de ${grupo.maxMiembros} miembros`);
    }

    try {
      const invitacion = await invitacionesRepo.crear(cliente, { chatId, invitadoId, invitadorId });
      return { invitacion, grupo };
    } catch (error) {
      // El indice unico parcial es el que decide, no una lectura previa que dos
      // peticiones simultaneas pasarian a la vez.
      if (error.code === VIOLACION_UNICO) {
        throw errores.conflicto('Esa persona ya tiene una invitacion pendiente a este grupo');
      }
      throw error;
    }
  });
}

/**
 * El invitado acepta y recien ahi se convierte en miembro.
 *
 * Orden de locks: primero el grupo, despues la invitacion. Es el mismo orden
 * que usa el resto del modulo, y por eso no puede haber interbloqueos con los
 * flujos de alta, baja o envio de mensajes.
 */
async function aceptar({ invitacionId, usuarioId }) {
  const resultado = await enTransaccion(async (cliente) => {
    // Lectura sin lock, solo para saber a que grupo bloquear.
    const referencia = await invitacionesRepo.porId(invitacionId, cliente);
    if (!referencia || referencia.invitadoId !== usuarioId) {
      throw errores.noEncontrado('La invitacion no existe');
    }

    const grupo = await gruposRepo.bloquear(cliente, referencia.chatId);
    if (!grupo) throw errores.noEncontrado('El grupo ya no existe');
    if (grupo.estado !== 'activo') throw errores.conflicto('El grupo esta archivado');

    // Lectura autoritativa, ya bajo el lock del grupo.
    const invitacion = await invitacionesRepo.bloquear(cliente, invitacionId);
    if (invitacion.estado !== 'pendiente') {
      throw errores.conflicto(`La invitacion ya fue ${invitacion.estado}`);
    }
    if (new Date(invitacion.expiraEn) <= new Date()) {
      throw errores.conflicto('La invitacion expiro');
    }

    const alta = await gruposService.altaEnTransaccion(cliente, {
      chatId: grupo.id,
      usuarioId,
      grupo
    });

    await invitacionesRepo.responder(cliente, invitacionId, 'aceptada');

    return { ...alta, chatId: grupo.id };
  });

  if (resultado.mensaje) await cache.empujarReciente(resultado.chatId, resultado.mensaje);
  return resultado;
}

async function rechazar({ invitacionId, usuarioId }) {
  return enTransaccion(async (cliente) => {
    const invitacion = await invitacionesRepo.bloquear(cliente, invitacionId);
    if (!invitacion || invitacion.invitadoId !== usuarioId) {
      throw errores.noEncontrado('La invitacion no existe');
    }
    if (invitacion.estado !== 'pendiente') {
      throw errores.conflicto(`La invitacion ya fue ${invitacion.estado}`);
    }

    // Rechazar no toca el grupo, asi que no hace falta su lock.
    return invitacionesRepo.responder(cliente, invitacionId, 'rechazada');
  });
}

/** La cancela quien la emitio, o cualquier administrador del grupo. */
async function cancelar({ invitacionId, usuarioId }) {
  return enTransaccion(async (cliente) => {
    const referencia = await invitacionesRepo.porId(invitacionId, cliente);
    if (!referencia) throw errores.noEncontrado('La invitacion no existe');

    const grupo = await gruposRepo.bloquear(cliente, referencia.chatId);
    if (!grupo) throw errores.noEncontrado('El grupo ya no existe');

    const invitacion = await invitacionesRepo.bloquear(cliente, invitacionId);
    if (invitacion.estado !== 'pendiente') {
      throw errores.conflicto(`La invitacion ya fue ${invitacion.estado}`);
    }

    if (invitacion.invitadorId !== usuarioId) {
      const solicitante = await miembrosRepo.obtener(referencia.chatId, usuarioId, cliente);
      if (!solicitante || !solicitante.activo || solicitante.rol !== 'admin') {
        throw errores.prohibido('Solo quien invito o un administrador puede cancelar la invitacion');
      }
    }

    return invitacionesRepo.responder(cliente, invitacionId, 'cancelada');
  });
}

async function misPendientes(usuarioId) {
  return invitacionesRepo.pendientesDe(usuarioId);
}

async function pendientesDeChat({ chatId, usuarioId }) {
  await gruposService.exigirMembresia(chatId, usuarioId);
  return invitacionesRepo.pendientesDeChat(chatId);
}

module.exports = { invitar, aceptar, rechazar, cancelar, misPendientes, pendientesDeChat };
