/* atlas.js: the art, and where every frame of it lives.

   All of Franjo Setrov's animation came out of the 2021 build as grids of frames
   on a handful of big sheets. Each sheet here records the frame size, how many
   frames sit across a row, and the anchor offset that the original used, so the
   rest of the game can say drawFrame(A.bob, 7, x, y, scale) and never think
   about pixel coordinates again.

   The sheets are WebP now rather than PNG. Same pixels, about a sixth of the
   bytes, which is the difference between a five second load on a school iPad
   and a thirty second one. */

(function (global) {
  'use strict';

  var IMG = 'assets/img/';

  /* Every image the game needs, by the short name the code uses. */
  var FILES = {
    bob:    'bob.webp',      // Bob swimming, 20 frames
    lisa:   'lisa.webp',     // Lisa swimming, 20 frames
    pair0:  'pair0.webp',    // the two of them holding hands, frames 0 to 11
    pair1:  'pair1.webp',    // and frames 12 to 19
    goby:   'goby.webp',     // the Goby Fish
    shrimp: 'shrimp.webp',   // the Candy Cane Shrimp
    weed0:  'weed0.webp',    // swaying seaweed, frames 0 to 13
    weed1:  'weed1.webp',    // and frames 14 to 19
    bg1:    'bg1.webp',  bg2: 'bg2.webp',  bg3: 'bg3.webp',   // far reef
    mg1:    'mg1.webp',  mg2: 'mg2.webp',  mg3: 'mg3.webp',   // near reef
    fg1:    'fg1.webp',  fg2: 'fg2.webp',  fg3: 'fg3.webp',   // foreground rocks
    fg4:    'fg4.webp',  fg5: 'fg5.webp',
    splash: 'splash.webp',   // the title painting
    sunset: 'sunset.webp'    // the sunset, for the end of a dive
  };

  var images = {};

  /* A sheet is: which images it spans, the size of one frame, how many frames
     fit across a row, how many frames each image holds, and the anchor offset
     that lines the drawing up with its neighbours. */
  function sheet(srcs, fw, fh, cols, counts, ox, oy, fps) {
    var frames = [], s, i, total = 0;
    for (s = 0; s < srcs.length; s++) {
      for (i = 0; i < counts[s]; i++) {
        frames.push({
          img: srcs[s],
          sx: (i % cols) * fw,
          sy: Math.floor(i / cols) * fh
        });
        total++;
      }
    }
    return { frames: frames, n: total, fw: fw, fh: fh, ox: ox, oy: oy, fps: fps };
  }

  var A = {
    bob:    sheet(['bob'],            256, 256,  7, [20],     12,  1, 20),
    lisa:   sheet(['lisa'],           512, 256,  3, [20],      2, 12, 20),
    pair:   sheet(['pair0', 'pair1'], 512, 512,  3, [12, 8],  11, 11, 20),
    goby:   sheet(['goby'],           128,  64, 15, [15],      5,  2, 12),
    shrimp: sheet(['shrimp'],         128,  64,  8, [8],       5,  5, 12),
    weed:   sheet(['weed0', 'weed1'], 256, 1024, 7, [14, 6], 159, 87, 10)
  };

  /* Draw one frame. (x, y) is the anchor; the offsets shift the artwork off it
     the same way the original did, which is what keeps the joints lined up. */
  A.draw = function (ctx, sh, i, x, y, scale, flip) {
    var f = sh.frames[((i % sh.n) + sh.n) % sh.n];
    var im = images[f.img];
    if (!im) return;
    var w = sh.fw * scale, h = sh.fh * scale;
    var dx = x + sh.ox * scale, dy = y + sh.oy * scale;
    if (flip) {
      ctx.save();
      ctx.translate(dx + w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(im, f.sx, f.sy, sh.fw, sh.fh, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(im, f.sx, f.sy, sh.fw, sh.fh, dx, dy, w, h);
    }
  };

  /* A plain image, for the reef layers and the two paintings. */
  A.img = function (name) { return images[name]; };

  A.drawImg = function (ctx, name, x, y, w, h) {
    var im = images[name];
    if (im) ctx.drawImage(im, x, y, w === undefined ? im.width : w, h === undefined ? im.height : h);
  };

  /* Load the lot, reporting progress so the loading bar means something.
     One failed image must not take the whole game down with it, so a miss
     resolves rather than rejects and simply draws nothing. */
  A.load = function (onProgress) {
    var names = Object.keys(FILES);
    var done = 0;
    return Promise.all(names.map(function (name) {
      return new Promise(function (resolve) {
        var im = new Image();
        im.onload = im.onerror = function () {
          if (im.naturalWidth) images[name] = im;
          done++;
          if (onProgress) onProgress(done / names.length);
          resolve();
        };
        im.src = IMG + FILES[name];
      });
    }));
  };

  global.A = A;
}(window));
