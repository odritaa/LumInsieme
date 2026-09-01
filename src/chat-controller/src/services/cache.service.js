'use strict';

const config = require('../config');
const redis = require('../config/redis');

const { maxRecientes, ttlRecientesSeg, ttlPresenciaSeg } = config.redis;

const claveRecientes = (chatId) => redis.clave('recientes', String(chatId));
const clavePresencia = (chatId) => redis.clave('presencia', String(chatId));

/**
 * Empuja un mensaje ya confirmado en PostgreSQL a la lista de recientes.
 *
 * Se llama SIEMPRE despues del COMMIT. Escribir antes dejaria mensajes
 * "fantasma" en cache si la transaccion termina en ROLLBACK.
 */
async function empujarReciente(chatId, mensaje) {
  await redis.intentar(async (cliente) => {
    const clave = claveRecientes(chatId);
    await cliente
      .multi()
      .rpush(clave, JSON.stringify(mensaje))
      .ltrim(clave, -maxRecientes, -1)
      .expire(clave, ttlRecientesSeg)
      .exec();
  });
}

/**
 * Ultimos mensajes desde cache.
 *
 * Devuelve null en cuanto la ventana no es de fiar (Redis caido, clave vencida,
 * hueco por un corte de Redis a mitad de conversacion) para que el llamador vaya
 * a PostgreSQL. Una cache que miente es peor que no tener cache.
 */
async function recientes(chatId, limite) {
  if (limite > maxRecientes) return null;

  return redis.intentar(async (cliente) => {
    const clave = claveRecientes(chatId);
    const crudos = await cliente.lrange(clave, 0, -1);
    if (crudos.length === 0) return null;

    let mensajes;
    try {
      mensajes = crudos.map((item) => JSON.parse(item));
    } catch (error) {
      await cliente.del(clave);
      return null;
    }

    // Los RPUSH ocurren despues del COMMIT y son concurrentes entre si, asi que
    // pueden llegar desordenados aunque los mensajes se hayan insertado en orden.
    mensajes.sort((a, b) => a.seq - b.seq);

    // `seq` es correlativa sin huecos: si el rango no cuadra con la cantidad de
    // elementos, falta algo en el medio (Redis estuvo caido un rato) y la
    // ventana no sirve.
    const esperados = mensajes[mensajes.length - 1].seq - mensajes[0].seq + 1;
    if (esperados !== mensajes.length) {
      await cliente.del(clave);
      return null;
    }

    // La ventana es utilizable si contiene la cola completa (esta llena) o si
    // arranca en el primer mensaje del chat. Sin esta segunda condicion, un
    // grupo recien creado nunca aprovecharia la cache.
    const ventanaCompleta = mensajes.length >= maxRecientes || mensajes[0].seq === 1;
    if (!ventanaCompleta) return null;

    return mensajes.slice(-limite);
  }, null);
}

async function invalidarRecientes(chatId) {
  await redis.intentar((cliente) => cliente.del(claveRecientes(chatId)));
}

/**
 * Presencia con auto-sanacion: cada entrada guarda su ultimo latido y las
 * vencidas se ignoran al leer. Si una instancia muere sin poder limpiar, sus
 * usuarios desaparecen solos y no quedan "conectados" para siempre.
 */
async function marcarPresente(chatId, usuarioId) {
  await redis.intentar(async (cliente) => {
    const clave = clavePresencia(chatId);
    await cliente.hset(clave, String(usuarioId), Date.now());
    await cliente.expire(clave, ttlPresenciaSeg * 2);
  });
}

async function marcarAusente(chatId, usuarioId) {
  await redis.intentar((cliente) => cliente.hdel(clavePresencia(chatId), String(usuarioId)));
}

async function presentes(chatId) {
  return redis.intentar(async (cliente) => {
    const mapa = await cliente.hgetall(clavePresencia(chatId));
    const limite = Date.now() - ttlPresenciaSeg * 1000;
    const vivos = [];
    const muertos = [];

    for (const [usuarioId, latido] of Object.entries(mapa)) {
      if (Number(latido) >= limite) vivos.push(Number(usuarioId));
      else muertos.push(usuarioId);
    }

    if (muertos.length > 0) await cliente.hdel(clavePresencia(chatId), ...muertos);
    return vivos;
  }, []);
}

module.exports = {
  empujarReciente,
  recientes,
  invalidarRecientes,
  marcarPresente,
  marcarAusente,
  presentes
};
