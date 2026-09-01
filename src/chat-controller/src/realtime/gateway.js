'use strict';

const { URL } = require('url');
const { WebSocketServer } = require('ws');

const config = require('../config');
const log = require('../utils/log');
const { AppError } = require('../utils/errores');
const { verificarToken, extraerToken } = require('../auth/jwt');

const salas = require('./salas');
const bus = require('./bus');
const { ENTRANTE, SALIENTE, CIERRE, DESTINO, analizar } = require('./protocolo');

const gruposService = require('../services/grupos.service');
const mensajesService = require('../services/mensajes.service');
const cache = require('../services/cache.service');

const MAX_TIMEOUT = 2147483647; // Limite de setTimeout: por encima se dispara al instante.

let wss = null;
let latido = null;
let refrescoPresencia = null;
let desligarBus = null;

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

function enviar(socket, sobre) {
  if (socket.readyState !== socket.OPEN) return false;

  // Un cliente que no drena (pestana en segundo plano, red saturada) haria
  // crecer el buffer del socket hasta agotar la memoria del proceso. Se corta
  // la conexion y que reconecte con `desdeSeq`.
  if (socket.bufferedAmount > config.websocket.maxBufferBytes) {
    log.warn('Cliente lento desconectado por backpressure', {
      usuarioId: socket.estado.usuarioId,
      buffer: socket.bufferedAmount
    });
    socket.close(CIERRE.CLIENTE_LENTO, 'Cliente lento');
    return false;
  }

  socket.send(JSON.stringify(sobre), (error) => {
    if (error) log.debug('Fallo el envio de un marco', { error: error.message });
  });
  return true;
}

function enviarError(socket, codigo, mensaje, extra = {}) {
  enviar(socket, { tipo: SALIENTE.ERROR, codigo, mensaje, ...extra });
}

/** Entrega a los sockets LOCALES suscritos al chat. */
function entregarLocal(chatId, sobre) {
  const { excluirUsuario, ...limpio } = sobre;
  for (const socket of salas.socketsDeChat(chatId)) {
    if (excluirUsuario !== undefined && socket.estado.usuarioId === excluirUsuario) continue;
    enviar(socket, limpio);
  }
}

/**
 * Entrega a todas las conexiones LOCALES de un usuario, este suscrito a lo que
 * este.
 *
 * Hace falta un canal aparte del de chat porque hay avisos dirigidos a alguien
 * que todavia NO pertenece al grupo: una invitacion es exactamente eso. Por la
 * sala del chat nunca le llegaria.
 */
function entregarAUsuario(usuarioId, sobre) {
  for (const socket of salas.conexionesDeUsuario(usuarioId)) {
    enviar(socket, sobre);
  }
}

/**
 * Corta la suscripcion de quien dejo de ser miembro.
 *
 * Sin esto, el expulsado sigue recibiendo todos los mensajes del grupo por el
 * socket que ya tenia abierto: la pertenencia solo se comprueba al suscribirse,
 * no en cada entrega. Se ejecuta en TODAS las instancias porque el socket
 * afectado puede estar en cualquiera.
 */
function expulsarDeSala(chatId, usuarioId) {
  for (const socket of Array.from(salas.socketsDeChat(chatId))) {
    if (socket.estado.usuarioId !== usuarioId) continue;
    salas.desuscribir(socket, chatId);
    enviar(socket, {
      tipo: SALIENTE.DESUSCRITO,
      chatId,
      motivo: 'Ya no sos miembro de este grupo'
    });
  }
}

/**
 * Aplica un evento del grupo sobre los sockets locales.
 *
 * Es el UNICO punto por el que pasan los eventos, vengan del bus o del camino
 * degradado sin Redis. Duplicar esta logica en los dos caminos haria que, con
 * Redis caido, los efectos secundarios (como cortar al expulsado) no se
 * aplicasen.
 */
function procesarEvento({ destino, id, sobre }) {
  if (destino === DESTINO.USUARIO) {
    entregarAUsuario(id, sobre);
    return;
  }

  entregarLocal(id, sobre);

  if (sobre.tipo === SALIENTE.MIEMBRO && sobre.accion === 'baja') {
    // Se entrega primero y se corta despues: si se cortase antes, el afectado
    // no recibiria la confirmacion de su propia baja.
    expulsarDeSala(id, sobre.usuarioId);
    return;
  }

  // El grupo dejo de existir: se desuscribe a todo el que quedara escuchando
  // para no dejar sockets atados a un chat fantasma.
  if (sobre.tipo === SALIENTE.CHAT_ELIMINADO) {
    for (const socket of Array.from(salas.socketsDeChat(id))) {
      salas.desuscribir(socket, id);
    }
  }
}

