CREATE TABLE IF NOT EXISTS salas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie       TEXT        NOT NULL CHECK (char_length(movie) BETWEEN 1 AND 120),
    place       TEXT        NOT NULL CHECK (char_length(place) BETWEEN 1 AND 120),
    date        DATE        NOT NULL,
    time        TIME        NOT NULL,
    capacity    SMALLINT    NOT NULL CHECK (capacity BETWEEN 2 AND 6),
    note        TEXT        NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS salas_created_at_idx ON salas (created_at DESC);

CREATE TABLE IF NOT EXISTS sala_miembros (
    sala_id    UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sala_id, user_id)
);

CREATE INDEX IF NOT EXISTS sala_miembros_user_idx ON sala_miembros (user_id);
