# Aventura orbital

Banco activo de motivos originales para la sonificación del árbol. Su dirección
musical es una aventura espacial luminosa: compás de 6/8, cuerdas en movimiento,
flauta, trompa y campanas. No contiene grabaciones ni melodías extraídas de
videojuegos. Sustituye al banco activo de piano anterior.

Grabaciones de instrumentos:

- **VSCO 2 Community Edition**: Sam Gossner y Simon Dalzell; edición de muestras
  por Elan Hickler/Soundemote. [Repositorio y licencia](https://github.com/sgossner/VSCO-2-CE/tree/440300901dfe9275fd84e0b7763af1f8443ae62e).
  Cuerdas, flauta, trompa y violonchelos.
- **Versilian Community Sample Library**: Versilian Studios LLC.
  [Repositorio y licencia](https://github.com/sgossner/VCSL/tree/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e).
  Glockenspiel.

Ambas bibliotecas distribuyen estas grabaciones bajo **CC0 1.0**. Se conservan
las fuentes y las licencias en `source/`. El manifiesto registra rutas,
revisiones, afinación y huellas SHA-256. La referencia MIDI de VSCO se ha
comprobado en sus mapas SFZ: C4 del nombre del archivo corresponde a MIDI 72;
C3 corresponde a MIDI 60. El glockenspiel C5 corresponde a MIDI 72.

Adaptaciones: mezcla mono a 24 kHz, recorte inicial, remuestreo de cada nota,
envolventes, pequeñas reflexiones y normalización. Los motivos conservan su
ritmo y duración en sus once variantes de registro. Cada motivo dura 2 s, se
inicia uno cada 1.5 s y se normaliza a pico 0.6. La base dura 6 s y su pico es
0.5. Se usan grabaciones, sin osciladores durante la reproducción.

Reconstrucción: `scripts/preparar-aventura.mjs`, con Playwright y Chrome
externos. La demo está en `docs/audio-propuestas/aventura-orbital/`.