/**
 * Publica un evento y deja que lo entreguen TODAS las instancias, incluida
 * esta, al recibirlo del bus. Solo si Redis no responde se procesa en local
 * para no dejar el chat mudo.
 */
async function publicar(destino, id, sobre) {
  const evento = { destino, id, sobre, origen: config.instanciaId };
  const publicado = await bus.publicar(evento);
  if (!publicado) procesarEvento(evento);
}

/** Difunde a todo el grupo, este donde este cada miembro. */
async function difundir(chatId, sobre) {
  await publicar(DESTINO.CHAT, chatId, sobre);
}

/** Avisa a una persona concreta, pertenezca o no al grupo del que se trate. */
async function notificarUsuario(usuarioId, sobre) {
  await publicar(DESTINO.USUARIO, usuarioId, sobre);
}

// ---------------------------------------------------------------------------
// Limitacion de tasa (token bucket por conexion)
// ---------------------------------------------------------------------------

function consumirToken(estado) {
  const { capacidad, recargaPorSegundo } = config.websocket.rateLimit;
  const ahora = Date.now();
  const transcurridoSeg = (ahora - estado.rate.ultimo) / 1000;

  estado.rate.tokens = Math.min(capacidad, estado.rate.tokens + transcurridoSeg * recargaPorSegundo);
  estado.rate.ultimo = ahora;

  if (estado.rate.tokens < 1) return false;
  estado.rate.tokens -= 1;
  return true;
}

// ---------------------------------------------------------------------------
// Handshake
// ---------------------------------------------------------------------------

function origenPermitido(origen) {
  // Un cliente que no es navegador (tests, otro microservicio) no manda Origin.
  // En produccion se exige siempre; en desarrollo se tolera su ausencia.
  if (!origen) return !config.esProduccion;
  return config.websocket.origenes.includes(origen);
}

function rechazarUpgrade(socket, estado, motivo) {
  socket.write(
    `HTTP/1.1 ${estado} ${motivo}\r\n` +
    'Connection: close\r\n' +
    'Content-Length: 0\r\n\r\n'
  );
  socket.destroy();
}

function manejarUpgrade(req, socket, head) {
  socket.on('error', (error) => log.debug('Error de socket en upgrade', { error: error.message }));

  let ruta;
  try {
    ruta = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  } catch (error) {
    return rechazarUpgrade(socket, 400, 'Bad Request');
  }

  if (ruta !== config.websocket.ruta) {
    return rechazarUpgrade(socket, 404, 'Not Found');
  }

  // El navegador NO aplica la politica del mismo origen a los WebSockets: sin
  // esta comprobacion cualquier web abierta en otra pestana podria conectarse
  // con la cookie de sesion del usuario y leer sus chats (CSWSH).
  if (!origenPermitido(req.headers.origin)) {
    log.warn('Handshake rechazado por origen no permitido', { origen: req.headers.origin });
    return rechazarUpgrade(socket, 403, 'Forbidden');
  }

  let identidad;
  try {
    identidad = verificarToken(extraerToken(req));
  } catch (error) {
    return rechazarUpgrade(socket, 401, 'Unauthorized');
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, identidad);
  });
}

// ---------------------------------------------------------------------------
// Ciclo de vida de la conexion
// ---------------------------------------------------------------------------

function programarCaducidad(socket, expiraEnMs) {
  if (!expiraEnMs) return;

  const restante = expiraEnMs - Date.now();
  if (restante <= 0) {
    socket.close(CIERRE.SESION_EXPIRADA, 'Sesion expirada');
    return;
  }

  // Un WebSocket puede vivir mas que el JWT que lo autorizo. Sin este cierre,
  // una conexion abierta seguiria operando con una sesion ya caducada.
  socket.estado.temporizadorCaducidad = setTimeout(() => {
    enviarError(socket, 'SESION_EXPIRADA', 'Tu sesion expiro, volve a iniciar sesion');
    socket.close(CIERRE.SESION_EXPIRADA, 'Sesion expirada');
  }, Math.min(restante, MAX_TIMEOUT));
}

