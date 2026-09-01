-- ============================================================================
-- LumInsieme :: chat-controller
-- Esquema de persistencia de chats grupales.
--
-- PostgreSQL es la fuente de verdad: los mensajes sobreviven al fin de todas
-- las sesiones. Redis solo actua como cache de lectura y bus de eventos.
-- ============================================================================

-- gen_random_uuid() es nativa desde PostgreSQL 13: no hace falta la extension
-- pgcrypto, que ademas exige permisos de superusuario en bases gestionadas.

-- ----------------------------------------------------------------------------
-- Grupos de chat
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_grupos (
    id            BIGSERIAL   PRIMARY KEY,
    uuid          UUID        NOT NULL DEFAULT gen_random_uuid(),
    nombre        TEXT        NOT NULL,
    evento_id     BIGINT,
    creador_id    BIGINT      NOT NULL,
    max_miembros  SMALLINT    NOT NULL,
    estado        TEXT        NOT NULL DEFAULT 'activo',
    ultimo_seq    BIGINT      NOT NULL DEFAULT 0,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    archivado_en  TIMESTAMPTZ,

    CONSTRAINT chat_grupos_uuid_unico    UNIQUE (uuid),
    CONSTRAINT chat_grupos_evento_unico  UNIQUE (evento_id),
    CONSTRAINT chat_grupos_nombre_valido CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 120),
    CONSTRAINT chat_grupos_max_valido    CHECK (max_miembros BETWEEN 2 AND 50),
    CONSTRAINT chat_grupos_estado_valido CHECK (estado IN ('activo', 'archivado')),
    CONSTRAINT chat_grupos_seq_positivo  CHECK (ultimo_seq >= 0)
);

-- ----------------------------------------------------------------------------
-- Membresias
--
-- left_at NULL = miembro activo. Se conserva la fila al salir para poder
-- mostrar el historial atribuido correctamente y permitir reingreso.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_miembros (
    chat_id             BIGINT      NOT NULL REFERENCES chat_grupos(id) ON DELETE CASCADE,
    usuario_id          BIGINT      NOT NULL,
    rol                 TEXT        NOT NULL DEFAULT 'miembro',
    unido_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
    salio_en            TIMESTAMPTZ,
    ultimo_leido_seq    BIGINT      NOT NULL DEFAULT 0,

    PRIMARY KEY (chat_id, usuario_id),
    CONSTRAINT chat_miembros_rol_valido CHECK (rol IN ('admin', 'miembro'))
);

-- Conteo de cupo y listado de miembros activos.
CREATE INDEX IF NOT EXISTS chat_miembros_activos_idx
    ON chat_miembros (chat_id)
    WHERE salio_en IS NULL;

-- "Mis chats" para un usuario.
CREATE INDEX IF NOT EXISTS chat_miembros_usuario_idx
    ON chat_miembros (usuario_id)
    WHERE salio_en IS NULL;

-- ----------------------------------------------------------------------------
-- Mensajes
--
-- seq: contador monotono y sin huecos POR CHAT, asignado bajo el lock de la
-- fila del grupo. No se usa el id global (BIGSERIAL) para ordenar porque las
-- secuencias se asignan al INSERT y no al COMMIT: dos transacciones
-- concurrentes pueden hacerse visibles en orden distinto al de su id y un
-- cursor de paginacion se saltaria mensajes de forma permanente.
--
-- autor_id NULL = mensaje generado por el sistema (altas, bajas, cierre).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_mensajes (
    id            BIGSERIAL   PRIMARY KEY,
    chat_id       BIGINT      NOT NULL REFERENCES chat_grupos(id) ON DELETE CASCADE,
    seq           BIGINT      NOT NULL,
    autor_id      BIGINT,
    tipo          TEXT        NOT NULL DEFAULT 'texto',
    contenido     TEXT        NOT NULL,
    client_msg_id UUID,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    eliminado_en  TIMESTAMPTZ,

    CONSTRAINT chat_mensajes_seq_unico       UNIQUE (chat_id, seq),
    CONSTRAINT chat_mensajes_tipo_valido     CHECK (tipo IN ('texto', 'sistema')),
    CONSTRAINT chat_mensajes_longitud_valida CHECK (char_length(contenido) BETWEEN 1 AND 2000),
    CONSTRAINT chat_mensajes_autor_coherente CHECK (
        (tipo = 'sistema' AND autor_id IS NULL) OR
        (tipo <> 'sistema' AND autor_id IS NOT NULL)
    )
);

-- Idempotencia: si el cliente reintenta el envio tras un corte de red, el
-- mismo client_msg_id no genera un mensaje duplicado.
-- Los mensajes de sistema llevan client_msg_id NULL y quedan fuera del indice.
CREATE UNIQUE INDEX IF NOT EXISTS chat_mensajes_idempotencia_idx
    ON chat_mensajes (chat_id, autor_id, client_msg_id)
    WHERE client_msg_id IS NOT NULL;

-- Paginacion por keyset: WHERE chat_id = $1 AND seq < $2 ORDER BY seq DESC.
CREATE INDEX IF NOT EXISTS chat_mensajes_historial_idx
    ON chat_mensajes (chat_id, seq DESC);
