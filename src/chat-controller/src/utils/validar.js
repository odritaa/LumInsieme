'use strict';

const { errores } = require('./errores');

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Caracteres de control y espacios invisibles. Sin filtrarlos un usuario puede
// enviar nombres "en blanco", texto oculto o marcas bidireccionales que alteran
// como se lee el resto de la conversacion en la interfaz.
const CONTROL = '\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F';
const INVISIBLES = '\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2060-\\u2064\\uFEFF';

const RE_CONTROL_TOTAL = new RegExp(`[${CONTROL}\\u0009\\u000A${INVISIBLES}]`, 'g');
const RE_CONTROL_SALVO_SALTO = new RegExp(`[${CONTROL}${INVISIBLES}]`, 'g');

/**
 * Convierte a entero SIN tolerar sobrantes.
 *
 * Number.parseInt('1 OR 1=1') devuelve 1: se queda con el prefijo numerico y
 * descarta el resto en silencio. Eso hace que '5abc' pase como el chat 5 y que
 * una entrada manipulada nunca llegue a rechazarse. Se exige que la cadena
 * completa sea un entero.
 */
function aEnteroEstricto(valor) {
  if (typeof valor === 'number') {
    return Number.isSafeInteger(valor) ? valor : NaN;
  }
  if (typeof valor !== 'string') return NaN;

  const limpio = valor.trim();
  if (!/^-?\d+$/.test(limpio)) return NaN;

  const numero = Number(limpio);
  return Number.isSafeInteger(numero) ? numero : NaN;
}

function idEntero(valor, campo) {
  const numero = aEnteroEstricto(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw errores.invalido(`El campo "${campo}" debe ser un identificador entero positivo`);
  }
  return numero;
}

function idEnteroOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  return idEntero(valor, campo);
}

function seqOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = aEnteroEstricto(valor);
  if (!Number.isSafeInteger(numero) || numero < 0) {
    throw errores.invalido(`El campo "${campo}" debe ser un entero no negativo`);
  }
  return numero;
}

function texto(valor, campo, { min = 1, max = 255 } = {}) {
  if (typeof valor !== 'string') {
    throw errores.invalido(`El campo "${campo}" debe ser texto`);
  }
  const limpio = valor.replace(RE_CONTROL_TOTAL, ' ').replace(/\s+/g, ' ').trim();
  if (limpio.length < min || limpio.length > max) {
    throw errores.invalido(`El campo "${campo}" debe tener entre ${min} y ${max} caracteres`);
  }
  return limpio;
}

function contenidoMensaje(valor, campo, max) {
  if (typeof valor !== 'string') {
    throw errores.invalido(`El campo "${campo}" debe ser texto`);
  }
  // En el cuerpo del mensaje se preservan los saltos de linea reales.
  const limpio = valor
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(RE_CONTROL_SALVO_SALTO, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (limpio.length < 1) {
    throw errores.invalido('El mensaje no puede estar vacio');
  }
  if (limpio.length > max) {
    throw errores.invalido(`El mensaje supera el maximo de ${max} caracteres`);
  }
  return limpio;
}

function uuid(valor, campo) {
  if (typeof valor !== 'string' || !RE_UUID.test(valor)) {
    throw errores.invalido(`El campo "${campo}" debe ser un UUID valido`);
  }
  return valor.toLowerCase();
}

function enteroEnRango(valor, campo, min, max) {
  const numero = aEnteroEstricto(valor);
  if (!Number.isSafeInteger(numero) || numero < min || numero > max) {
    throw errores.invalido(`El campo "${campo}" debe ser un entero entre ${min} y ${max}`);
  }
  return numero;
}

module.exports = {
  idEntero,
  idEnteroOpcional,
  seqOpcional,
  texto,
  contenidoMensaje,
  uuid,
  enteroEnRango,
  RE_UUID
};
