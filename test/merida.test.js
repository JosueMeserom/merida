import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosCarpeta, capitulos, leerDescripcion, calidad, clasificar, aStream, indexar } from '../src/nucleo.js';
import { crearAddon } from '../src/servidor.js';

test('carpeta: título, año e ID; sin ID no hay nada', () => {
  assert.deepEqual(datosCarpeta('The Punisher (2017) [tt5675620]'), { id: 'tt5675620', nombre: 'The Punisher', anio: '2017' });
  assert.deepEqual(datosCarpeta("Schindler's List & ñ [tt0108052]"), { id: 'tt0108052', nombre: "Schindler's List & ñ" });
  assert.equal(datosCarpeta('The Punisher (2017)'), null);
  assert.equal(datosCarpeta('Temporada 01'), null);
  assert.equal(datosCarpeta('Rara [tt12]'), null);
});

test('capítulos: las formas de SxxEyy, y lo que no lo es', () => {
  assert.deepEqual(capitulos('The.Punisher.S01E02.1080p.mkv'), { temporada: 1, episodios: [2] });
  assert.deepEqual(capitulos('the punisher s1e2.mkv'), { temporada: 1, episodios: [2] });
  assert.deepEqual(capitulos('Serie - S12E103 [+audio].mkv'), { temporada: 12, episodios: [103] });
  assert.deepEqual(capitulos('S01E01E02.mkv'), { temporada: 1, episodios: [1, 2] });
  assert.deepEqual(capitulos('Serie.S01E01-E03.mkv'), { temporada: 1, episodios: [1, 2, 3] });
  assert.deepEqual(capitulos('S00E05.mkv'), { temporada: 0, episodios: [5] });
  assert.equal(capitulos('Inception.2010.1080p.mkv'), null);
  assert.equal(capitulos('US01E02x.mkv'), null);
  assert.equal(capitulos('Alien3.mkv'), null);
  assert.deepEqual(capitulos('S01E01-E99.mkv').episodios, [1], 'un disparate se queda en el primero');
});

test('descripción y calidad: lo panorámico cuenta como su resolución, y el nombre de respaldo', () => {
  assert.deepEqual(leerDescripcion('alto=2160;video=hevc;audio=spa,eng'), { alto: '2160', video: 'hevc', audio: 'spa,eng' });
  assert.deepEqual(leerDescripcion(null), {});
  assert.deepEqual(leerDescripcion('texto libre'), {});
  assert.equal(calidad('x.mkv', 1920, 800), '1080p');
  assert.equal(calidad('x.mkv', 3840, 1600), '2160p');
  assert.equal(calidad('x.mkv', 1280, 536), '720p');
  assert.equal(calidad('x.mkv', 720, 576), 'SD');
  assert.equal(calidad('Peli.2160p.mkv'), '2160p');
  assert.equal(calidad('Peli.1080p.mkv', undefined, 0), '1080p');
  assert.equal(calidad('Peli.mkv'), null);
});

test('clasificar: serie o peli por la estructura, y lo que se queda fuera', () => {
  const c = (ruta) => clasificar({ ruta, nombre: ruta.split('/').pop() });
  assert.equal(c('Series/T (2017) [tt5675620]/Temporada 01/T.S01E02.mkv').type, 'series');
  assert.equal(c('T (2017) [tt5675620]/T.S01E02.mkv').temporada, 1, 'sin carpeta de temporada también');
  assert.equal(c('Pelis/P (2010) [tt1375666]/P.mkv').type, 'movie');
  assert.equal(c('Pelis/P (2010) [tt1375666]/P.srt'), null, 'solo vídeos');
  assert.equal(c('Pelis/sin id/P.mkv'), null);
  assert.equal(c('Series/T [tt5675620]/Temporada 01/making-of.mkv'), null, 'extra en una temporada');
  assert.equal(c('.pruebas/T [tt5675620]/T.S01E01.mkv'), null, 'carpetas ocultas fuera');
});

