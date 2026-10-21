import json
import os

import pytest

# utils/config.py lee estas variables al importarse; en Docker las define docker-compose.
os.environ.setdefault("SCRAPPING_DAYS", "5")
os.environ.setdefault("CACHE_TTL", "3600")
os.environ.setdefault("GRPC_HOST", "127.0.0.1")
os.environ.setdefault("GRPC_PORT", "50998")

_results = []


# El docstring de cada prueba lleva "PT-XX-NN descripción → esperado": se exporta para el informe del TP4.
@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" or (report.when == "setup" and report.failed):
        _results.append(
            {
                "title": (item.function.__doc__ or item.name).strip(),
                "status": report.outcome,
                "duration": round(report.duration, 3),
                "message": str(report.longrepr.reprcrash.message) if report.failed and hasattr(report.longrepr, "reprcrash") else "",
            }
        )


def pytest_sessionfinish(session):
    path = os.environ.get("LUM_RESULTS_JSON")
    if path:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(_results, f, ensure_ascii=False, indent=2)
