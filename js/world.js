/* world.js: the ocean.

   The reef paintings are 1280 by 720, the shape of the screen the game was
   drawn for in 2021. A phone held upright is nothing like that shape, so rather
   than letterbox the art into a stripe, the world is anchored to the sea floor
   and the water simply carries on upward: gradient, light shafts, drifting
   motes and, if there is room, the surface itself. That empty water is not
   filler, it is where the up and down dodging happens, and on a tall screen it
   is most of the playfield.

   Everything scrolls off one number, scrollX, in world pixels. The far reef
   moves at half that, the near reef at one, the foreground rocks at two. The
   things you can actually touch, the creatures and the hazards, live on the
   near reef plane so what you see is what you hit. */

(function (global) {
  'use strict';

  var ART_W = 1280;        // one reef panel
  var ART_H = 720;         // the design height, and the sea floor sits at the bottom of it
  var LOOP  = ART_W * 3;   // three panels before the reef repeats

  /* Water colours, sampled straight off the original sea background so the
     painted reef still sits in the right coloured water. */
  var SEA_TOP = [0x33, 0x99, 0xfe];
  var SEA_MID = [0x65, 0x31, 0xff];
  var SEA_LOW = [0x01, 0x00, 0x68];
  var SURFACE = [0xa8, 0xe8, 0xff];
  var SURFACE_DEPTH = 520;   // how deep the bright water under the surface runs

  function rgb(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')';
  }

  var World = {};

  /* ------------------------------------------------------------------ state */

  World.reset = function (seed) {
    this.props = [];        // foreground rocks, decoration only
    this.weeds = [];        // seaweed, catches whoever is swimming alone
    this.curtains = [];     // rising bubble curtains, same
    this.jellies = [];      // and the one thing holding hands will not save you from
    this.motes = [];
    this.pops = [];         // little burst rings when something is caught
    this.t = 0;
    this.nextProp = 900;
    this.nextWeed = 4200;
    this.nextCurtain = 2600;
    /* The first jellyfish is a long way in. It is the only hazard that can take
       a real bite out of your air, so it has to arrive as an event, not as part
       of the furniture. */
    this.nextJelly = 7000;
    this.propBag = [];
    this.schools = [];
    this.nextSchool = 700;
    for (var i = 0; i < 70; i++) {
      this.motes.push({
        x: Math.random(), y: Math.random(),
        r: 0.6 + Math.random() * 2.2,
        s: 0.15 + Math.random() * 0.5,
        a: 0.12 + Math.random() * 0.3
      });
    }
  };

  /* Foreground rocks come out of a shuffled bag rather than at random, so you
     never get the same one three times running. */
  function nextProp(w) {
    if (!w.propBag.length) {
      w.propBag = ['fg1', 'fg2', 'fg3', 'fg4', 'fg5'];
      for (var i = w.propBag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = w.propBag[i]; w.propBag[i] = w.propBag[j]; w.propBag[j] = t;
      }
    }
    return w.propBag.pop();
  }

  /* ----------------------------------------------------------------- spawns */

  /* The seaweed art sits inside a 256 by 1024 cell with a lot of empty space
     around it, so these numbers translate between "where the plant is" and
     "where to put the anchor". One plant is 148 by 533 of real pixels. */
  var WEED_S    = 1.0;             // how big one plant is drawn
  var WEED_CX   = 273 * WEED_S;    // from the anchor to the middle of the plant
  var WEED_HALF = 74 * WEED_S;     // half the plant's width
  var WEED_TOP  = 92 * WEED_S;     // from the anchor down to the tip of the plant
  var WEED_H    = 533 * WEED_S;    // and how tall it is

  /* The swimmable column changes shape with the screen, so hazards are placed
     against it rather than against the painting. Without this, a phone held
     upright has a playfield four times taller than the reef and every plant is
     down in a corner you can simply swim over. */
  World.band = { top: 60, bottom: 560 };
  World.setBand = function (top, bottom) { this.band.top = top; this.band.bottom = bottom; };

  function weedTop(p) {
    var b = World.band;
    return b.top + p.topFrac * (b.bottom - b.top);
  }

  World.update = function (dt, scrollX, viewW, difficulty) {
    var ahead = scrollX + viewW + 400;
    var i;

    while (this.nextProp < ahead) {
      this.props.push({ img: nextProp(this), fx: this.nextProp, y: 250 + Math.random() * 180 });
      this.nextProp += 1100 + Math.random() * 900;
    }
    /* Hazards thicken as the dive goes on. difficulty runs 0 to 1. */
    while (this.nextWeed < ahead) {
      this.weeds.push({
        wx: this.nextWeed,
        topFrac: 0.34 + Math.random() * 0.26,
        sheetOff: Math.random() * 20
      });
      this.nextWeed += (2600 - 1100 * difficulty) + Math.random() * 900;
    }
    while (this.nextCurtain < ahead) {
      var w = 90 + Math.random() * 60;
      var bubbles = [];
      for (i = 0; i < 46; i++) {
        bubbles.push({
          ox: Math.random() * w,
          p: Math.random(),               // phase up the column, 0 at the floor
          r: 4 + Math.random() * 13,
          sp: 0.22 + Math.random() * 0.3,
          wob: Math.random() * 6.283
        });
      }
      this.curtains.push({ wx: this.nextCurtain, w: w, bubbles: bubbles, burst: 0 });
      this.nextCurtain += (2200 - 900 * difficulty) + Math.random() * 1100;
    }

    while (this.nextJelly < ahead) {
      this.jellies.push({
        wx: this.nextJelly,
        frac: 0.3 + Math.random() * 0.4,   // never hard against the top or floor
        ph: Math.random() * 6.283,
        drift: 8 + Math.random() * 16,
        sway: 26 + Math.random() * 40,
        hit: 0
      });
      this.nextJelly += (5600 - 2400 * difficulty) + Math.random() * 2800;
    }

    /* Distant schools. Far off, small and dim, drifting across the empty water
       at a third of the reef's pace, using the goby art. Cheap, and the sea
       stops looking like an empty swimming pool. */
    while (this.nextSchool < scrollX * 0.35 + viewW + 400) {
      var n = 5 + Math.floor(Math.random() * 5), fish = [];
      for (i = 0; i < n; i++) {
        fish.push({ dx: Math.random() * 210, dy: Math.random() * 120,
                    ph: Math.random() * 6.283, sc: 0.36 + Math.random() * 0.22 });
      }
      this.schools.push({ fx: this.nextSchool, frac: 0.05 + Math.random() * 0.42, fish: fish });
      this.nextSchool += 1400 + Math.random() * 2400;
    }

    /* Retire anything well behind us. */
    var behindF = (scrollX * 2) - 1400;
    var behind = scrollX - 900;
    this.props = this.props.filter(function (p) { return p.fx > behindF; });
    this.weeds = this.weeds.filter(function (p) { return p.wx > behind; });
    this.curtains = this.curtains.filter(function (p) { return p.wx > behind; });
    this.jellies = this.jellies.filter(function (p) { return p.wx > behind; });
    var behindS = scrollX * 0.35 - 700;
    this.schools = this.schools.filter(function (p) { return p.fx > behindS; });

    for (i = this.pops.length - 1; i >= 0; i--) {
      this.pops[i].life -= dt;
      if (this.pops[i].life <= 0) this.pops.splice(i, 1);
    }
    for (i = 0; i < this.curtains.length; i++) {
      if (this.curtains[i].burst > 0) this.curtains[i].burst -= dt;
    }
    for (i = 0; i < this.jellies.length; i++) {
      this.jellies[i].wx -= this.jellies[i].drift * dt;
      if (this.jellies[i].hit > 0) this.jellies[i].hit -= dt;
    }
  };

  World.pop = function (x, y, tint) {
    this.pops.push({ x: x, y: y, life: 0.5, max: 0.5, tint: tint || '#ffffff' });
  };

  /* ------------------------------------------------------------- collisions */

  /* The band of world x a curtain occupies. */
  World.curtainAt = function (wx) {
    for (var i = 0; i < this.curtains.length; i++) {
      var c = this.curtains[i];
      if (wx > c.wx - 40 && wx < c.wx + c.w + 40) return c;
    }
    return null;
  };

  /* Seaweed only counts if you are level with the plant, not sailing over it. */
  World.weedAt = function (wx, y) {
    for (var i = 0; i < this.weeds.length; i++) {
      var p = this.weeds[i];
      var cx = p.wx;
      if (wx > cx - WEED_HALF - 25 && wx < cx + WEED_HALF + 25) {
        if (y > weedTop(p) - 40) return p;
      }
    }
    return null;
  };

  /* A jellyfish is a bell you can see and a curtain of tentacles under it that
     you can also see, so the shape it stings you with is the shape it looks
     like. Generous rather than exact: this is meant to be dodged, not measured. */
  var JELLY_R  = 58;                  // the bell
  var JELLY_RX = 76;                  // and the sting, out to the sides
  var JELLY_RY = 112;                 // and down through the tentacles
  var JELLY_DY = 48;                  // how far below the bell that sting sits

  World.jellyY = function (j) {
    var b = this.band;
    return b.top + j.frac * (b.bottom - b.top) + Math.sin(this.t * 0.55 + j.ph) * j.sway;
  };

  World.jellyAt = function (wx, y, r) {
    for (var i = 0; i < this.jellies.length; i++) {
      var j = this.jellies[i];
      var dx = (wx - j.wx) / (JELLY_RX + r);
      var dy = (y - (this.jellyY(j) + JELLY_DY)) / (JELLY_RY + r);
      if (dx * dx + dy * dy < 1) return j;
    }
    return null;
  };

  /* How close the nearest jellyfish is, 0 when there is none in range and 1
     when it is level with you. The rumble is driven off this: you feel it
     before you can see what it is, which is the whole point of it. */
  World.jellyDread = function (wx, range) {
    var worst = 0;
    for (var i = 0; i < this.jellies.length; i++) {
      var d = Math.abs(this.jellies[i].wx - wx);
      if (d < range) worst = Math.max(worst, 1 - d / range);
    }
    return worst;
  };

  /* ---------------------------------------------------------------- drawing */

  /* Water, light and motes. Everything else is painted on top of this. */
  World.drawWater = function (ctx, view) {
    var oy = view.oy, h = view.h, w = view.w, i;

    /* The painted reef expects its own gradient, so the art band keeps the
       original colours exactly and only the water above it is invented. */
    var g = ctx.createLinearGradient(0, oy, 0, oy + ART_H);
    g.addColorStop(0, rgb(SEA_TOP));
    g.addColorStop(0.5, rgb(SEA_MID));
    g.addColorStop(1, rgb(SEA_LOW));
    ctx.fillStyle = g;
    ctx.fillRect(0, oy, w, h - oy);

    if (oy > 0) {
      /* The surface is a thin bright lid, not half the picture. Anything more
         and a phone held upright looks like a swimming pool rather than the
         open sea.

         The gradient has a fixed depth rather than being squeezed into whatever
         gap sits above the reef. Without that, the moment the camera starts to
         rise at the end of a dive the gap opens from nothing and the top of the
         screen flashes white. This way the surface slides down into view. */
      var span = Math.max(oy, SURFACE_DEPTH);
      var g2 = ctx.createLinearGradient(0, oy - span, 0, oy);
      g2.addColorStop(0, rgb(SURFACE));
      g2.addColorStop(0.07, '#4fb0ff');
      g2.addColorStop(0.35, '#2461d8');
      g2.addColorStop(0.85, '#2a72e8');
      g2.addColorStop(1, rgb(SEA_TOP));
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, oy + 1);
      if (oy >= SURFACE_DEPTH) this.drawSurface(ctx, view);
    }

    this.drawRays(ctx, view);

    /* Motes: plankton, more or less. They tell you the water is moving even
       when you are holding still. */
    ctx.fillStyle = '#dff3ff';
    for (i = 0; i < this.motes.length; i++) {
      var m = this.motes[i];
      var mx = (m.x * w - this.t * m.s * 60) % w;
      if (mx < 0) mx += w;
      var my = (m.y * h + Math.sin(this.t * m.s + m.x * 10) * 8) % h;
      ctx.globalAlpha = m.a;
      ctx.beginPath();
      ctx.arc(mx, my, m.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  /* The surface, seen from below: a bright rippling ceiling. Only ever visible
     on a tall screen, which is exactly where the water needed something. */
  World.drawSurface = function (ctx, view) {
    var w = view.w, band = Math.min(70, view.oy * 0.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#bfeaff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (var x = 0; x <= w; x += 24) {
      ctx.lineTo(x, band * (0.55 + 0.45 * Math.sin(x * 0.011 + this.t * 0.9) * Math.sin(x * 0.004 - this.t * 0.5)));
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  /* Light shafts. Four of them, wide and soft, drifting on their own clocks.
     These replace an eight file, 440 KB sprite sheet that flashed for three
     seconds when you scored, and they are on screen the whole dive instead. */
  World.drawRays = function (ctx, view) {
    var w = view.w, h = view.h, i, j;
    /* Light comes from the surface, so the shafts have to die out long before
       the sea floor. Running them the full height of a tall screen made them
       read as banding rather than as light in water. */
    var reach = Math.min(h * 0.8, 900);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(0, 0, 0, reach);
    g.addColorStop(0, 'rgba(200,240,255,0.05)');
    g.addColorStop(0.45, 'rgba(155,218,255,0.022)');
    g.addColorStop(1, 'rgba(140,210,255,0)');
    ctx.fillStyle = g;
    for (i = 0; i < 3; i++) {
      var ph = this.t * (0.05 + i * 0.021) + i * 2.4;
      var x = (0.2 + i * 0.31) * w + Math.sin(ph) * w * 0.09;
      /* Six nested wedges rather than one. Canvas has no cheap blur that is
         safe on older Safari, and stacking narrowing shapes at low alpha gives
         a soft edge for the same money. */
      for (j = 0; j < 6; j++) {
        var k = 1 - j * 0.155;
        ctx.beginPath();
        ctx.moveTo(x - (48 + i * 26) * k, 0);
        ctx.lineTo(x + (48 + i * 26) * k, 0);
        ctx.lineTo(x + (200 + i * 70) * k, reach);
        ctx.lineTo(x - (200 + i * 70) * k, reach);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  };

  /* Tile one reef layer. The panels were painted to butt up against each other
     and repeat every three, so this walks whole panels either side of the view
     and never draws one that is off screen. */
  function tile(ctx, names, offset, viewW, y, w, h) {
    var loop = w * 3;
    offset = ((offset % loop) + loop) % loop;
    var start = Math.floor(offset / w);
    var x = start * w - offset;
    var idx = ((start % 3) + 3) % 3;
    while (x < viewW) {
      A.drawImg(ctx, names[idx], x, y, w, h);
      x += w;
      idx = (idx + 1) % 3;
    }
  }

  World.drawSchools = function (ctx, view, scrollX) {
    var sxOff = scrollX * 0.35;
    var top = this.band.top;
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (var i = 0; i < this.schools.length; i++) {
      var s = this.schools[i];
      var bx = s.fx - sxOff;
      if (bx < -320 || bx > view.w + 320) continue;
      var by = top + s.frac * (this.band.bottom - top) - 120;
      for (var j = 0; j < s.fish.length; j++) {
        var f = s.fish[j];
        A.draw(ctx, A.goby, Math.floor(this.t * 9 + j * 3),
               bx + f.dx, by + f.dy + Math.sin(this.t * 0.7 + f.ph) * 16, f.sc, true);
      }
    }
    ctx.restore();
  };

  World.drawReef = function (ctx, view, scrollX) {
    /* On a tall screen the far reef is drawn bigger and still stood on the sea
       floor, so its pillars climb into the open water instead of leaving a
       blank blue half. It is scenery, so growing it changes nothing you can
       swim into. */
    var bs = Math.max(1, Math.min(1.95, view.h / ART_H));
    var bw = ART_W * bs, bh = ART_H * bs;
    tile(ctx, ['bg1', 'bg2', 'bg3'], scrollX * 0.5, view.w, view.h - bh, bw, bh);
    tile(ctx, ['mg1', 'mg2', 'mg3'], scrollX, view.w, view.oy, ART_W, ART_H);
  };

  /* Seaweed sways on its own sheet of 20 frames. Each plant starts on a
     different frame so a row of them does not sway in lockstep. */
  /* A plant is 533 pixels of art, and the column it has to block can be three
     times that on a tall screen, so a patch is a stack of plants rather than
     one stretched one. Stretching would have made the leaves absurdly fat. */
  World.drawWeeds = function (ctx, view, scrollX) {
    var floor = this.band.bottom + 160;
    for (var i = 0; i < this.weeds.length; i++) {
      var p = this.weeds[i];
      var sx = p.wx - scrollX;
      if (sx < -320 || sx > view.w + 320) continue;
      var top = weedTop(p);
      var f = Math.floor(p.sheetOff + this.t * A.weed.fps * 0.5);
      for (var y = top, k = 0; y < floor && k < 6; y += WEED_H * 0.74, k++) {
        A.draw(ctx, A.weed, f + k * 3, sx - WEED_CX + (k % 2 ? 16 : -14),
               y - WEED_TOP, WEED_S);
      }
    }
  };

  World.drawCurtains = function (ctx, view, scrollX) {
    var i, j;
    ctx.save();
    for (i = 0; i < this.curtains.length; i++) {
      var c = this.curtains[i];
      var sx = c.wx - scrollX;
      if (sx < -260 || sx > view.w + 260) continue;
      var span = view.h + 120;
      for (j = 0; j < c.bubbles.length; j++) {
        var b = c.bubbles[j];
        var p = (b.p + this.t * b.sp) % 1;
        var by = view.h + 40 - p * span;
        var bx = sx + b.ox + Math.sin(p * 9 + b.wob) * 11;
        var r = b.r * (0.6 + p * 0.55);
        var a = 0.5 * Math.min(1, p * 5) * (1 - p * 0.35);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#eaf9ff';
        ctx.beginPath(); ctx.arc(bx, by, r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, 6.283); ctx.stroke();
        ctx.globalAlpha = a * 0.7;
        ctx.beginPath(); ctx.arc(bx - r * 0.32, by - r * 0.34, r * 0.24, 0, 6.283); ctx.fill();
      }
      if (c.burst > 0) {
        /* The shrimp's push blowing the curtain apart. Faded at both ends so it
           reads as light through water rather than a white bar. */
        var bg = ctx.createLinearGradient(sx - 30, 0, sx + c.w + 30, 0);
        bg.addColorStop(0, 'rgba(255,255,255,0)');
        bg.addColorStop(0.5, 'rgba(255,255,255,1)');
        bg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = Math.max(0, c.burst) * 1.4;
        ctx.fillStyle = bg;
        ctx.fillRect(sx - 30, 0, c.w + 60, view.h);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* Foreground rocks, drawn over everything at double speed. They are the
     reason the reef reads as having depth rather than as a flat backdrop. */
  World.drawProps = function (ctx, view, scrollX) {
    var fx = scrollX * 2;
    for (var i = 0; i < this.props.length; i++) {
      var p = this.props[i];
      var im = A.img(p.img);
      if (!im) continue;
      var sx = p.fx - fx;
      if (sx < -im.width - 40 || sx > view.w + 40) continue;
      ctx.drawImage(im, sx, view.oy + p.y);
    }
  };

  World.drawJellies = function (ctx, view, scrollX) {
    for (var i = 0; i < this.jellies.length; i++) {
      var j = this.jellies[i];
      var x = j.wx - scrollX;
      if (x < -300 || x > view.w + 300) continue;
      var y = this.jellyY(j);
      var pulse = Math.sin(this.t * 2.1 + j.ph);
      var rx = JELLY_R * (1 + pulse * 0.13);
      var ry = JELLY_R * (0.82 - pulse * 0.16);
      var flash = Math.max(0, j.hit) * 2;

      ctx.save();

      /* Glow first, so the thing announces itself from a distance. */
      ctx.globalCompositeOperation = 'lighter';
      var gl = ctx.createRadialGradient(x, y, 8, x, y, JELLY_R * 3.1);
      gl.addColorStop(0, 'rgba(255,150,225,' + (0.3 + flash * 0.4).toFixed(3) + ')');
      gl.addColorStop(1, 'rgba(255,150,225,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - JELLY_R * 3.2, y - JELLY_R * 3.2, JELLY_R * 6.4, JELLY_R * 6.4);
      ctx.globalCompositeOperation = 'source-over';

      /* Tentacles, trailing and out of step with each other. */
      ctx.lineCap = 'round';
      for (var k = 0; k < 9; k++) {
        var ox = (k - 4) * (rx * 0.21);
        var len = JELLY_R * (2.2 + (k % 3) * 0.55);
        var g = ctx.createLinearGradient(0, y, 0, y + len);
        g.addColorStop(0, 'rgba(255,190,240,0.72)');
        g.addColorStop(1, 'rgba(255,190,240,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(x + ox, y + ry * 0.5);
        for (var t = 0.18; t <= 1.001; t += 0.18) {
          ctx.lineTo(x + ox + Math.sin(this.t * 2.6 + k * 0.9 + t * 3.4) * 13 * t,
                     y + ry * 0.5 + len * t);
        }
        ctx.stroke();
      }

      /* The bell. */
      var bg = ctx.createRadialGradient(x - rx * 0.25, y - ry * 0.45, rx * 0.1, x, y, rx * 1.15);
      bg.addColorStop(0, 'rgba(255,236,250,0.94)');
      bg.addColorStop(0.55, 'rgba(255,143,224,0.72)');
      bg.addColorStop(1, 'rgba(214,92,205,0.42)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0);
      ctx.bezierCurveTo(x + rx, y + ry * 0.62, x - rx, y + ry * 0.62, x - rx, y);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 + flash * 0.3).toFixed(2) + ')';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.restore();
    }
  };

  World.drawPops = function (ctx) {
    for (var i = 0; i < this.pops.length; i++) {
      var p = this.pops[i];
      var k = 1 - p.life / p.max;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = p.tint;
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18 + k * 74, 0, 6.283);
      ctx.stroke();
      ctx.restore();
    }
  };

  World.t = 0;
  World.ART_W = ART_W;
  World.ART_H = ART_H;

  global.World = World;
}(window));
