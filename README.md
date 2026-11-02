<p align="center">
  <img src="assets/icon.svg" width="120" alt="Mérida">
</p>

# 🏛️ Mérida

Addon de [Stremio](https://www.stremio.com/) para ver **tu propia colección de series y pelis**, guardada en tu OneDrive, desde cualquier dispositivo de tu cuenta: la tele de tu madre, el móvil, el PC.

El nombre viene del [teatro romano de Mérida](https://es.wikipedia.org/wiki/Teatro_romano_de_M%C3%A9rida). Sigue la línea de [Segovia](https://github.com/JosueMeserom/segovia), que hace de acueducto y trae los archivos desde OneDrive; Mérida es donde la gente se sienta a ver la función.

---

## 🤔 El problema

Los vídeos en alta calidad ocupan mucho, y lo que tienes en la nube no se ve bien en la tele de nadie. Compartirlos con enlaces de OneDrive los deja abiertos a cualquiera que tenga el enlace, y a la familia hay que explicarle dónde está cada cosa.

Con Mérida los archivos **siguen siendo privados**, y en Stremio aparecen como una fuente más: buscas la serie, eliges el capítulo y sale tu copia, reconocible de un vistazo, con el progreso y el «siguiente capítulo» de siempre.

## 🧩 Cómo encaja

```
Stremio ──► Mérida (qué hay y dónde está)
   │             │ lista la carpeta por la API de Segovia
   ▼             ▼
   Segovia (sirve el vídeo, con saltos y sin cortes) ──► OneDrive
```

Mérida solo contesta JSON: **los vídeos no pasan por aquí**. Las fichas (sinopsis, carátulas, capítulos) las pone Cinemeta, el catálogo oficial de Stremio.

## 📂 Cómo se organiza la carpeta

El ID de IMDb sale del nombre de la carpeta: Mérida no adivina nada.

```
Series/<Título> (<año>) [ttXXXXXXX]/Temporada NN/<archivo con SxxEyy>.mkv
Pelis/<Título> (<año>) [ttXXXXXXX]/<archivo>.mkv
```

- **Serie o peli** se decide por el archivo: con `SxxEyy` (`S01E02`, `s1e2`, `S01E01E02`, `S01E01-E03`) es un capítulo; sin él, una peli. `Series/` y `Pelis/` son solo orden: vale cualquier nivel de carpetas.
- **Varias versiones** de lo mismo salen como varios streams, con la mejor calidad primero.
- **Se ignora** lo que no sea vídeo, las carpetas que empiezan por `.`, y los archivos sin `SxxEyy` en una carpeta de temporada o en la de una serie, que son extras.

## 🏷️ Qué se ve en cada stream

```
🏠 Mérida     1080p · HEVC · 5,2 GB
              🔊 Castellano, Inglés
```

La calidad y los idiomas se leen del campo **descripción** del archivo en OneDrive, en formato `clave=valor;`, que escribe quien sube el archivo:

```
ancho=1920;alto=1080;video=hevc;hdr=hdr10;audio=spa,eng
```

Sin esa descripción (lo subido a mano), la resolución sale de lo que mide Microsoft y del nombre del archivo, y los idiomas no aparecen. Es el único sitio donde están: Microsoft no da ni códec ni idiomas.

Cada stream lleva `notWebReady: true` (no es MP4), un `bingeGroup` por calidad para que el siguiente capítulo entre solo, y `filename` y `videoSize` para que acierten los addons de subtítulos.

## 🚀 Instalación con pm2

Hace falta una instancia de [Segovia](https://github.com/JosueMeserom/segovia#-acceso-por-id-para-otros-programas) con el acceso por ID configurado. Sin dependencias: no hay `npm install`.

```bash
git clone https://github.com/JosueMeserom/merida.git && cd merida
cp .env.example .env
```

En el `.env`:

- `MERIDA_TOKEN`: el secreto de la URL. Genéralo como dice el propio archivo.
- `SEGOVIA_URL` y `SEGOVIA_CLAVE`: la clave de solo lectura, con `npm run segovia clave addon` en la carpeta de Segovia.
- `MERIDA_NOMBRE` y `MERIDA_ETIQUETA`: cómo se llama en Stremio y qué sale en cada stream.

```bash
pm2 start ecosystem.config.cjs && pm2 save
```

Y en el reverse proxy, con HTTPS, que Stremio lo exige:

```
merida.tu-dominio {
	reverse_proxy 172.17.0.1:4060
}
```

## 📺 Instalarlo en Stremio

Los addons van con la cuenta, así que se hace una vez y aparece en todos los dispositivos:

1. Entra con tu cuenta en [web.stremio.com](https://web.stremio.com) desde el PC.
2. **Addons** → pega la URL en el buscador de arriba:
   ```
   https://merida.tu-dominio/<MERIDA_TOKEN>/manifest.json
   ```
3. **Install**. Si tienes los dispositivos abiertos, reinicia la app para que lo vean.

## 🔄 Cuándo aparece algo nuevo

La carpeta se relee cada `MERIDA_REFRESCO_MIN` minutos, por si subes algo a mano. Para que salga al momento, quien sube llama al terminar:

```bash
curl -X POST https://merida.tu-dominio/refrescar -H "Authorization: Bearer <clave de Segovia>"
```

Pide una clave válida de Segovia, para no tener otro secreto más que guardar.

## 🔧 Variables de entorno

| Variable | Por defecto | Qué hace |
|---|---|---|
| `HOST` | `127.0.0.1` | Dónde escucha. `172.17.0.1` si el proxy está en Docker |
| `PORT` | `4060` | Puerto |
| `MERIDA_TOKEN` | — | El secreto de la URL del addon. Obligatorio |
| `SEGOVIA_URL` | — | Dónde está Segovia. Obligatorio |
| `SEGOVIA_CLAVE` | — | Clave de solo lectura de Segovia. Obligatorio |
| `SEGOVIA_RUTA` | la raíz | Subcarpeta dentro de la raíz de Segovia |
| `MERIDA_NOMBRE` | `Mérida` | Nombre del addon y de sus catálogos |
| `MERIDA_ETIQUETA` | `🏠 Mérida` | Lo que sale a la izquierda de cada stream |
| `MERIDA_MODO` | `proxy` | `proxy` o `redirect`: ver Segovia. En redirect el reproductor va directo a Microsoft y tu conexión no se gasta, pero depende de su ruta hasta ahí |
| `MERIDA_REFRESCO_MIN` | `30` | Cada cuántos minutos se relee la carpeta |

## 🔒 Seguridad

- **La URL del addon lleva un token.** Sin él, todo da `404`. Quien lo tenga ve qué hay y puede reproducirlo, así que trátalo como una contraseña. Stremio lo guarda en tu cuenta.
- **Revocarlo:** cambia `MERIDA_TOKEN`, reinicia y vuelve a instalar el addon.
- **Las URL de vídeo van firmadas por Segovia**, una firma por archivo: una filtrada abre ese archivo y nada más. Para invalidarlas todas, `npm run segovia rotar-firma` en Segovia y refresca Mérida.
- **Aquí no hay tokens de Microsoft.** Mérida solo tiene una clave de lectura de Segovia, que no sirve para subir ni para tocar nada.
- El token no se escribe en el registro.

## ⚠️ Limitaciones

Sin vender humo:

- **El historial es de la cuenta.** Quien comparte cuenta comparte el «seguir viendo». Historiales separados, de momento, no.
- **Lo que no pueda decodificar el dispositivo no se ve.** Mérida entrega el archivo tal cual, sin recomprimir. Depende del reproductor de cada app, y sobre todo del audio: DTS o TrueHD pueden salir sin sonido en una tele sin receptor.
- **Las carátulas vienen de un servicio de la comunidad de Stremio** (`images.metahub.space`). Si no tiene una, sale en blanco.
- **La colección se lee entera en cada refresco**, carpeta a carpeta. Para cientos de carpetas va bien; para muchos miles habría que hacerlo por cambios.
- **Una sola fuente.** La de OneDrive, en `src/segovia.js`. El día que haya una carpeta local basta otro módulo con la misma `listar()`: el progreso de Stremio va por ID de IMDb, así que nadie pierde por dónde iba.

## 🧪 Desarrollo

```bash
npm test     # node:test, sin dependencias
npm start    # servidor local con el .env si existe
```

Los tests cubren el nombre de las carpetas, los `SxxEyy`, la calidad, la clasificación, las respuestas de stream, las rutas con y sin token y el refresco.

## 📄 Licencia

MIT. Mérida solo sirve lo que ya tienes: eres responsable de lo que guardes y compartas. Sin relación con Stremio ni con Microsoft.
