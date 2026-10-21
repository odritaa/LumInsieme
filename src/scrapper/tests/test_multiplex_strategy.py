from datetime import datetime
from pathlib import Path

import pytest
from playwright.async_api import TimeoutError as PlaywrightTimeoutError, async_playwright

from strategies.multiplexScrapping import MultiplexStrategy
from models.browserController import PlaywrightBrowserController

FIXTURE = (Path(__file__).parent / "fixtures" / "multiplex_sample.html").read_text(encoding="utf-8")


@pytest.fixture
async def page():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        yield await context.new_page()
        await browser.close()


async def serve(page, html):
    # Nada sale a internet: la URL real de Multiplex se responde con el fixture.
    await page.route(MultiplexStrategy.URL, lambda route: route.fulfill(status=200, content_type="text/html", body=html))


async def test_parseo_completo_del_fixture(page):
    """PT-TR-10 doScrapping sobre el HTML de muestra → un dict por día con las películas visibles"""
    await serve(page, FIXTURE)
    data = await MultiplexStrategy().doScrapping(page)

    assert list(data.keys()) == ["2026-8-4", "2026-8-5", "2026-10-21", "2026-10-22", "2026-10-23"]
    titles = [movie.title for movie in data["2026-8-4"]]
    assert titles == ["Dune: Parte Tres", "El Secreto de sus Ojos"]
    assert [movie.title for movie in data["2026-8-5"]] == ["Relatos Salvajes"]
    assert data["2026-10-21"] == []


async def test_horarios_desactivados_y_ocultos_se_excluyen(page):
    """PT-TR-11 extractScreenings → excluye horarios .horario-desactivado, ocultos y formatos no visibles"""
    await serve(page, FIXTURE)
    dune = (await MultiplexStrategy().doScrapping(page))["2026-8-4"][0]

    assert dune.screenings == [
        {"type": "2D Subtitulada", "hours": ["18:30", "21:00"]},
        {"type": "3D Español", "hours": ["16:00"]},
    ]


async def test_fecha_y_metadatos_de_cada_pelicula(page):
    """PT-TR-12 valor de día 'M.D.AAAA' → clave 'AAAA-M-D' y MovieData con fecha, cine y duración"""
    await serve(page, FIXTURE)
    movie = (await MultiplexStrategy().doScrapping(page))["2026-8-4"][1]

    assert movie.date == datetime(2026, 8, 4)
    assert movie.theater == "Multiplex Belgrano"
    assert movie.duration == "1 hora"


async def test_limita_a_cinco_dias(page):
    """PT-TR-13 página con 6 días disponibles → se scrapean solo los primeros 5"""
    await serve(page, FIXTURE)
    data = await MultiplexStrategy().doScrapping(page)
    assert "2026-10-24" not in data
    assert len(data) == 5


async def test_estructura_cambiada_sin_popup(page):
    """PT-TR-14 HTML sin el popup esperado (cambio de estructura del sitio) → TimeoutError en vez de datos vacíos"""
    await serve(page, FIXTURE.replace("dialog-close-button dialog-lightbox-close-button", "otro-boton"))
    with pytest.raises(PlaywrightTimeoutError):
        await MultiplexStrategy().doScrapping(page)


async def test_menos_de_dos_complejos(page):
    """PT-TR-15 HTML con un solo complejo de cines → TimeoutError"""
    html = FIXTURE.replace('<label class="btn-complejo">Multiplex Pilar</label>', "").replace(
        '<label class="btn-complejo">Multiplex Canning</label>', ""
    )
    await serve(page, html)
    with pytest.raises(PlaywrightTimeoutError, match="at least 2"):
        await MultiplexStrategy().doScrapping(page)


async def test_browser_controller_ejecuta_una_estrategia():
    """PT-TR-16 PlaywrightBrowserController.start + scrapper_page + close con Chromium real → resultado de la estrategia"""

    class EstrategiaFalsa:
        async def doScrapping(self, page):
            await page.set_content("<h1>ok</h1>")
            return {"titulo": await page.inner_text("h1")}

    controller = PlaywrightBrowserController()
    await controller.start()
    try:
        assert await controller.scrapper_page(EstrategiaFalsa()) == {"titulo": "ok"}
    finally:
        await controller.close()
