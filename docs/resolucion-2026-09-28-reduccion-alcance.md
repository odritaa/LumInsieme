# Resolución de alcance del proyecto
Fecha: 28 de septiembre del 2026
Integrantes:
- Audrey Barrientos
- Diego Escorche
- Tomás Varas

## Complicaciones
> Debido a nuestro compromiso con el desarrollo de este proceso y en vista de reconocer nuestras propias limitaciones a la hora de dimensionar la sofisticación de su implementación, no hemos visto sobrepasados para cumplir con todas las exigencias que nos proponiamos.

## Decisiones Especificas
> Para cumplir con el alcance del proyecto determinados, con el consentimiento de todo el grupo, las siguientes cuestiones para el proyecto:
- No implementaremos un sistema de recomendacion de contenido para nuestros usuarios (ver Sistema de recomendación)
- No utilizaremos Grafana para la observabilidad de este proyecto

## Sistema de recomendación
> Para suplir al sistema de recomendación de nuestro proyecto, decidimos utilizar el modulo `reunion-controller` para que se encargue de darle el contenido al usuario unicamente en base al horario de publicación (Más reciente a más lejano). Con esta desicion buscamos no algar la implementación del proyecto y propornerlo para más adelante. Por ende se puede decir que:
- El contenido se le presentará de forma igual a todos los usuarios
- No habra recomendaciones segun sus gustos elegidos sino que el usuario debera distingir mediante su criterio