test('stream: nombre, calidad y audio, URL estable, y las pistas para Stremio', () => {
  const a = { nombre: 'T.S01E02.mkv', ruta: 'x', url: 'https://s.example/id/1/f/T.mkv', tamano: 5.2e9, descripcion: 'ancho=3840;alto=2160;video=hevc;hdr=hdr10;audio=spa,eng,und' };
  const s = aStream(a, { etiqueta: '🏠 Toto' });
  assert.equal(s.name, '🏠 Toto');
  assert.equal(s.description, '2160p · HEVC · HDR10 · 5,2 GB\n🔊 Español, Inglés');
  assert.equal(s.title, s.description);
  assert.equal(s.url, a.url);
  assert.deepEqual(s.behaviorHints, { notWebReady: true, bingeGroup: 'merida-2160p', filename: 'T.S01E02.mkv', videoSize: 5.2e9 });
  assert.equal(aStream(a, { modo: 'redirect' }).url, a.url + '?m=redirect');
  // Sin descripción: lo que midió Microsoft y el nombre; sin idiomas, sin línea de audio.
  const b = aStream({ nombre: 'P.x265.mkv', ruta: 'x', url: 'u', video: { width: 1920, height: 1080 } });
  assert.equal(b.description, '1080p · HEVC');
  assert.equal(aStream({ nombre: 'P.mkv', ruta: 'x', url: 'u' }).behaviorHints.bingeGroup, 'merida-sin-calidad');
});

const ARCHIVOS = [
  { nombre: 'T.S01E01.1080p.mkv', ruta: 'Series/T (2017) [tt1111111]/Temporada 01/T.S01E01.1080p.mkv', url: 'u1', tamano: 2e9, modificado: '2026-01-01' },
  { nombre: 'T.S01E01.2160p.mkv', ruta: 'Series/T (2017) [tt1111111]/Temporada 01/T.S01E01.2160p.mkv', url: 'u2', tamano: 9e9, modificado: '2026-01-02' },
  { nombre: 'T.S01E02E03.1080p.mkv', ruta: 'Series/T (2017) [tt1111111]/Temporada 01/T.S01E02E03.1080p.mkv', url: 'u3', modificado: '2026-01-03' },
  { nombre: 'making-of.mkv', ruta: 'Series/T (2017) [tt1111111]/making-of.mkv', url: 'u4', modificado: '2026-01-04' },
  { nombre: 'P.mkv', ruta: 'Pelis/P (2010) [tt2222222]/P.mkv', url: 'u5', modificado: '2026-03-01' },
  { nombre: 'Q.mkv', ruta: 'Pelis/Q [tt3333333]/Q.mkv', url: 'u6', modificado: '2026-05-01' },
  { nombre: 'nota.txt', ruta: 'Pelis/Q [tt3333333]/nota.txt', url: 'u7' },
];

test('índice: catálogos con lo último primero, mejor calidad primero, capítulo doble en los dos', () => {
  const { catalogos, streams } = indexar(ARCHIVOS);
  assert.deepEqual(catalogos.movie.map((m) => m.id), ['tt3333333', 'tt2222222']);
  assert.deepEqual(catalogos.series.map((m) => m.id), ['tt1111111'], 'el extra de la serie no crea una peli');
  assert.equal(catalogos.series[0].name, 'T');
  assert.equal(catalogos.series[0].releaseInfo, '2017');
  assert.match(catalogos.series[0].poster, /tt1111111/);
  assert.ok(!('reciente' in catalogos.series[0]));
  assert.deepEqual(streams.get('tt1111111:1:1').map((s) => s.url), ['u2', 'u1']);
  assert.deepEqual(streams.get('tt1111111:1:2').map((s) => s.url), ['u3']);
  assert.deepEqual(streams.get('tt1111111:1:3').map((s) => s.url), ['u3']);
  assert.deepEqual(streams.get('tt2222222').map((s) => s.url), ['u5']);
  assert.equal(streams.get('tt1111111'), undefined);
  assert.equal(streams.get('tt3333333').length, 1, 'la nota no es un stream');
});

function addonDePrueba(archivos = ARCHIVOS) {
  const f = { listar: async () => f.archivos, claveValida: async (c) => c === 'buena', archivos };
  return { addon: crearAddon({ token: 'secreto', fuente: f, nombre: 'Prueba' }), f };
}

