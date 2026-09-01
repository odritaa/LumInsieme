'use strict';

const express = require('express');

const validar = require('../utils/validar');
const { asincrono } = require('../middlewares/errores');
const { requiereAuth } = require('../middlewares/auth');
const invitacionesService = require('../services/invitaciones.service');
const gateway = require('../realtime/gateway');

const router = express.Router();

router.use(requiereAuth);

/**
 * Avisa al grupo de que una invitacion dejo de estar pendiente, para que la
 * lista que ven sus miembros se mantenga al dia sin recargar.
 */
async function anunciarResolucion(invitacion) {
  await gateway.difundir(invitacion.chatId, {
    tipo: gateway.SALIENTE.INVITACION,
    accion: 'resuelta',
    chatId: invitacion.chatId,
    invitacionId: invitacion.id,
    invitadoId: invitacion.invitadoId,
    estado: invitacion.estado
  });
}

/** Invitaciones pendientes que recibio el usuario. */
router.get('/', asincrono(async (req, res) => {
  const invitaciones = await invitacionesService.misPendientes(req.usuario.usuarioId);
  res.json({ invitaciones });
}));

/**
 * Aceptar es el unico camino por el que alguien entra a un grupo por
 * invitacion. El cupo se comprueba aca, no al invitar: entre una cosa y otra
 * el grupo pudo llenarse.
 */
router.post('/:invitacionId/aceptar', asincrono(async (req, res) => {
  const invitacionId = validar.idEntero(req.params.invitacionId, 'invitacionId');

  const resultado = await invitacionesService.aceptar({
    invitacionId,
    usuarioId: req.usuario.usuarioId
  });

  if (!resultado.yaEraMiembro) {
    await gateway.difundir(resultado.chatId, {
      tipo: gateway.SALIENTE.MIEMBRO,
      chatId: resultado.chatId,
      usuarioId: req.usuario.usuarioId,
      accion: 'alta',
      miembrosActivos: resultado.miembrosActivos
    });
    await gateway.difundir(resultado.chatId, {
      tipo: gateway.SALIENTE.MENSAJE,
      chatId: resultado.chatId,
      mensaje: resultado.mensaje
    });
  }

  await anunciarResolucion({
    id: invitacionId,
    chatId: resultado.chatId,
    invitadoId: req.usuario.usuarioId,
    estado: 'aceptada'
  });

  res.status(resultado.yaEraMiembro ? 200 : 201).json({
    chatId: resultado.chatId,
    miembro: resultado.miembro,
    yaEraMiembro: resultado.yaEraMiembro
  });
}));

router.post('/:invitacionId/rechazar', asincrono(async (req, res) => {
  const invitacionId = validar.idEntero(req.params.invitacionId, 'invitacionId');
  const invitacion = await invitacionesService.rechazar({
    invitacionId,
    usuarioId: req.usuario.usuarioId
  });

  await anunciarResolucion(invitacion);

  res.json({ invitacion });
}));

/** La cancela quien la emitio, o un administrador del grupo. */
router.delete('/:invitacionId', asincrono(async (req, res) => {
  const invitacionId = validar.idEntero(req.params.invitacionId, 'invitacionId');
  const invitacion = await invitacionesService.cancelar({
    invitacionId,
    usuarioId: req.usuario.usuarioId
  });

  await anunciarResolucion(invitacion);

  // Al invitado, para que el aviso desaparezca de su pantalla en vez de
  // quedarse mostrando una invitacion que ya no puede aceptar.
  await gateway.notificarUsuario(invitacion.invitadoId, {
    tipo: gateway.SALIENTE.INVITACION,
    accion: 'cancelada',
    invitacionId: invitacion.id,
    chatId: invitacion.chatId
  });

  res.json({ invitacion });
}));

module.exports = router;
