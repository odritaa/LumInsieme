CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub      TEXT        NOT NULL UNIQUE,
    email           TEXT        NOT NULL UNIQUE,
    name            TEXT        NOT NULL,
    picture         TEXT,
    age             SMALLINT    CHECK (age IS NULL OR age BETWEEN 13 AND 120),
    city            TEXT,
    genres          TEXT[]      NOT NULL DEFAULT '{}',
    favorite_movies JSONB       NOT NULL DEFAULT '[]'::jsonb
                                CHECK (jsonb_typeof(favorite_movies) = 'array'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS users_genres_idx ON users USING GIN (genres);