test('rutas: sin el token no hay nada; con él, manifest, catálogo y stream', async () => {
  const { addon } = addonDePrueba();
  await addon.refrescar();
  assert.equal((await addon.responder('GET', '/manifest.json')).status, 404);
  assert.equal((await addon.responder('GET', '/malo/manifest.json')).status, 404);
  assert.equal((await addon.responder('GET', '/malo/stream/series/tt1111111%3A1%3A1.json')).status, 404);
  const m = (await addon.responder('GET', '/secreto/manifest.json')).datos;
  assert.equal(m.name, 'Prueba');
  assert.deepEqual(m.resources, ['catalog', 'stream']);
  assert.deepEqual(m.idPrefixes, ['tt']);
  assert.deepEqual(m.catalogs.map((c) => c.type), ['movie', 'series']);
  assert.equal((await addon.responder('GET', '/secreto/catalog/movie/merida-pelis.json')).datos.metas.length, 2);
  assert.equal((await addon.responder('GET', '/secreto/stream/series/tt1111111%3A1%3A1.json')).datos.streams.length, 2);
  assert.equal((await addon.responder('GET', '/secreto/stream/series/tt1111111:1:1.json')).datos.streams.length, 2);
  assert.deepEqual((await addon.responder('GET', '/secreto/stream/movie/tt9999999.json')).datos, { streams: [] });
});

test('refrescar: pide una clave válida, y lo nuevo aparece; si la fuente falla, se sigue con lo que había', async () => {
  const { addon, f } = addonDePrueba();
  await addon.refrescar();
  const nueva = { nombre: 'N.mkv', ruta: 'Pelis/N [tt4444444]/N.mkv', url: 'u9', modificado: '2026-06-01' };
  f.archivos = [...ARCHIVOS, nueva];
  assert.equal((await addon.responder('GET', '/secreto/stream/movie/tt4444444.json')).datos.streams.length, 0, 'en caché hasta que se refresque');
  assert.equal((await addon.responder('POST', '/refrescar')).status, 401);
  assert.equal((await addon.responder('POST', '/refrescar', 'Bearer mala')).status, 401);
  assert.equal((await addon.responder('GET', '/refrescar')).status, 405);
  const r = await addon.responder('POST', '/refrescar', 'Bearer buena');
  assert.deepEqual([r.status, r.datos.titulos], [200, 4]);
  assert.equal((await addon.responder('GET', '/secreto/stream/movie/tt4444444.json')).datos.streams.length, 1);
  f.listar = async () => {
    throw new Error('Segovia caída');
  };
  await assert.rejects(addon.refrescar());
  assert.equal((await addon.responder('GET', '/secreto/stream/movie/tt4444444.json')).datos.streams.length, 1);
});

test('refrescar en plena lectura vuelve a leer: esa lectura ya no vería lo recién subido', async () => {
  const { addon, f } = addonDePrueba([]);
  let lecturas = 0;
  f.listar = async () => {
    const n = ++lecturas;
    await new Promise((ok) => setTimeout(ok, 10));
    return n === 1 ? [] : ARCHIVOS;
  };
  const a = addon.refrescar();
  const b = addon.refrescar();
  await Promise.all([a, b]);
  assert.equal(lecturas, 2);
  assert.equal((await addon.responder('GET', '/secreto/catalog/movie/merida-pelis.json')).datos.metas.length, 2);
});

test('manifest: el logo es una URL absoluta, de la dirección por la que se ha pedido', async () => {
  const { addon } = addonDePrueba();
  const { datos } = await addon.responder('GET', '/secreto/manifest.json', undefined, 'https://m.example');
  assert.equal(datos.logo, 'https://m.example/logo.png');
});

test('recién arrancado: la primera petición espera a la primera lectura', async () => {
  const { addon } = addonDePrueba();
  addon.refrescar();
  assert.equal((await addon.responder('GET', '/secreto/catalog/movie/merida-pelis.json')).datos.metas.length, 2);
});