function alConectar(socket, req, identidad) {
  socket.estado = {
    usuarioId: identidad.usuarioId,
    nombre: identidad.nombre,
    suscripciones: new Set(),
    vivo: true,
    violaciones: 0,
    rate: { tokens: config.websocket.rateLimit.capacidad, ultimo: Date.now() },
    temporizadorCaducidad: null,
    conectadoEn: Date.now()
  };

  const abiertas = salas.registrarConexion(socket);

  // Al recargar la pagina el socket viejo puede tardar hasta un latido en
  // detectarse muerto. Se cierra el mas antiguo, nunca el recien llegado, para
  // que la pestana que el usuario esta mirando siempre funcione.
  if (abiertas > config.websocket.maxConexionesPorUsuario) {
    const conexiones = Array.from(salas.conexionesDeUsuario(identidad.usuarioId))
      .sort((a, b) => a.estado.conectadoEn - b.estado.conectadoEn);
    const sobrantes = conexiones.slice(0, abiertas - config.websocket.maxConexionesPorUsuario);
    for (const vieja of sobrantes) {
      vieja.close(CIERRE.RATE_LIMIT, 'Demasiadas conexiones simultaneas');
    }
  }

  programarCaducidad(socket, identidad.expiraEnMs);

  socket.on('pong', () => { socket.estado.vivo = true; });
  socket.on('message', (datos) => { manejarMarco(socket, datos).catch((error) => {
    log.error('Fallo no controlado procesando un marco', { error: error.message, stack: error.stack });
    enviarError(socket, 'ERROR_INTERNO', 'Error interno procesando el mensaje');
  }); });
  socket.on('error', (error) => {
    log.debug('Error de WebSocket', { usuarioId: socket.estado.usuarioId, error: error.message });
  });
  socket.on('close', () => { alCerrar(socket).catch((error) => {
    log.error('Fallo limpiando la conexion', { error: error.message });
  }); });

  enviar(socket, {
    tipo: SALIENTE.BIENVENIDA,
    usuarioId: identidad.usuarioId,
    instancia: config.instanciaId,
    heartbeatMs: config.websocket.intervaloHeartbeatMs,
    maxLongitudMensaje: config.chat.maxLongitudMensaje
  });

  log.info('WebSocket conectado', { usuarioId: identidad.usuarioId, ip: req.socket.remoteAddress });
}

async function alCerrar(socket) {
  if (socket.estado.temporizadorCaducidad) clearTimeout(socket.estado.temporizadorCaducidad);

  const chats = Array.from(socket.estado.suscripciones);
  // El registro se limpia ANTES de calcular la presencia, para que el propio
  // socket que se va no cuente como presente.
  salas.eliminarConexion(socket);

  for (const chatId of chats) {
    await anunciarSalidaDePresencia(socket.estado.usuarioId, chatId);
  }

  log.info('WebSocket desconectado', {
    usuarioId: socket.estado.usuarioId,
    duracionSeg: Math.round((Date.now() - socket.estado.conectadoEn) / 1000)
  });
}

/**
 * Marca al usuario como ausente solo si ya no le queda ningun socket local en
 * ese chat: con dos pestanas abiertas, cerrar una no debe dejarlo "offline".
 */
async function anunciarSalidaDePresencia(usuarioId, chatId) {
  if (salas.usuariosLocalesEnChat(chatId).has(usuarioId)) return;

  await cache.marcarAusente(chatId, usuarioId);
  await difundir(chatId, {
    tipo: SALIENTE.PRESENCIA,
    chatId,
    usuarioId,
    estado: 'desconectado'
  });
}

// ---------------------------------------------------------------------------
// Despacho de marcos
// ---------------------------------------------------------------------------

