import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

import main
from models.browserController import PlaywrightBrowserController
from utils.movieData import MovieData

SCRAPED = {"2026-8-4": [MovieData("Dune", datetime(2026, 8, 4), [{"type": "2D", "hours": ["20:00"]}], "1 hora", "Multiplex Belgrano")]}


@pytest.fixture
def cache(monkeypatch):
    client = MagicMock()
    client.set_with_ttl = AsyncMock(return_value=True)
    client.close = AsyncMock()
    monkeypatch.setattr(main, "CacheClient", lambda: client)
    return client


@pytest.fixture
def controller(monkeypatch):
    fake = MagicMock()
    fake.start = AsyncMock()
    fake.close = AsyncMock()
    fake.scrapper_page = AsyncMock(return_value=SCRAPED)
    monkeypatch.setattr(main, "PlaywrightBrowserController", MagicMock(return_value=fake, _serialize=PlaywrightBrowserController._serialize))
    return fake


async def test_main_guarda_la_cartelera_con_ttl(cache, controller):
    """PT-TR-21 run_initial_scrape → SetWithTTL('scraped_data', JSON serializado, CACHE_TTL) una vez, por el mock del cliente gRPC"""
    await main.run_initial_scrape()

    cache.connect.assert_called_once()
    cache.set_with_ttl.assert_awaited_once()
    key, payload, ttl = cache.set_with_ttl.await_args.args
    assert key == "scraped_data"
    assert ttl == main.CACHE_TTL == 3600
    assert json.loads(payload) == [{"2026-8-4": [{"title": "Dune", "date": "2026-08-04", "duration": "1 hora", "theater": "Multiplex Belgrano", "screenings": [{"type": "2D", "hours": ["20:00"]}]}]}]
    controller.close.assert_awaited_once()
    cache.close.assert_awaited_once()


async def test_main_cache_no_confirma(cache, controller, capsys):
    """PT-TR-22 SetWithTTL responde ok=false → informa el error y termina sin excepción"""
    cache.set_with_ttl.return_value = False
    await main.run_initial_scrape()
    assert "no confirmó el almacenamiento" in capsys.readouterr().out


async def test_main_scraping_falla(cache, controller, capsys):
    """PT-TR-23 La estrategia lanza una excepción → no se escribe en caché y se cierran navegador y cliente"""
    controller.scrapper_page.side_effect = RuntimeError("sitio caído")
    await main.run_initial_scrape()
    cache.set_with_ttl.assert_not_awaited()
    controller.close.assert_awaited_once()
    cache.close.assert_awaited_once()
    assert "Scraping inicial falló: sitio caído" in capsys.readouterr().out


async def test_main_navegador_no_inicia(cache, monkeypatch, capsys):
    """PT-TR-24 Chromium no arranca (start falla) → se informa el error, sin excepción secundaria, y se cierra el cliente gRPC"""
    monkeypatch.delattr(PlaywrightBrowserController, "_instance", raising=False)
    monkeypatch.setattr(PlaywrightBrowserController, "start", AsyncMock(side_effect=RuntimeError("chromium no instalado")))

    await main.run_initial_scrape()

    assert "Scraping inicial falló: chromium no instalado" in capsys.readouterr().out
    cache.set_with_ttl.assert_not_awaited()
    cache.close.assert_awaited_once()
