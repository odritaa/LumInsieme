import Sala from "../models/Sala.js";
import * as salaRepository from "../repositories/salaRepository.js";
import { today } from "../services/cartelera.service.js";
import httpError from "../utils/httpError.js";
import { signChatTicket } from "../utils/jwt.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un id mal formado se responde como inexistente: Postgres lo rechazaria con un 500.
function salaId(req) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) throw httpError(404, "sala_not_found");
  return id;
}

export async function list(_req, res) {
  const salas = await salaRepository.listUpcoming(today());
  res.json({ salas });
}

export async function getOne(req, res) {
  const sala = await salaRepository.findById(salaId(req));
  if (!sala) throw httpError(404, "sala_not_found");
  res.json({ sala });
}

export async function create(req, res) {
  const { errors, sala } = Sala.sanitizeNew(req.body, today());
  if (errors.length > 0) throw httpError(400, "invalid_sala", errors);
  const created = await salaRepository.create(req.auth.sub, sala);
  res.status(201).json({ sala: created });
}

export async function join(req, res) {
  const sala = await salaRepository.join(salaId(req), req.auth.sub, today());
  res.json({ sala });
}

export async function leave(req, res) {
  const sala = await salaRepository.leave(salaId(req), req.auth.sub);
  res.json({ sala });
}

export async function chatTicket(req, res) {
  const sala = await salaRepository.findById(salaId(req));
  if (!sala) throw httpError(404, "sala_not_found");
  const member = sala.members.find((m) => m.id === req.auth.sub);
  if (!member) throw httpError(403, "not_a_member");
  const ticket = signChatTicket({ userId: member.id, name: member.name, salaId: sala.id });
  res.json({ ticket });
}
