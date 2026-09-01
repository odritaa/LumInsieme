-- ----------------------------------------------------------------------------
-- Invitaciones
--
-- Los grupos son abiertos: cualquiera con el id puede unirse por su cuenta. La
-- invitacion NO es un permiso de acceso, es el mecanismo para que un miembro
-- avise a otra persona sin sumarla al grupo por la fuerza. Nadie entra a un
-- chat sin haberlo aceptado.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_invitaciones (
    id            BIGSERIAL   PRIMARY KEY,
    chat_id       BIGINT      NOT NULL REFERENCES chat_grupos(id) ON DELETE CASCADE,
    invitado_id   BIGINT      NOT NULL,
    invitador_id  BIGINT      NOT NULL,
    estado        TEXT        NOT NULL DEFAULT 'pendiente',
    creada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en     TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
    respondida_en TIMESTAMPTZ,

    CONSTRAINT chat_invitaciones_estado_valido
        CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
    CONSTRAINT chat_invitaciones_no_autoinvitacion
        CHECK (invitado_id <> invitador_id),
    CONSTRAINT chat_invitaciones_respuesta_coherente
        CHECK ((estado = 'pendiente') = (respondida_en IS NULL))
);

-- Una sola invitacion pendiente por persona y grupo. Es la base de datos la que
-- corta el duplicado, no una comprobacion previa que dos peticiones simultaneas
-- pasarian a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS chat_invitaciones_pendiente_unica
    ON chat_invitaciones (chat_id, invitado_id)
    WHERE estado = 'pendiente';

-- "Mis invitaciones pendientes".
CREATE INDEX IF NOT EXISTS chat_invitaciones_invitado_idx
    ON chat_invitaciones (invitado_id)
    WHERE estado = 'pendiente';
