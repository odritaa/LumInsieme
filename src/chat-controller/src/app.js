'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { noEncontrado, manejadorErrores } = require('./middlewares/errores');
const chatsRoutes = require('./routes/chats.routes');
const invitacionesRoutes = require('./routes/invitaciones.routes');
const saludRoutes = require('./routes/salud.routes');

function crearApp() {
  const app = express();

  // Detras de Nginx o de un balanceador, sin esto req.ip devuelve la IP del
  // proxy y los logs pierden el origen real.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cors({
    origin: config.cors.origenes,
    // Imprescindible: la sesion viaja en cookie y sin esto el navegador no la
    // envia en peticiones entre origenes.
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
  }));

  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  app.use('/', saludRoutes);
  app.use('/api/chats', chatsRoutes);
  app.use('/api/invitaciones', invitacionesRoutes);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}

module.exports = { crearApp };
