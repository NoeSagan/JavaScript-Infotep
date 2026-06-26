# NoeFinder

Esta es una aplicación web para comparar precios de videojuegos en distintas tiendas digitales.

## Descripción

NoeFinder permite buscar videojuegos y ver en cuales tiendas están disponibles, comparando precios de oferta, precios normales y descuentos activos, al seleccionar un juego se muestra información detallada: *puntuaciones de críticos, galería de capturas, tabla comparativa de precios por tienda y requisitos del sistema.*

## Características

- Listado de mejores ofertas del momento.
- Búsqueda de juegos con autocompletado.
- Filtro por tienda y ordenamiento (mejor valoradas, menor precio, mayor descuento, etc.)
- Modal de detalle con:
  - Puntuación Metacritic y OpenCritic.
  - Precio mínimo histórico.
  - Comparación de precios en todas las tiendas disponibles.
  - Galería de capturas con slideshow.
  - Requisitos mínimos y recomendados del sistema.
  - Géneros y fecha de lanzamiento.
- Diseño responsive.

## Tecnologías

- HTML, CSS y JavaScript.

## APIs y servicios utilizados

| Servicio | Uso |
|----------|-----|
| [CheapShark](https://apidocs.cheapshark.com/) | Ofertas, búsqueda y precios por tienda |
| [Steam Store API](https://store.steampowered.com/api/) | Imágenes, descripción y requisitos del sistema |
| [OpenCritic](https://rapidapi.com/opencritic-opencritic-default/api/opencritic-api) | Puntuación de críticos y capturas de pantalla |
| [AllOrigins](https://allorigins.win/) | Proxy CORS para acceder a la Steam Store API desde el navegador |

## Tiendas soportadas

Steam, Epic Games, GOG, Humble Bundle, Fanatical, GreenManGaming, GamersGate, Origin, Blizzard, GameBillet, WinGameStore, GamesPlanet, IndieGala, Razer Game Store.