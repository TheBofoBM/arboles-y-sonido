# Banco de sampleos del prototipo

Piano original: **Alexander Holm, Salamander Grand Piano**.
Licencia: [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/).
Fuente: [Tonejs/audio, Salamander](https://github.com/Tonejs/audio/tree/master/salamander).
Grabación utilizada: [C4.mp3](https://tonejs.github.io/audio/salamander/C4.mp3).

Se conserva la grabación original en `source/C4.mp3` y su README de licencia.
Adaptación del prototipo: remuestreo a 24 kHz, cambios de altura mediante
remuestreo, montaje de cuatro notas por fragmento, envolventes y normalización.
Los cinco WAV melódicos duran 1.5 segundos y usan una misma colección
pentatónica de Do. Son audio previamente preparado a partir de piano grabado.
La aplicación reproduce estos archivos; no genera tonos con osciladores.

`manifest.json` registra patrones y huellas SHA-256. El script de autoría
`scripts/preparar-sampleos.mjs` permite reconstruir los archivos indicando una
instalación externa de Playwright y Chrome; no es una dependencia de la app.
El banco se distribuye localmente con la compilación, sin solicitudes a Tone.js
durante la reproducción. La selección de muestras es una primera propuesta
musical, pendiente de evaluación con oyentes.
