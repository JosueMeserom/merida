/** Arranque: une la configuración, la fuente y el servidor. */
import { createServer } from 'node:http';
import { crearAddon } from './servidor.js';
import { fuenteSegovia } from './segovia.js';

const e = process.env;
for (const k of ['MERIDA_TOKEN', 'SEGOVIA_URL', 'SEGOVIA_CLAVE']) if (!e[k]) throw new Error(`Falta ${k} en el .env.`);
const MINUTOS = Number(e.MERIDA_REFRESCO_MIN ?? 30);

const addon = crearAddon({
  token: e.MERIDA_TOKEN,
  fuente: fuenteSegovia({ url: e.SEGOVIA_URL, clave: e.SEGOVIA_CLAVE, ruta: e.SEGOVIA_RUTA }),
  nombre: e.MERIDA_NOMBRE,
  etiqueta: e.MERIDA_ETIQUETA,
  modo: e.MERIDA_MODO,
});

const leer = () =>
  addon.refrescar().then(
    () => setTimeout(leer, MINUTOS * 60e3).unref(),
    (err) => {
      console.error(err.message);
      // Sin colección todavía se reintenta enseguida; con ella, a su hora.
      setTimeout(leer, (addon.listo ? MINUTOS : 1) * 60e3).unref();
    },
  );
leer();

const host = e.HOST ?? '127.0.0.1';
const port = Number(e.PORT ?? 4060);
createServer(addon.escuchar).listen(port, host, () => console.log(`Mérida en http://${host}:${port}`));
