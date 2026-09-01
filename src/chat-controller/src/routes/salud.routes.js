'use strict';

const express = require('express');

const config = require('../config');
const { verificarConexion } = require('../config/db');
const redis = require('../config/redis');
const gateway = require('../realtime/gateway');

const router = express.Router();

// Liveness: responde mientras el proceso este vivo. No toca dependencias, para
// que una caida de PostgreSQL no provoque que el orquestador reinicie el pod.
router.get('/salud', (req, res) => {
  res.json({
    estado: 'ok',
    servicio: 'chat-controller',
    instancia: config.instanciaId,
    uptimeSeg: Math.round(process.uptime())
  });
});

// Readiness: aqui si se comprueban las dependencias. Si PostgreSQL no responde
// la instancia no puede servir y debe salir del balanceador.
router.get('/salud/listo', async (req, res) => {
  const salud = { postgres: false, redis: redis.estaDisponible(), conexiones: gateway.metricas() };

  try {
    await verificarConexion();
    salud.postgres = true;
  } catch (error) {
    salud.errorPostgres = error.message;
  }

  // Redis caido degrada pero no invalida: el chat sigue funcionando contra
  // PostgreSQL, solo pierde cache y alcance entre instancias.
  res.status(salud.postgres ? 200 : 503).json({
    estado: salud.postgres ? 'listo' : 'no-listo',
    ...salud
  });
});

module.exports = router;
