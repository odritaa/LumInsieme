import json
from datetime import datetime

from models.browserController import PlaywrightBrowserController
from utils.movieData import MovieData


def movie(title="Dune: Parte Tres", day=4):
    return MovieData(title, datetime(2026, 8, day), [{"type": "2D Subtitulada", "hours": ["18:30"]}], "1 hora", "Multiplex Belgrano")


def test_serializa_movie_data():
    """PT-TR-17 _serialize(MovieData) → dict con fecha AAAA-MM-DD y todos los campos que lee reunion-controller"""
    assert PlaywrightBrowserController._serialize(movie()) == {
        "title": "Dune: Parte Tres",
        "date": "2026-08-04",
        "duration": "1 hora",
        "theater": "Multiplex Belgrano",
        "screenings": [{"type": "2D Subtitulada", "hours": ["18:30"]}],
    }


def test_serializa_estructura_anidada_a_json():
    """PT-TR-18 [{día: [MovieData]}] (salida de gather) → JSON válido que conserva acentos y la estructura por día"""
    data = [{"2026-8-4": [movie(), movie("Ñandú Español")], "2026-8-5": []}]
    payload = json.dumps(PlaywrightBrowserController._serialize(data), ensure_ascii=False)

    parsed = json.loads(payload)
    assert list(parsed[0].keys()) == ["2026-8-4", "2026-8-5"]
    assert [m["title"] for m in parsed[0]["2026-8-4"]] == ["Dune: Parte Tres", "Ñandú Español"]
    assert "Ñandú Español" in payload


def test_valores_primitivos_sin_cambios():
    """PT-TR-19 _serialize de str/int/None → se devuelven sin cambios"""
    assert PlaywrightBrowserController._serialize("x") == "x"
    assert PlaywrightBrowserController._serialize(3) == 3
    assert PlaywrightBrowserController._serialize(None) is None


def test_repr_legible():
    """PT-TR-20 repr(MovieData) → incluye título, fecha, cine y funciones"""
    text = repr(movie())
    assert "TITULO:Dune: Parte Tres" in text
    assert "2026-08-04" in text
    assert "Multiplex Belgrano" in text
