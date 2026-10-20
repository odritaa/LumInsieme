import * as carteleraService from "../services/cartelera.service.js";

export async function getDay(req, res) {
  const fecha = typeof req.query.fecha === "string" && req.query.fecha ? req.query.fecha : undefined;
  res.json(await carteleraService.getDay(fecha));
}

export async function listMovies(_req, res) {
  res.json({ movies: await carteleraService.listMovies() });
}
