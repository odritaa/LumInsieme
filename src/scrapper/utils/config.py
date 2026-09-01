from dotenv import load_dotenv
import os 

load_dotenv()

SCRAPER_CONFIG = {
    "default_days": int(os.getenv("SCRAPPING_DAYS")),
    "cache_ttl": int(os.getenv("CACHE_TTL")),
}

# Configuración del cliente gRPC hacia el cache-controller
GRPC_CONFIG = {
    "host": os.getenv("GRPC_HOST"),
    "port": int(os.getenv("GRPC_PORT")),
}



