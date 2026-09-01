'use strict';

const http = require('http');

const config = require('./config');
const log = require('./utils/log');
const { crearApp } = require('./app');
const db = require('./config/db');
const redis = require('./config/redis');
const gateway = require('./realtime/gateway');
const mantenimiento = require('./services/mantenimiento.service');

async function arrancar() {
  // Si PostgreSQL no responde el servicio no puede cumplir su funcion: mejor
  // fallar en el arranque que aceptar mensajes que se van a perder.
  await db.verificarConexion();
  log.info('PostgreSQL verificado');

  const app = crearApp();
  const servidor = http.createServer(app);

  await gateway.iniciar(servidor);
  mantenimiento.iniciar();

  await new Promise((resolver) => servidor.listen(config.puerto, resolver));
  log.info('chat-controller escuchando', {
    puerto: config.puerto,
    entorno: config.entorno,
    rutaWs: config.websocket.ruta
  });

  return servidor;
}

function registrarApagado(servidor) {
  let apagando = false;

  async function apagar(senal) {
    if (apagando) return;
    apagando = true;
    log.info('Apagado ordenado iniciado', { senal });

    // Red de seguridad: si algo se cuelga al cerrar, el proceso igual termina
    // y el orquestador puede levantar una instancia nueva.
    const guardia = setTimeout(() => {
      log.error('El apagado excedio el tiempo limite, se fuerza la salida');
      process.exit(1);
    }, config.apagado.timeoutMs);
    guardia.unref();

    try {
      // Orden: primero se cierran los clientes, despues las dependencias. Al
      // reves, las peticiones en vuelo fallarian contra un pool ya cerrado.
      mantenimiento.detener();
      await gateway.detener();
      await new Promise((resolver) => servidor.close(resolver));
      await db.cerrar();
      await redis.cerrar();
      clearTimeout(guardia);
      log.info('Apagado completo');
      process.exit(0);
    } catch (error) {
      log.error('Error durante el apagado', { error: error.message });
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));

  // Un rechazo sin capturar deja el proceso en estado indefinido. Se registra
  // y se apaga de forma ordenada en lugar de seguir sirviendo a medias.
  process.on('unhandledRejection', (razon) => {
    log.error('Promesa rechazada sin manejar', {
      error: razon instanceof Error ? razon.message : String(razon),
      stack: razon instanceof Error ? razon.stack : undefined
    });
  });

  process.on('uncaughtException', (error) => {
    log.error('Excepcion no capturada', { error: error.message, stack: error.stack });
    apagar('uncaughtException');
  });
}

arrancar()
  .then(registrarApagado)
  .catch((error) => {
    log.error('No se pudo arrancar chat-controller', { error: error.message, stack: error.stack });
    process.exit(1);
  });