async function manejarMarco(socket, datos) {
  let marco;
  try {
    marco = analizar(datos.toString());
  } catch (error) {
    socket.estado.violaciones += 1;
    enviarError(socket, error.codigo || 'SOLICITUD_INVALIDA', error.message);
    // Un cliente que solo manda basura no se queda consumiendo recursos.
    if (socket.estado.violaciones > 20) socket.close(CIERRE.RATE_LIMIT, 'Demasiados marcos invalidos');
    return;
  }

  if (marco.tipo === ENTRANTE.PING) {
    return void enviar(socket, { tipo: SALIENTE.PONG, ts: Date.now() });
  }

  if (!consumirToken(socket.estado)) {
    enviarError(socket, 'RATE_LIMIT', 'Estas enviando demasiado rapido, espera un momento');
    socket.estado.violaciones += 1;
    if (socket.estado.violaciones > 30) socket.close(CIERRE.RATE_LIMIT, 'Rate limit excedido');
    return;
  }

  try {
    switch (marco.tipo) {
      case ENTRANTE.SUSCRIBIR:    return await alSuscribir(socket, marco);
      case ENTRANTE.DESUSCRIBIR:  return await alDesuscribir(socket, marco);
      case ENTRANTE.MENSAJE:      return await alMensaje(socket, marco);
      case ENTRANTE.LEIDO:        return await alLeido(socket, marco);
      case ENTRANTE.ESCRIBIENDO:  return await alEscribiendo(socket, marco);
      default:                    return;
    }
  } catch (error) {
    if (error instanceof AppError) {
      return void enviarError(socket, error.codigo, error.message, {
        chatId: marco.chatId,
        clientMsgId: marco.clientMsgId
      });
    }
    log.error('Error procesando marco', { tipo: marco.tipo, error: error.message, stack: error.stack });
    enviarError(socket, 'ERROR_INTERNO', 'Error interno del servidor', { clientMsgId: marco.clientMsgId });
  }
}

async function alSuscribir(socket, { chatId, desdeSeq }) {
  // La pertenencia se comprueba contra PostgreSQL en cada suscripcion: es la
  // unica autorizacion real. El cliente no puede afirmar que pertenece.
  await gruposService.exigirMembresia(chatId, socket.estado.usuarioId);

  if (socket.estado.suscripciones.has(chatId)) {
    return void enviar(socket, { tipo: SALIENTE.SUSCRITO, chatId, yaSuscrito: true });
  }

  if (!salas.suscribir(socket, chatId)) {
    return void enviarError(socket, 'DEMASIADAS_SUSCRIPCIONES',
      `Una conexion no puede seguir mas de ${config.websocket.maxSuscripcionesPorConexion} chats`);
  }

  await cache.marcarPresente(chatId, socket.estado.usuarioId);

  // Reconexion: se devuelve solo lo que el cliente se perdio.
  //
  // El alta en la sala ocurre ANTES de leer los pendientes, a proposito. Un
  // mensaje que llegue durante esa lectura se entregara dos veces (en la lista
  // y en vivo), y el cliente lo descarta por `seq`. Al reves habria una ventana
  // en la que el mensaje no esta ni en la lista ni en la entrega en vivo: un
  // hueco silencioso e irrecuperable. Duplicar es barato; perder no.
  let pendientes = [];
  if (desdeSeq !== null) {
    const alDia = await mensajesService.ponerseAlDia({
      chatId,
      usuarioId: socket.estado.usuarioId,
      desdeSeq,
      limite: config.chat.paginaHistorial
    });
    pendientes = alDia.mensajes;

    // Si falta mas de una pagina, el cliente debe rehacer el historial por REST
    // en vez de creer que ya esta al dia.
    if (alDia.hayMas) {
      enviar(socket, { tipo: SALIENTE.ERROR, codigo: 'HISTORIAL_INCOMPLETO', chatId,
        mensaje: 'Hay mas mensajes de los que caben en la puesta al dia, recarga el historial' });
    }
  }

  enviar(socket, {
    tipo: SALIENTE.SUSCRITO,
    chatId,
    pendientes,
    conectados: await cache.presentes(chatId)
  });

  await difundir(chatId, {
    tipo: SALIENTE.PRESENCIA,
    chatId,
    usuarioId: socket.estado.usuarioId,
    estado: 'conectado'
  });
}

async function alDesuscribir(socket, { chatId }) {
  if (!socket.estado.suscripciones.has(chatId)) return;
  salas.desuscribir(socket, chatId);
  enviar(socket, { tipo: SALIENTE.DESUSCRITO, chatId });
  await anunciarSalidaDePresencia(socket.estado.usuarioId, chatId);
}

async function alMensaje(socket, { chatId, contenido, clientMsgId }) {
  const { mensaje, duplicado } = await mensajesService.publicar({
    chatId,
    autorId: socket.estado.usuarioId,
    contenido,
    clientMsgId
  });

  // El ACK va directo al autor (no por el bus): le confirma la persistencia y
  // le da el `seq` con el que reemplaza su mensaje optimista.
  enviar(socket, {
    tipo: SALIENTE.ACK,
    chatId,
    clientMsgId,
    id: mensaje.id,
    seq: mensaje.seq,
    creadoEn: mensaje.creadoEn,
    duplicado
  });

  // Un reintento ya persistido no se vuelve a difundir: el resto del grupo ya
  // lo recibio la primera vez.
  if (duplicado) return;

  await difundir(chatId, { tipo: SALIENTE.MENSAJE, chatId, mensaje });
}

