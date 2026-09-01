'use strict';

const { autenticarPeticion } = require('../auth/jwt');

function requiereAuth(req, res, siguiente) {
  try {
    req.usuario = autenticarPeticion(req);
    siguiente();
  } catch (error) {
    siguiente(error);
  }
}

module.exports = { requiereAuth };
