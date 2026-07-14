# Minuta de costos: Despliegue del Scrapper en AWS

- **Fecha:** 11/07/2026
- **Proyecto:** LumInsieme
- **Módulo:** Scrapper (src/scrapper/)
- **Objetivo:** Desglosar los costos de las alternativas de despliegue del scrapper en AWS y analizar los términos del plan gratuito.

---

## 1. Alternativas de despliegue y sus componentes

### Opción A: Lambda directa con Playwright ❌ (descartada)

| Componente | Modelo de costo |
|---|---|
| Lambda (x86) | $0.0000166667/GB-seg |
| Invocaciones | $0.20/1M requests (tras 1M gratis/mes) |
| ECR (imagen container) | $0.10/GB/mes |

**Cálculo:** Chromium ~2GB × ~180s/ejec = 360 GB-seg/ejec. Free tier: 400,000 GB-seg/mes → ~1.111 ejecuciones/mes gratis. Después del free tier: ~$0.006/ejecución.

### Opción B: EC2 + Lambda + API Gateway

| Componente | Costo/hora |
|---|---|
| EC2 t2.micro (1 vCPU, 1GB RAM) | $0.0116 |
| Elastic IP | $0.005 |
| API Gateway HTTP | $1.00/1M requests (~$0.000014/hora para ~10 req/h) |
| Lambda proxy (128MB, ~100ms) | ~$0.0000002/hora para ~10 req/h |
| EBS gp3 (8GB) | ~$0.0009/hora |
| **Total** | **~$0.0175/hora (~$12.80/mes)** |

Con free tier (12 meses): ~$0.0059/hora (~$4.30/mes) — solo Elastic IP + EBS. La EC2 y las primeras 1M invocaciones de Lambda están cubiertas.

### Opción C: EC2 directo (FastAPI + Redis) ✅ Recomendada

| Componente | Costo/hora |
|---|---|
| EC2 t2.micro (1 vCPU, 1GB RAM) | $0.0116 |
| Elastic IP | $0.005 |
| EBS gp3 (8GB) | ~$0.0009/hora |
| Redis | $0 (en misma instancia, solo RAM) |
| Data transfer out | $0 (primeros 100GB/mes gratis, luego $0.09/GB) |
| **Total** | **~$0.0175/hora (~$12.80/mes)** |

Con free tier (12 meses): ~$0.0059/hora (~$4.30/mes) — solo Elastic IP + EBS.

**Upgrade a t3.micro** (2GB RAM, si Chromium + Redis quedan justos en 1GB):

| Componente | Costo/hora |
|---|---|
| EC2 t3.micro | $0.0137 |
| Elastic IP + EBS | ~$0.0059/hora |
| **Total** | **~$0.0196/hora (~$14.30/mes)** |

---

## 2. Términos del plan gratuito (AWS Free Tier)

### Límites aplicables a EC2

| Recurso | Límite gratis | Detalle |
|---|---|---|
| Horas de instancia | **750 h/mes** | t2.micro (cuentas pre-Jul 2025) o t3.micro (cuentas nuevas) |
| Almacenamiento EBS | **30 GB/mes** | gp2/gp3. El volumen root (~8GB) está cubierto |
| Data transfer out | **100 GB/mes** | Tráfico saliente a internet, acumulado entre todos los servicios |
| Snapshots | **1 GB/mes** | Backups de EBS |

### Reglas importantes

1. **Duración:** 12 meses desde la creación de la cuenta (si es pre-Julio 2025). Para cuentas posteriores, cambió a 6 meses con $100 en créditos promocionales.

2. **Límite de 750 h/mes:** 24h × 31d = 744h → una EC2 encendida 24/7 está justo dentro del límite. Si tenés cualquier otra instancia en la cuenta, las horas se acumulan y excedés el free tier.

3. **Elastic IP ya no es gratis:** Desde febrero 2024, AWS cobra $0.005/hora (~$3.65/mes) por cada dirección IPv4 pública, incluso si está asociada a una instancia en ejecución. Es el único costo fijo que se paga teniendo free tier.

4. **Data transfer:** Primeros 100GB/mes gratis a nivel de cuenta. Para un PoC con consultas esporádicas desde el frontend, no debería alcanzarse este límite. Superado ese umbral, se paga $0.09/GB.

5. **Penalización por exceder límites:** Si se superan las 750h/mes, las horas adicionales se facturan a tarifa on-demand (~$0.0116/h para t2.micro).

---

## 3. Comparativa de costos por hora

| Alternativa | Sin free tier | Con free tier (12 meses) |
|---|---|---|
| **A - Lambda** | $0 (pay-per-use: ~$0.006/ejec) | $0 hasta ~1.111 ejec/mes |
| **B - EC2 + Lambda + API GW** | ~$0.0175/h | ~$0.0059/h |
| **C - EC2 directo** | ~$0.0175/h | ~$0.0059/h |
| **C+ - t3.micro** | ~$0.0196/h | ~$0.0196/h (no aplica free tier) |

---

## 4. Dirección IP y acceso desde el frontend

### Problema

La IP pública de una EC2 **cambia cada vez que se detiene y vuelve a iniciar** la instancia (stop/start). Si solo se hace reboot, la IP se mantiene.

### Alternativas para tener dirección fija

| Alternativa | Costo | Descripción |
|---|---|---|
| **Elastic IP** | ~$3.65/mes | IP fija asociada a la cuenta. Se mantiene aunque se detenga la instancia. Mientras la EC2 esté encendida y asociada, no hay cargos extra por "idle". |
| **DNS dinámico (DuckDNS, No-IP)** | $0 | Un script con cron actualiza un dominio (ej: `tudominio.duckdns.org`) cada vez que la IP cambia. |
| **No detener la instancia nunca** | $0 | La IP automática se mantiene si solo se hacen reboots. Pero si AWS reclama la instancia o hay un outage, la IP se pierde. |
| **CloudFront + ALB** | ~$10/mes | Arquitectura completa con IP fija vía CloudFront y HTTPS gratis. Sobredimensionado para PoC. |

**Recomendación para PoC:** Usar **Elastic IP** por simplicidad (~$3.65/mes). El frontend React se configura con esa IP y no hay que preocuparse por cambios.

---

## 5. Costo total proyectado para el PoC (primeros 12 meses)

| Concepto | Costo/mes |
|---|---|
| EC2 t2.micro (720h, 24/7) | $0 (dentro de 750h/mes free tier) |
| EBS root (~8GB gp3) | $0 (dentro de 30GB free tier) |
| Elastic IP | ~$3.65 |
| Data transfer (< 100GB/mes) | $0 |
| **Total** | **~$3.65/mes** |

### Después de los 12 meses de free tier

| Concepto | Costo/mes |
|---|---|
| EC2 t2.micro | ~$8.47 |
| Elastic IP | ~$3.65 |
| EBS (8GB gp3) | ~$0.64 |
| Data transfer | ~$0 (PoC) |
| **Total** | **~$12.80/mes** |

---

## 6. Conclusión

La **Opción C (EC2 directo con FastAPI + Redis)** es la más económica para el PoC: ~$3.65/mes durante los primeros 12 meses (solo Elastic IP) y ~$12.80/mes después. La Elastic IP es el único gasto fijo inevitable y resuelve el problema de IP variable para el frontend React.

# Continuar sesion opencode

```bash
opencode -s ses_0a7ecbfa3ffeOp3qOZ2mXuDTUw
```
