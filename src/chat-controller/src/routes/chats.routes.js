'use strict';

const express = require('express');

const config = require('../config');
const validar = require('../utils/validar');
const { errores } = require('../utils/errores');
const { asincrono } = require('../middlewares/errores');
const { requiereAuth } = require('../middlewares/auth');
const { limitarMensajes, limitarCreacion } = require('../middlewares/rateLimit');
const gruposService = require('../services/grupos.service');
const mensajesService = require('../services/mensajes.service');
const invitacionesService = require('../services/invitaciones.service');
const gateway = require('../realtime/gateway');

const router = express.Router();

router.use(requiereAuth);

/** Alta de un miembro: se avisa al grupo y se suma el mensaje de sistema. */
async function anunciarAlta(chatId, usuarioId, resultado) {
  await gateway.difundir(chatId, {
    tipo: gateway.SALIENTE.MIEMBRO,
    chatId,
    usuarioId,
    accion: 'alta',
    miembrosActivos: resultado.miembrosActivos
  });
  await gateway.difundir(chatId, {
    tipo: gateway.SALIENTE.MENSAJE,
    chatId,
    mensaje: resultado.mensaje
  });
}

// --- Grupos -----------------------------------------------------------------

router.post('/', limitarCreacion, asincrono(async (req, res) => {
  const nombre = validar.texto(req.body?.nombre, 'nombre', { min: 1, max: 120 });
  const maxMiembros = validar.enteroEnRango(req.body?.maxMiembros, 'maxMiembros', 2, config.chat.maxMiembrosPermitido);
  const eventoId = validar.idEnteroOpcional(req.body?.eventoId, 'eventoId');

  const { grupo } = await gruposService.crear({
    nombre,
    maxMiembros,
    eventoId,
    creadorId: req.usuario.usuarioId,
    token: req.usuario.token
  });

  res.status(201).json({ chat: grupo });
}));

router.get('/', asincrono(async (req, res) => {
  const chats = await gruposService.listarDeUsuario(req.usuario.usuarioId);
  res.json({ chats });
}));

router.get('/:chatId', asincrono(async (req, res) => {
  const chatId = validar.idEntero(req.params.chatId, 'chatId');
  const chat = await gruposService.detalle({ chatId, usuarioId: req.usuario.usuarioId });
  res.json({ chat });
}));

// --- Miembros ---------------------------------------------------------------

/**
 * Auto-union. No acepta un `usuarioId` de tercero: nadie puede sumar a otra
 * persona a un chat sin su consentimiento, ni siquiera un administrador. Para
 * eso estan las invitaciones, que el destinatario tiene que aceptar.
 */
router.post('/:chatId/miembros', asincrono(async (req, res) => {
  const chatId = validar.idEntero(req.params.chatId, 'chatId');
  const usuarioId = req.usuario.usuarioId;

  const ajeno = validar.idEnteroOpcional(req.body?.usuarioId, 'usuarioId');
  if (ajeno !== null && ajeno !== usuarioId) {
    throw errores.prohibido(
      'No se puede agregar a otra persona a un grupo. Envia una invitacion a POST /api/chats/:chatId/invitaciones'
    );
  }

  const resultado = await gruposService.unirse({ chatId, usuarioId });

  if (!resultado.yaEraMiembro) {
    await anunciarAlta(chatId, usuarioId, resultado);
  }

  res.status(resultado.yaEraMiembro ? 200 : 201).json({
    miembro: resultado.miembro,
    yaEraMiembro: resultado.yaEraMiembro
  });
}));

router.delete('/:chatId/miembros/:usuarioId', asincrono(async (req, res) => {
  const chatId = validar.idEntero(req.params.chatId, 'chatId');
  const objetivo = validar.idEntero(req.params.usuarioId, 'usuarioId');
  const solicitante = req.usuario.usuarioId;

  const resultado = await gruposService.salir({
    chatId,
    usuarioId: objetivo,
    expulsadoPor: objetivo === solicitante ? null : solicitante
  });

  // El mensaje de sistema va PRIMERO: el evento de baja corta la suscripcion
  // del afectado, que si no se quedaria sin ver su propia salida.
  if (resultado.mensaje) {
    await gateway.difundir(chatId, {
      tipo: gateway.SALIENTE.MENSAJE,
      chatId,
      mensaje: resultado.mensaje
    });
  }

  if (resultado.nuevoAdmin) {
    await gateway.difundir(chatId, {
      tipo: gateway.SALIENTE.MENSAJE,
      chatId,
      mensaje: resultado.mensajeAdmin
    });
    await gateway.difundir(chatId, {
      tipo: gateway.SALIENTE.MIEMBRO,
      chatId,
      usuarioId: resultado.nuevoAdmin.usuarioId,
      accion: 'nuevo-admin'
    });
  }

  if (resultado.grupoEliminado) {
    // El grupo ya no existe: se avisa para que el cliente lo saque de su lista
    // en vez de dejarlo colgado mostrando un chat inaccesible.
    await gateway.difundir(chatId, { tipo: gateway.SALIENTE.CHAT_ELIMINADO, chatId });
  }

  await gateway.difundir(chatId, {
    tipo: gateway.SALIENTE.MIEMBRO,
    chatId,
    usuarioId: objetivo,
    accion: 'baja',
    miembrosActivos: resultado.restantes
  });

  res.json({
    salio: true,
    miembrosRestantes: resultado.restantes,
    grupoEliminado: resultado.grupoEliminado,
    nuevoAdminId: resultado.nuevoAdmin ? resultado.nuevoAdmin.usuarioId : null
  });
}));

