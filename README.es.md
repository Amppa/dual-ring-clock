# TimeMapper

[English](README.md) | [繁體中文](README.zh-TW.md) | **Español**

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-TimeMapper-4285F4?style=flat&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/hlhcfeakjfdmgdlcfbpbblmlmobmljkf?utm_source=item-share-cb)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?style=flat&logo=github-sponsors)](https://github.com/sponsors/Amppa)

Una extensión de Chrome para comparar la hora en varios husos horarios. Haz clic en las ciudades del mapa mundial y alinea sus días en una línea de tiempo de 24 horas para encontrar un momento que le sirva a todos.

---

## Instalación

### Chrome Web Store (Recomendado)

Instálala directamente desde [Chrome Web Store](https://chromewebstore.google.com/detail/hlhcfeakjfdmgdlcfbpbblmlmobmljkf?utm_source=item-share-cb).

### Manual (Modo desarrollador)

1. Descarga o clona este repositorio.
2. Abre Chrome y entra en `chrome://extensions/`.
3. Activa el **Modo desarrollador** en la esquina superior derecha.
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta raíz del repositorio.
5. Haz clic en el icono de TimeMapper en la barra de herramientas de Chrome.

---

## Cómo se usa

**Elige ciudades** — haz clic en cualquier marcador del mapa mundial para añadir esa ciudad a la línea de tiempo; vuelve a hacer clic para quitarla. Si haces clic en una zona vacía del mapa, se añade una fila con ese desfase UTC (por ejemplo, `UTC+8`). La primera vez que abras la ventana ya estarán seleccionadas Tokio, Nueva York, Los Ángeles y tu hora local. Se muestran hasta 10 ciudades a la vez.

**Lee la línea de tiempo** — cada fila es el día de 24 horas de una ciudad y la **línea actual** vertical marca este preciso momento. La celda de las `00` también muestra la fecha, para que veas dónde cambia el día.

**Compara un momento concreto** — haz clic en cualquier parte de la línea de tiempo para colocar una línea de alineación (hasta cuatro). Arrástrala para moverla o pulsa su `[x]` para quitarla. Cada fila muestra a qué hora es ese momento en esa ciudad. El espacio entre dos marcadores contiguos —incluida la línea actual— aparece rotulado con su duración (`1.5h`).

**Usa el mapa** — el mapa puede sombrear la zona nocturna actual, dibujar las líneas de cada hora y mostrar una burbuja con la hora sobre cada ciudad seleccionada. El panel del mapa se puede plegar si solo quieres la línea de tiempo.

---

## Ajustes

Haz clic en el botón ⚙ de la barra superior para abrir la página de ajustes. Los selectores de idioma y tema están en la cabecera, y junto a los ajustes queda fijada una vista previa del mapa y de la línea de tiempo.

| Sección | Qué puedes hacer |
| --- | --- |
| **Ciudades** | Revisa cada ciudad que tienes ahora en la línea de tiempo: renómbrala, cambia su huso horario, ajusta sus coordenadas en el mapa, arrastra el asa para reordenarla o quítala con `×`. Busca por nombre para añadir una ciudad que no está en el mapa, carga el conjunto de ejemplo o bórralo todo. Hasta 10 ciudades. |
| **Minimapa** | Activa o desactiva la zona nocturna, las líneas de hora y las burbujas de hora. |
| **Textura del mapa** | Ajusta los desplazamientos de longitud/latitud, la escala de ancho/alto y el desplazamiento vertical, y después restablece los valores predeterminados. |
| **Periodos** | Elige entre 2, 3 o 4 periodos resaltados y arrastra los tiradores sobre la cuadrícula de 24 horas para fijar sus tramos horarios, o restablece los valores predeterminados. También eliges la referencia de la línea actual (la hora local del navegador o la de la primera ciudad). |

Cada número de periodos trae su propia paleta para el tema claro y el oscuro, así que las bandas se siguen leyendo al cambiar de tema. Los ajustes principales (ciudades, ciudades personalizadas, periodos, idioma y referencia de la línea actual) se sincronizan entre tus dispositivos mediante `chrome.storage.sync`, mientras que el tema visual y la calibración del mapa se guardan en el `localStorage` local.

---

## Una ciudad que no está en el mapa

Búscala en la sección **Ciudades** de la página de ajustes. Los resultados vienen de la [API de geocodificación de Open-Meteo](https://geocoding-api.open-meteo.com/), así que buscar requiere conexión a internet. La ciudad que elijas se coloca en el mapa con sus propias coordenadas y se recuerda para la próxima vez.

Para añadir una ciudad permanentemente a la lista integrada, edita `cityCatalog` en `src/shared/cities.js`. Las constantes que convierten longitud/latitud en una posición del mapa están documentadas en el bloque `PROJECTION`, al principio de `src/shared/config.js`.

---

## Apoyo y patrocinio

Si TimeMapper te resulta útil, puedes apoyar su desarrollo:

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor_on_GitHub-%E2%9D%A4-ea4aaa?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/Amppa)

---

## Privacidad

TimeMapper no recopila ni transmite ningún dato personal. Consulta nuestra [Política de privacidad (PRIVACY.md)](PRIVACY.md).

---

## Comprobar las traducciones

`node tools/check-i18n.mjs` comprueba que los diccionarios de `src/shared/i18n.js` sigan cubriendo todas las cadenas que usan las páginas. Ejecútalo después de añadir una cadena, un idioma o una ciudad.
