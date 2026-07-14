from dotenv import load_dotenv
import os 

load_dotenv()

SCRAPER_CONFIG = {
    "default_days": int(os.getenv("SCRAPPING_DAYS")),
    "cache_ttl": int(os.getenv("CACHE_TTL")),
}

# Configuración del servidor
SERVER_CONFIG = {
    "host": os.getenv("HOST"),
    "port": int(os.getenv("PORT")),
}

# Configuración de Redis
REDIS_CONFIG = {
    "host": os.getenv("REDIS_HOST"),
    "port": int(os.getenv("REDIS_PORT")),
    "decode_responses": True,
}