// --- Invitaciones -----------------------------------------------------------

/**
 * Cualquier miembro activo puede invitar. La invitacion no da de alta a nadie
 * ni reserva cupo: solo el destinatario puede convertirla en membresia.
 */
router.post('/:chatId/invitaciones', limitarMensajes, asincrono(async (req, res) => {
  const chatId = validar.idEntero(req.params.chatId, 'chatId');
  const invitadoId = validar.idEntero(req.body?.usuarioId, 'usuarioId');

  const { invitacion, grupo } = await invitacionesService.invitar({
    chatId,
    invitadoId,
    invitadorId: req.usuario.usuarioId
  });

  // Al invitado por su canal personal: todavia no pertenece al grupo, asi que
  // por la sala del chat no le llegaria nada.
  await gateway.notificarUsuario(invitadoId, {
    tipo: gateway.SALIENTE.INVITACION,
    accion: 'recibida',
    invitacion: {
      ...invitacion,
      chat: { id: grupo.id, nombre: grupo.nombre, maxMiembros: grupo.maxMiembros }
    }
  });

  // Al grupo, para que la lista de invitaciones pendientes se actualice sola.
  await gateway.difundir(chatId, {
    tipo: gateway.SALIENTE.INVITACION,
    accion: 'emitida',
    chatId,
    invitacion
  });

  res.status(201).json({ invitacion });
}));

router.get('/:chatId/invitaciones', asincrono(async (req, res) => {
  const chatId = validar.idEntero(req.params.chatId, 'chatId');
  const invitaciones = await invitacionesService.pendientesDeChat({
    chatId,
    usuarioId: req.usuario.usuarioId
  });
  res.json({ invitaciones });
}));

// --- Mensajes ---------------------------------------------------------------

router.get('/:chatId/mensajes', asincrono(async (req, res) => {
  const chatId = validar.idEntero(req.params.chatId, 'chatId');
  const antesDe = validar.seqOpcional(req.query.antesDe, 'antesDe');
  const limite = req.query.limite
    ? validar.enteroEnRango(req.query.limite, 'limite', 1, config.chat.paginaHistorialMax)
    : config.chat.paginaHistorial;

  const resultado = await mensajesService.historial({
    chatId,
    usuarioId: req.usuario.usuarioId,
    antesDe,
    limite
  });

  res.json(resultado);
}));

/**
 * Alternativa HTTP al envio por WebSocket: sirve de respaldo cuando el socket
 * esta cortado y evita que el usuario pierda lo que escribio.
 */
router.post('/:chatId/mensajes', limitarMensajes, asincrono(async (req, res) => {
  const chatId = validar.idEntero(req.params.chatId, 'chatId');
  const contenido = validar.contenidoMensaje(req.body?.contenido, 'contenido', config.chat.maxLongitudMensaje);
  const clientMsgId = validar.uuid(req.body?.clientMsgId, 'clientMsgId');

  const { mensaje, duplicado } = await mensajesService.publicar({
    chatId,
    autorId: req.usuario.usuarioId,
    contenido,
    clientMsgId
  });

  if (!duplicado) {
    await gateway.difundir(chatId, { tipo: gateway.SALIENTE.MENSAJE, chatId, mensaje });
  }

  res.status(duplicado ? 200 : 201).json({ mensaje, duplicado });
}));

router.post('/:chatId/leido', asincrono(async (req, res) => {
  const chatId = validar.idEntero(req.params.chatId, 'chatId');
  const seq = validar.seqOpcional(req.body?.seq, 'seq') ?? 0;

  const miembro = await mensajesService.marcarLeido({
    chatId,
    usuarioId: req.usuario.usuarioId,
    seq
  });

  await gateway.difundir(chatId, {
    tipo: gateway.SALIENTE.LEIDO,
    chatId,
    usuarioId: req.usuario.usuarioId,
    seq: miembro.ultimoLeidoSeq
  });

  res.json({ ultimoLeidoSeq: miembro.ultimoLeidoSeq });
}));

module.exports = router;