async function alLeido(socket, { chatId, seq }) {
  await mensajesService.marcarLeido({ chatId, usuarioId: socket.estado.usuarioId, seq });
  await difundir(chatId, {
    tipo: SALIENTE.LEIDO,
    chatId,
    usuarioId: socket.estado.usuarioId,
    seq
  });
}

async function alEscribiendo(socket, { chatId }) {
  if (!socket.estado.suscripciones.has(chatId)) return;
  // Senal efimera: no se persiste ni se le devuelve al propio autor.
  await difundir(chatId, {
    tipo: SALIENTE.ESCRIBIENDO,
    chatId,
    usuarioId: socket.estado.usuarioId,
    excluirUsuario: socket.estado.usuarioId
  });
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

function iniciarLatido() {
  // TCP no avisa de un cable desenchufado ni de un movil que pierde cobertura:
  // sin ping/pong esas conexiones quedan "abiertas" para siempre, ocupando
  // memoria y falseando la presencia.
  latido = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.estado) continue;
      if (socket.estado.vivo === false) {
        log.debug('Conexion sin respuesta terminada', { usuarioId: socket.estado.usuarioId });
        socket.terminate();
        continue;
      }
      socket.estado.vivo = false;
      socket.ping();
    }
  }, config.websocket.intervaloHeartbeatMs);

  latido.unref?.();
}

function iniciarRefrescoPresencia() {
  // Las entradas de presencia caducan solas; hay que renovarlas mientras la
  // conexion siga viva.
  const intervalo = Math.max(Math.floor((config.redis.ttlPresenciaSeg * 1000) / 3), 5000);

  refrescoPresencia = setInterval(() => {
    for (const chatId of salas.chatsActivos()) {
      for (const usuarioId of salas.usuariosLocalesEnChat(chatId)) {
        cache.marcarPresente(chatId, usuarioId).catch(() => {});
      }
    }
  }, intervalo);

  refrescoPresencia.unref?.();
}

function conectarBus() {
  desligarBus = bus.alRecibir((evento) => procesarEvento(evento));
}

async function iniciar(servidorHttp) {
  wss = new WebSocketServer({
    noServer: true,
    maxPayload: config.websocket.maxPayloadBytes,
    // Se desactiva la compresion por mensaje: en marcos de chat (cortos y
    // frecuentes) cuesta mas CPU y memoria de la que ahorra en ancho de banda.
    perMessageDeflate: false
  });

  wss.on('connection', alConectar);
  wss.on('error', (error) => log.error('Error del servidor WebSocket', { error: error.message }));

  servidorHttp.on('upgrade', manejarUpgrade);

  await bus.iniciar().catch((error) => {
    // Sin bus el servicio arranca igual, en modo degradado a una sola instancia.
    log.warn('El bus de eventos no pudo iniciarse, se opera en modo local', { error: error.message });
  });

  conectarBus();
  iniciarLatido();
  iniciarRefrescoPresencia();

  log.info('Gateway WebSocket iniciado', { ruta: config.websocket.ruta });
  return wss;
}

const GRACIA_CIERRE_MS = 2000;

async function detener() {
  if (latido) clearInterval(latido);
  if (refrescoPresencia) clearInterval(refrescoPresencia);
  if (desligarBus) desligarBus();

  if (wss) {
    for (const socket of wss.clients) {
      if (socket.estado?.temporizadorCaducidad) clearTimeout(socket.estado.temporizadorCaducidad);
      socket.close(CIERRE.APAGANDO, 'El servidor se esta reiniciando');
    }

    // `close()` solo envia el marco de cierre y espera la respuesta del cliente.
    // Un cliente que no contesta dejaria la conexion TCP viva, y con ella
    // `servidor.close()` colgado hasta el timeout de apagado. Tras la gracia se
    // corta por lo sano.
    await new Promise((resolver) => setTimeout(resolver, GRACIA_CIERRE_MS));
    for (const socket of wss.clients) socket.terminate();

    await new Promise((resolver) => wss.close(resolver));
  }

  await bus.detener();
}

module.exports = {
  iniciar,
  detener,
  difundir,
  notificarUsuario,
  SALIENTE,
  metricas: salas.metricas
};
