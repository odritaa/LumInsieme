'use strict';

const config = require('../config');

/**
 * Registro EN MEMORIA de las conexiones que atiende esta instancia.
 *
 * Solo conoce los sockets locales. El alcance global lo da el bus de Redis:
 * un mensaje se publica una vez y cada instancia lo reparte entre sus propios
 * sockets. Este objeto nunca debe consultarse para decidir si un usuario
 * "esta conectado" a nivel sistema, solo a nivel de esta replica.
 */
const porChat = new Map();     // chatId -> Set<socket>
const porUsuario = new Map();  // usuarioId -> Set<socket>

function registrarConexion(socket) {
  let conexiones = porUsuario.get(socket.estado.usuarioId);
  if (!conexiones) {
    conexiones = new Set();
    porUsuario.set(socket.estado.usuarioId, conexiones);
  }
  conexiones.add(socket);
  return conexiones.size;
}

function conexionesDeUsuario(usuarioId) {
  return porUsuario.get(usuarioId) || new Set();
}

function suscribir(socket, chatId) {
  if (socket.estado.suscripciones.size >= config.websocket.maxSuscripcionesPorConexion) {
    return false;
  }

  let miembros = porChat.get(chatId);
  if (!miembros) {
    miembros = new Set();
    porChat.set(chatId, miembros);
  }
  miembros.add(socket);
  socket.estado.suscripciones.add(chatId);
  return true;
}

function desuscribir(socket, chatId) {
  const miembros = porChat.get(chatId);
  if (miembros) {
    miembros.delete(socket);
    // Se borra la clave vacia: si no, un servicio de larga vida acumula una
    // entrada por cada chat que existio y el Map crece sin limite.
    if (miembros.size === 0) porChat.delete(chatId);
  }
  socket.estado.suscripciones.delete(chatId);
}

/** Limpia TODO rastro del socket. Debe llamarse en 'close' y en 'error'. */
function eliminarConexion(socket) {
  for (const chatId of Array.from(socket.estado.suscripciones)) {
    desuscribir(socket, chatId);
  }

  const conexiones = porUsuario.get(socket.estado.usuarioId);
  if (conexiones) {
    conexiones.delete(socket);
    if (conexiones.size === 0) porUsuario.delete(socket.estado.usuarioId);
  }
}

function socketsDeChat(chatId) {
  return porChat.get(chatId) || new Set();
}

/** Chats con al menos un socket local: los que hay que latir en presencia. */
function chatsActivos() {
  return Array.from(porChat.keys());
}

function usuariosLocalesEnChat(chatId) {
  const usuarios = new Set();
  for (const socket of socketsDeChat(chatId)) {
    usuarios.add(socket.estado.usuarioId);
  }
  return usuarios;
}

function metricas() {
  let sockets = 0;
  for (const conexiones of porUsuario.values()) sockets += conexiones.size;
  return { sockets, usuarios: porUsuario.size, chats: porChat.size };
}

module.exports = {
  registrarConexion,
  conexionesDeUsuario,
  suscribir,
  desuscribir,
  eliminarConexion,
  socketsDeChat,
  chatsActivos,
  usuariosLocalesEnChat,
  metricas
};
