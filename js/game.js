/* game.js: the dive.

   The rules all come out of book two. Bob's air runs out and Lisa shares hers,
   so holding hands is not a flourish, it is how you survive. The Goby Fish has
   perfect eyesight and finds you air. The Candy Cane Shrimp is nearly blind but
   strong, and gives you a push through anything in the way. Catch one of each
   together and that is symbiosis, which is the whole reason David wrote the
   book after a dive off Koh Tao in 2018.

   Everything you can tune sits in the block at the top. */

(function () {
  'use strict';

  /* --------------------------------------------------------------- tuning */

  var MIN_VIEW_W = 880;   // never show less world than this across, so a phone held
                          // upright still has room to see what is coming
  var REACH_UP   = 900;   // how far above the reef you may swim, in world pixels
  var FLOOR_Y    = 560;   // how far down, measured in the art's own 720 high frame

  var SWIM       = 360;   // forward push, world pixels a second
  var CURRENT    = 165;   // what the sea pushes back with, always
  var RISE       = 340;   // up and down speed, raised on a tall screen so that
                          // crossing the water still takes about the same time
  var ACCEL      = 9;     // how quickly you reach those speeds

  var JOIN_SPEED = 0.80;  // holding hands is slower
  var BOOST_MULT = 1.75;  // and the shrimp's push is faster
  var BOOST_TIME = 2.6;

  var AIR_BASE   = 0.0215;  // air lost a second at the start of a dive
  var AIR_SQUEEZE = 7000;  // every this many pixels, the drain goes up by that
                            // much again, and it never stops. Without it a
                            // player who has understood the game simply never
                            // runs out, and the dive has no ending to earn.
  var AIR_SWIM   = 1.25;    // kicking hard costs more
  var AIR_JOIN   = 0.32;    // Lisa sharing costs far less
  var AIR_WEED   = 2.0;     // being tangled costs most of all
  var AIR_GOBY   = 0.20;    // what a Goby Fish gives back
  var AIR_SHRIMP = 0.06;
  var AIR_SYMB   = 0.30;    // and what the pair of them give back together

  var SYMB_WINDOW = 5.0;    // seconds between the two catches to count as symbiosis

  /* A curtain has to leave you crawling forward, not sliding backwards: apart,
     0.55 of full push still beats the current, just barely. Anything under
     about 0.46 traps a player who has not worked out the join button yet. */
  var CURTAIN_SLOW = 0.55;  // how much a bubble curtain slows you when apart
  var CURTAIN_JOIN = 0.85;  // and when together
  var CURTAIN_LIFT = 95;    // it also shoves you upward when you are apart

  /* Where a shared score sends people. Not location.href: the game is embedded
     in an iframe on the shop, so that would hand out the raw GitHub Pages
     address instead of the page the game actually lives on. */
  var GAMES_URL  = 'https://bigheadbob.com/pages/games';

  var PX_PER_M   = 45;      // world pixels to a metre on the scoreboard
  var RAMP_PX    = 14000;   // distance over which the dive reaches full difficulty

  var JELLY_HIT   = 40;     // how close you have to get to be stung. Small, so
                            // you can graze the tentacles and get away with it
  var JELLY_STING = 0.14;   // air lost to a sting
  var JELLY_DREAD = 950;    // how far ahead of one the rumble starts
  var SHAKE_DREAD = 4.5;    // how hard the rumble shakes, in world pixels
  var SHAKE_STING = 20;     // and how hard the sting does
  var STUN_TIME   = 0.55;   // how long a sting leaves you floundering

  var SURFACE_TIME = 2.6;   // seconds spent rising once the air runs out

  var HIT_R      = 100;     // how forgiving catching a creature is
  var MAX_ALIVE  = 6;       // creatures on screen at once
  var SPAWN_SPREAD = 760;   // how far up or down of the divers a creature can
                            // appear. Fixed rather than a share of the column,
                            // so the same skill gets the same dive whatever
                            // shape the screen is.
  var PAIR_ODDS  = 0.42;    // how often a goby and a shrimp arrive together

  /* ----------------------------------------------------------------- setup */

  var app = document.getElementById('app');
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');

  var $ = function (id) { return document.getElementById(id); };
  var overlay = $('overlay');
  var hud = $('hud');
  var panels = {
    load: $('panelLoad'), title: $('panelTitle'), how: $('panelHow'),
    credits: $('panelCredits'), dedication: $('panelDedication'),
    pictures: $('panelPictures'), share: $('panelShare'),
    pause: $('panelPause'), over: $('panelOver')
  };

  var view = { w: 1280, h: 720, oy: 0, scale: 1, cw: 1280, ch: 720 };
  var state = 'load';
  var last = 0;
  var muted = false;
  var touchMode = false;

  var run = null;   // everything about the dive currently in progress

  /* ------------------------------------------------------------- storage */

  var KEY = 'bhb-dive-v1';
  var save = { best: 0, taught: {} };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) save = Object.assign(save, JSON.parse(raw));
    muted = localStorage.getItem(KEY + '-muted') === '1';
  } catch (e) { /* private browsing, play on without a best score */ }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
      localStorage.setItem(KEY + '-muted', muted ? '1' : '0');
    } catch (e) { /* nothing we can do, and nothing worth interrupting play for */ }
  }

  /* --------------------------------------------------------------- audio */

  var Sound = (function () {
    var files = {
      music: 'assets/audio/music.m4a',
      ambience: 'assets/audio/ambience.m4a',
      bubbles: 'assets/audio/bubbles.m4a',
      collect: 'assets/audio/collect.m4a',
      click: 'assets/audio/click.m4a',
      gameover: 'assets/audio/gameover.m4a',
      reward: 'assets/audio/reward.m4a'
    };
    var loops = {}, pools = {}, ready = false;

    function make(src, vol, loop) {
      var a = new Audio(src);
      a.preload = 'auto';
      a.volume = vol;
      a.loop = !!loop;
      return a;
    }

    return {
      init: function () {
        if (ready) return;
        ready = true;
        loops.music = make(files.music, 0.22, true);
        loops.ambience = make(files.ambience, 0.30, true);
        ['bubbles', 'collect', 'click', 'gameover', 'reward'].forEach(function (k) {
          pools[k] = { i: 0, list: [make(files[k], 0.5), make(files[k], 0.5), make(files[k], 0.5)] };
        });
        pools.collect.list.forEach(function (a) { a.volume = 0.45; });
        pools.click.list.forEach(function (a) { a.volume = 0.35; });
        pools.bubbles.list.forEach(function (a) { a.volume = 0.30; });
      },
      /* rate slows or speeds a clip. There is no sting sound in the 2021 set,
         so the jellyfish borrows the bubble clip played low and slow. */
      play: function (k, rate, vol) {
        if (muted || !pools[k]) return;
        var p = pools[k];
        var a = p.list[p.i = (p.i + 1) % p.list.length];
        try {
          a.playbackRate = rate || 1;
          if (vol !== undefined) a.volume = vol;
          a.currentTime = 0;
          a.play().catch(function () {});
        } catch (e) {}
      },
      loop: function (k, on) {
        var a = loops[k];
        if (!a) return;
        if (on && !muted) { a.play().catch(function () {}); }
        else { a.pause(); }
      },
      stopAll: function () {
        Object.keys(loops).forEach(function (k) { loops[k].pause(); });
      },
      remute: function () {
        Object.keys(loops).forEach(function (k) {
          if (muted) loops[k].pause();
          else if (state === 'play' || state === 'title') loops[k].play().catch(function () {});
        });
      }
    };
  }());

  /* ---------------------------------------------------------------- input */

  var input = { x: 0, y: 0 };
  var keys = {};

  function readKeys() {
    var right = keys.ArrowRight || keys.d || keys.D;
    var left = keys.ArrowLeft || keys.a || keys.A;
    var up = keys.ArrowUp || keys.w || keys.W;
    var down = keys.ArrowDown || keys.s || keys.S;
    return {
      x: (right ? 1 : 0) - (left ? 0.6 : 0),
      y: (down ? 1 : 0) - (up ? 1 : 0),
      join: !!(keys[' '] || keys.Shift)
    };
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key.indexOf('Arrow') === 0) e.preventDefault();
    keys[e.key] = true;
    if (e.repeat) return;
    if (e.key === 'p' || e.key === 'P') togglePause();
    if (e.key === 'm' || e.key === 'M') toggleMute();
    if (e.key === 'f' || e.key === 'F') toggleFull();
    if (e.key === 'Escape' && state === 'play') togglePause();
    if (e.key === 'Escape' && state === 'pictures') show('title');
    if (state === 'pictures') {
      if (e.key === 'ArrowRight') showPicture(picAt + 1);
      if (e.key === 'ArrowLeft') showPicture(picAt - 1);
    }
    if (e.key === 'Enter' && (state === 'title' || state === 'over')) startRun();
  });
  window.addEventListener('keyup', function (e) { delete keys[e.key]; });
  window.addEventListener('blur', function () {
    keys = {};
    if (state === 'play') togglePause();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'play') togglePause();
  });

  /* Touch. There is nothing to aim at: put a finger down anywhere on the left
     and that spot becomes the middle of the pad, put one down on the right and
     they hold hands. The drawn pad and button are the promise, not the target. */
  var padTouch = null, joinTouch = null;
  var padHome = { x: 0, y: 0 };
  var padEl = $('pad'), nubEl = $('padNub'), joinEl = $('joinBtn');

  function goTouch() {
    if (touchMode) return;
    touchMode = true;
    app.classList.add('touch');
  }

  app.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') goTouch();
    if (state !== 'play' || !touchMode) return;
    if (e.target.closest('#hud')) return;
    var half = view.cw * 0.55;
    if (e.clientX < half && padTouch === null) {
      padTouch = e.pointerId;
      padHome = { x: e.clientX, y: e.clientY };
      padEl.style.left = e.clientX + 'px';
      padEl.style.top = e.clientY + 'px';
      padEl.classList.add('live');
      movePad(e.clientX, e.clientY);
    } else if (e.clientX >= half && joinTouch === null) {
      joinTouch = e.pointerId;
      joinEl.classList.add('held');
    }
    /* Capture so a thumb that slides off the pad keeps steering. Safari throws
       here if the pointer has already been released, which must not take the
       controls down with it. */
    try { app.setPointerCapture(e.pointerId); } catch (err) { /* fine without it */ }
  });

  app.addEventListener('pointermove', function (e) {
    if (e.pointerId === padTouch) movePad(e.clientX, e.clientY);
  });

  function endPointer(e) {
    if (e.pointerId === padTouch) {
      padTouch = null;
      input.x = 0; input.y = 0;
      padEl.classList.remove('live');
      nubEl.style.transform = 'translate(-50%, -50%)';
    }
    if (e.pointerId === joinTouch) {
      joinTouch = null;
      joinEl.classList.remove('held');
    }
  }
  app.addEventListener('pointerup', endPointer);
  app.addEventListener('pointercancel', endPointer);

  var PAD_R = 62;
  function movePad(cx, cy) {
    var dx = cx - padHome.x, dy = cy - padHome.y;
    var d = Math.hypot(dx, dy);
    if (d > PAD_R) { dx *= PAD_R / d; dy *= PAD_R / d; d = PAD_R; }
    nubEl.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    /* A small dead zone so resting a thumb does not creep. */
    input.x = Math.abs(dx) < 8 ? 0 : Math.max(-1, Math.min(1, dx / (PAD_R * 0.75)));
    input.y = Math.abs(dy) < 8 ? 0 : Math.max(-1, Math.min(1, dy / (PAD_R * 0.75)));
  }

  /* ----------------------------------------------------------------- view */

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var cw = app.clientWidth || window.innerWidth || 0;
    var ch = app.clientHeight || window.innerHeight || 0;
    /* A hidden tab, a display:none parent or an iframe that has not been laid
       out yet all report zero here. Dividing by that turns the whole view, and
       then the divers' position, into NaN, and NaN never washes out again. So
       keep the last good size and wait to be told about a real one. */
    if (cw < 2 || ch < 2) return;
    var scale = ch / World.ART_H;
    if (cw / scale < MIN_VIEW_W) scale = cw / MIN_VIEW_W;

    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    view.cw = cw; view.ch = ch; view.scale = scale;
    view.w = cw / scale;
    view.h = ch / scale;
    view.oy = view.h - World.ART_H;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.imageSmoothingQuality = 'high';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
  /* Embedded in a page, the game can be resized without the window being, so
     watch the element itself as well. This is also what brings it back after it
     has been hidden and shown again. */
  if (window.ResizeObserver) new ResizeObserver(resize).observe(app);

  function playTop() { return Math.max(60, view.oy - REACH_UP); }
  function playBottom() { return view.oy + FLOOR_Y; }
  function riseSpeed() { return Math.max(RISE, (playBottom() - playTop()) / 1.9); }

  /* ------------------------------------------------------------- the dive */

  function newRun() {
    World.reset();
    return {
      scrollX: 0,
      x: view.w * 0.16,
      /* Start in the middle of the water they can actually use, not at a fixed
         depth: on a tall screen that put them down by the sea floor with the
         whole playfield above their heads. */
      y: (playTop() + playBottom()) / 2,
      vx: 0, vy: 0,
      air: 1,
      joined: false,
      boost: 0,
      caught: null,
      frame: 0,
      gobyAt: -99, shrimpAt: -99,
      goby: 0, shrimp: 0, symb: 0,
      t: 0,
      creatures: [],
      nextCreature: 600,
      bubbleSfx: 0,
      teach: null, teachT: 0,
      shake: 0, dread: 0, stun: 0, hurt: 0,
      surfacing: -1, lift: 0, rising: []
    };
  }

  function spawnCreature(kind, wx, y) {
    var top = playTop(), bot = playBottom();
    return {
      kind: kind,
      wx: wx,
      y: Math.max(top + 40, Math.min(bot - 80, y)),
      base: 0,
      bob: Math.random() * 6.283,
      speed: (kind === 'goby' ? 40 : 26) + Math.random() * 40,
      frame: Math.random() * 15
    };
  }

  /* Creatures come in on a distance schedule rather than being topped up the
     instant one is caught, so the reef has quiet stretches. Sometimes a goby
     and a shrimp arrive side by side, which is how they actually live, and is
     the only reliable way to earn a symbiosis bonus. */
  function fillCreatures() {
    while (run.nextCreature < run.scrollX + view.w + 200) {
      if (run.creatures.length >= MAX_ALIVE - 1) break;
      var top = playTop(), bot = playBottom();
      /* Spawn near the divers rather than anywhere in the column. A phone held
         upright has a playfield three times taller than a laptop's, and spread
         evenly across it the creatures became unreachable: the same player got
         a third of the dive out of the same skill. */
      var y = run.y + (Math.random() - 0.5) * SPAWN_SPREAD;
      y = Math.max(top + 60, Math.min(bot - 90, y));
      var wx = run.nextCreature;
      if (Math.random() < PAIR_ODDS) {
        run.creatures.push(spawnCreature('goby', wx, y));
        run.creatures.push(spawnCreature('shrimp', wx + 90 + Math.random() * 130,
                                         y + 60 + Math.random() * 90));
      } else {
        run.creatures.push(spawnCreature(Math.random() < 0.55 ? 'goby' : 'shrimp', wx, y));
      }
      run.nextCreature += 520 + Math.random() * 620;
    }
  }

  /* One coaching line at a time, and only until you have clearly got it. */
  function teach(id, text, force) {
    if (!force && save.taught[id]) return;
    save.taught[id] = true;
    persist();
    run.teach = text;
    run.teachT = 4.2;
    $('coachText').textContent = text;
    $('coach').hidden = false;
  }

  function hideCoach() { $('coach').hidden = true; run.teach = null; }

  /* --------------------------------------------------------------- update */

  function update(dt) {
    run.t += dt;
    if (run.surfacing >= 0) return surface(dt);
    World.setBand(playTop(), playBottom());
    var difficulty = Math.min(1, run.scrollX / RAMP_PX);

    var k = readKeys();
    var wantX = touchMode && padTouch !== null ? input.x : k.x;
    var wantY = touchMode && padTouch !== null ? input.y : k.y;
    var wantJoin = (touchMode && joinTouch !== null) || k.join;

    if (wantJoin !== run.joined) Sound.play('click');
    run.joined = wantJoin;

    /* Forward motion. Thrust fights the current; whatever is left over first
       pushes the pair across the screen and then scrolls the reef. */
    var thrust = Math.max(0, wantX);
    var speed = SWIM;
    if (run.joined) speed *= JOIN_SPEED;
    if (run.boost > 0) speed *= BOOST_MULT;
    if (run.stun > 0) { speed *= 0.4; run.stun -= dt; }

    var inCurtain = World.curtainAt(run.scrollX + run.x + 125);
    var lift = 0;
    if (inCurtain && run.boost <= 0) {
      if (run.joined) {
        speed *= CURTAIN_JOIN;
      } else {
        speed *= CURTAIN_SLOW;
        lift = CURTAIN_LIFT;
        teach('curtain', 'Bubbles! Hold hands to push straight through.');
      }
    } else if (inCurtain && run.boost > 0 && inCurtain.burst <= 0) {
      inCurtain.burst = 0.25;
      World.pop(run.x + 120, run.y + 110, '#ffffff');
    }

    /* Seaweed. It only ever catches the one who is swimming alone, which is
       page fourteen of the book. */
    var weed = World.weedAt(run.scrollX + run.x + 125, run.y + 150);
    if (run.caught) {
      if (run.joined || !weed) {
        run.caught = null;
        hideCoach();
      }
    } else if (weed && !run.joined && run.boost <= 0) {
      run.caught = weed;
      teach('weed', 'Lisa is tangled. Hold hands to pull her free.', true);
      Sound.play('bubbles');
    }
    var target;
    if (run.caught) {
      /* Tangled: held fast by the plant, so the current has nothing to push
         against. You can drag yourself clear slowly, or hold hands and be free
         at once, which is what page fourteen of the book has Bob do. */
      target = thrust * SWIM * 0.16;
    } else {
      target = thrust * speed - CURRENT;
    }
    run.vx += (target - run.vx) * Math.min(1, ACCEL * dt);

    var holdX = Math.min(view.w * 0.40, 520);
    var leftX = Math.max(50, view.w * 0.09);
    var dx = run.vx * dt;
    if (dx > 0) {
      var room = holdX - run.x;
      if (room > 0) { var take = Math.min(room, dx); run.x += take; dx -= take; }
      run.scrollX += dx;
    } else {
      run.x = Math.max(leftX, run.x + dx);
    }

    /* Up and down. */
    var vyTarget = wantY * riseSpeed();
    run.vy += (vyTarget - run.vy) * Math.min(1, ACCEL * dt);
    run.y += run.vy * dt - lift * dt;
    var top = playTop(), bot = playBottom();
    if (run.y < top) { run.y = top; run.vy = Math.max(0, run.vy); }
    if (run.y > bot) { run.y = bot; run.vy = Math.min(0, run.vy); }

    if (run.boost > 0) run.boost -= dt;

    /* The jellyfish. Every other hazard in the game is answered by holding
       hands. This one is not: it has to be swum around, so there is one moment
       in every dive where being together is not the whole answer. */
    var px0 = run.x + 125, py0 = run.y + 115;
    run.dread = World.jellyDread(run.scrollX + px0, JELLY_DREAD);
    if (run.dread > 0.3) teach('jellyNear', 'Something is coming. Give it plenty of room.');
    /* One sting per jellyfish. Being stunned slows you to a crawl, so without
       this the same animal catches you two or three times on the way past and
       a single mistake costs half a tank. */
    var jelly = World.jellyAt(run.scrollX + px0, py0, JELLY_HIT);
    if (jelly && !jelly.spent) {
      jelly.spent = true;
      if (run.boost > 0) {
        /* Riding the shrimp's push, you go straight through it. */
        jelly.hit = 0.3;
        World.pop(px0, py0, '#ffc2f0');
      } else {
        run.air -= JELLY_STING;
        run.stun = STUN_TIME;
        run.hurt = 1;
        run.shake = 1;
        run.vy = 240;
        jelly.hit = 0.4;
        World.pop(px0, py0, '#ff7ad0');
        Sound.play('bubbles', 0.5, 0.5);
        Sound.play('click', 0.55, 0.5);
        teach('jelly', 'That stung. Swim over or under one, holding hands will not help.');
      }
    }
    if (run.hurt > 0) run.hurt -= dt * 0.9;
    if (run.shake > 0) run.shake = Math.max(0, run.shake - dt / 0.6);

    /* Air. */
    var drain = AIR_BASE * (1 + run.scrollX / AIR_SQUEEZE);
    if (thrust > 0.2) drain *= AIR_SWIM;
    if (run.joined) drain *= AIR_JOIN;
    if (inCurtain && !run.joined && run.boost <= 0) drain *= 1.5;
    if (run.caught) drain *= AIR_WEED;
    run.air -= drain * dt;

    if (run.air < 0.42 && !run.joined) {
      teach('share', 'Air is low. Hold hands and Lisa will share hers.');
    }

    if (run.air <= 0) { run.air = 0; return startSurfacing(); }

    /* Creatures. */
    fillCreatures();
    var px = px0, py = py0;
    for (var i = run.creatures.length - 1; i >= 0; i--) {
      var c = run.creatures[i];
      c.wx -= c.speed * dt;
      c.frame += (c.kind === 'goby' ? 12 : 10) * dt;
      c.base += dt;
      var cy = c.y + Math.sin(c.base * 1.3 + c.bob) * 34;
      var cx = c.wx - run.scrollX;
      if (cx < -260) { run.creatures.splice(i, 1); continue; }
      if (Math.hypot(cx + 48 - px, cy + 24 - py) < HIT_R) {
        collect(c, cx + 48, cy + 24);
        run.creatures.splice(i, 1);
      }
    }

    /* Bubble noise, but only every couple of seconds so it stays a texture. */
    run.bubbleSfx -= dt;
    if (inCurtain && run.bubbleSfx <= 0) { Sound.play('bubbles'); run.bubbleSfx = 2.2; }

    World.update(dt, run.scrollX, view.w, difficulty);

    if (run.teach) {
      run.teachT -= dt;
      if (run.teachT <= 0 && !run.caught) hideCoach();
    }

    /* Animation frames. Kicking harder animates faster. */
    run.frame += (14 + thrust * 10) * dt;

    paintHud();
  }

  /* Running out of air does not end anybody. It ends the dive: they take each
     other's hand and go up, which is what a diver actually does and what the
     book has them do, and there is a sunset waiting at the top. */
  function startSurfacing() {
    run.surfacing = 0;
    run.joined = true;
    run.boost = 0;
    run.caught = null;
    run.stun = 0;
    run.dread = 0;
    run.hurt = 0;
    hideCoach();
    Sound.loop('music', false);
    Sound.play('bubbles', 0.85, 0.45);
    $('meter').classList.remove('low');
    $('meter').classList.remove('sharing');
    $('meter').classList.add('up');
    $('meterCaption').textContent = 'Going up together';
  }

  function surface(dt) {
    run.surfacing += dt;
    var k = run.surfacing / SURFACE_TIME;

    /* The two of them barely move on screen. What rises is everything else:
       the reef sinks away underneath and the surface comes down to meet them,
       so you watch them reach the light rather than watch them leave the top
       of the picture. */
    run.lift += (220 + 1250 * k * k) * dt;
    /* Settle them into the upper third of the frame wherever they happened to
       be, so they are never left climbing out behind the air bar. */
    run.y += ((view.h * 0.3 - 90) - run.y) * Math.min(1, dt * 2.2);
    run.vx *= Math.max(0, 1 - dt * 1.6);
    run.scrollX += Math.max(0, run.vx) * dt;
    run.frame += 12 * dt;
    if (run.shake > 0) run.shake = Math.max(0, run.shake - dt / 0.6);
    World.setBand(playTop() + run.lift, playBottom() + run.lift);

    /* A trail of exhaled bubbles, going up faster than they are. */
    if (run.rising.length < 110 && Math.random() < 0.8) {
      run.rising.push({ x: run.x + 40 + Math.random() * 190, y: run.y + 60 + Math.random() * 150,
                        r: 4 + Math.random() * 15, v: 150 + Math.random() * 280 });
    }
    for (var i = run.rising.length - 1; i >= 0; i--) {
      run.rising[i].y -= run.rising[i].v * dt;
      if (run.rising[i].y < -80) run.rising.splice(i, 1);
    }

    World.update(dt, run.scrollX, view.w, 0);
    if (run.surfacing >= SURFACE_TIME) diveOver();
  }

  function collect(c, sx, sy) {
    if (c.kind === 'goby') {
      run.goby++;
      run.gobyAt = run.t;
      run.air = Math.min(1, run.air + AIR_GOBY);
      World.pop(sx, sy, '#ffd166');
      teach('goby', 'The Goby Fish has perfect eyesight. He found you air.');
    } else {
      run.shrimp++;
      run.shrimpAt = run.t;
      run.air = Math.min(1, run.air + AIR_SHRIMP);
      run.boost = BOOST_TIME;
      World.pop(sx, sy, '#ff8fa3');
      teach('shrimp', 'The Shrimp is small but strong. Ride his push.');
    }
    if (Math.abs(run.gobyAt - run.shrimpAt) <= SYMB_WINDOW) {
      run.gobyAt = -99; run.shrimpAt = -99;
      run.symb++;
      run.air = Math.min(1, run.air + AIR_SYMB);
      World.pop(sx, sy, '#7ef0d0');
      Sound.play('reward');
      symbBanner();
    } else {
      Sound.play('collect');
    }
  }

  var symbTimer = 0;
  function symbBanner() {
    var el = $('symb');
    el.hidden = false;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    clearTimeout(symbTimer);
    symbTimer = setTimeout(function () { el.hidden = true; }, 1700);
  }

  /* ---------------------------------------------------------------- paint */

  /* Fill the canvas with one of the two paintings, cropped rather than
     squashed, so a phone held upright does not stretch anybody's face. */
  function cover(name) {
    var im = A.img(name);
    if (!im) return false;
    var s = Math.max(view.w / im.width, view.h / im.height);
    var w = im.width * s, h = im.height * s;
    ctx.drawImage(im, (view.w - w) / 2, (view.h - h) / 2, w, h);
    return true;
  }

  function draw() {
    if (state === 'title' || state === 'how' || state === 'credits'
        || state === 'dedication' || state === 'pictures' || state === 'load') {
      if (cover('splash')) return;
      World.drawWater(ctx, view);
      return;
    }
    if (state === 'over' || state === 'share') {
      if (cover('sunset')) return;
    }
    if (!run) { World.drawWater(ctx, view); return; }

    /* Everything in the water shakes, nothing on the HUD does. Shaking the
       words as well would make them unreadable at exactly the moment you need
       to read them, and it is a fast way to make somebody feel ill. */
    var mag = shakeAmount();
    if (mag > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    var oySave = view.oy;
    if (run.surfacing >= 0) view.oy += run.lift;

    World.drawWater(ctx, view);
    World.drawReef(ctx, view, run.scrollX);
    World.drawSchools(ctx, view, run.scrollX);
    World.drawWeeds(ctx, view, run.scrollX);

    /* Creatures. */
    for (var i = 0; i < run.creatures.length; i++) {
      var c = run.creatures[i];
      var cx = c.wx - run.scrollX;
      if (cx < -200 || cx > view.w + 200) continue;
      var cy = c.y + Math.sin(c.base * 1.3 + c.bob) * 34;
      if (c.kind === 'goby') A.draw(ctx, A.goby, Math.floor(c.frame), cx, cy, 1.15, true);
      else A.draw(ctx, A.shrimp, Math.floor(c.frame), cx, cy, 1.05, true);
    }

    drawDivers();
    World.drawJellies(ctx, view, run.scrollX);
    World.drawCurtains(ctx, view, run.scrollX);
    World.drawProps(ctx, view, run.scrollX);
    World.drawPops(ctx);
    if (run.surfacing >= 0) drawRise();
    view.oy = oySave;
    if (mag > 0) ctx.restore();
    drawFlash();
  }

  /* The rumble grows as a jellyfish closes in, and a sting is a hard jolt on
     top of it. Anyone who has asked for less motion gets neither, and reads the
     danger off the flash and the glow instead. */
  var calmMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shakeAmount() {
    if (calmMotion || !run) return 0;
    return run.dread * SHAKE_DREAD + run.shake * run.shake * SHAKE_STING;
  }

  /* Bubbles trailing the pair on the way up. */
  function drawRise() {
    ctx.save();
    for (var i = 0; i < run.rising.length; i++) {
      var b = run.rising[i];
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#eaf9ff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.stroke();
    }
    ctx.restore();
  }

  /* Two overlays that must not shake with the world: the pink flash of a sting,
     and the light rushing in as they rise into it. */
  function drawFlash() {
    if (run.hurt > 0) {
      var a = Math.min(0.34, run.hurt * 0.34);
      var g = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.52,
                                       view.w / 2, view.h / 2, view.h * 1.05);
      g.addColorStop(0, 'rgba(255,60,170,0)');
      g.addColorStop(1, 'rgba(255,60,170,' + a.toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (run.surfacing >= 0) {
      var k = Math.min(1, run.surfacing / SURFACE_TIME);
      ctx.fillStyle = 'rgba(214,244,255,' + (k * k * 0.34).toFixed(3) + ')';
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  /* Bob and Lisa. Apart they are two sprites with Bob above and Lisa trailing
     below and behind; together they are a single drawing of the pair with their
     hands joined, which is the image the whole book is built around. */
  function drawDivers() {
    var f = Math.floor(run.frame);
    var x = run.x, y = run.y;

    /* The shrimp's push: streaks off the back and a soft glow, rather than a
       flat blob behind them. It has to read as speed at a glance. */
    if (run.boost > 0) {
      var k = Math.min(1, run.boost / BOOST_TIME);
      ctx.save();
      var g = ctx.createRadialGradient(x + 125, y + 115, 20, x + 125, y + 115, 165);
      g.addColorStop(0, 'rgba(255,163,186,' + (0.34 * k).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,163,186,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 60, y - 60, 380, 360);
      ctx.strokeStyle = 'rgba(255,235,240,' + (0.7 * k).toFixed(3) + ')';
      ctx.lineCap = 'round';
      for (var i = 0; i < 7; i++) {
        var sy = y + 20 + i * 30 + Math.sin(run.t * 14 + i) * 5;
        var len = 60 + ((i * 53 + Math.floor(run.t * 240)) % 90);
        ctx.lineWidth = 2 + (i % 3);
        ctx.beginPath();
        ctx.moveTo(x - 20 - len, sy);
        ctx.lineTo(x + 20, sy);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (run.surfacing >= 0) {
      var tilt = -0.42 * Math.min(1, run.surfacing / 0.7);
      ctx.save();
      ctx.translate(x + 125, y + 115);
      ctx.rotate(tilt);
      A.draw(ctx, A.pair, f, -125, -115, 0.8);
      ctx.restore();
    } else if (run.joined) {
      A.draw(ctx, A.pair, f, x, y, 0.8);
    } else {
      A.draw(ctx, A.lisa, f, x + 35, y + 120, 0.81);
      A.draw(ctx, A.bob, f, x, y - 10, 0.8);
    }

    if (run.caught) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(run.t * 9) * 0.25;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x + 125, y + 130, 120, 0, 6.283);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ HUD */

  var lastMetres = -1;
  function paintHud() {
    var m = Math.floor(run.scrollX / PX_PER_M);
    if (m !== lastMetres) { $('score').textContent = m; lastMetres = m; }
    var pct = Math.max(0, run.air) * 100;
    $('airFill').style.width = pct + '%';
    $('airShare').style.opacity = run.joined ? '1' : '0';
    var meter = $('meter');
    meter.classList.toggle('low', run.air < 0.3);
    meter.classList.toggle('sharing', run.joined);
    $('meterCaption').textContent = run.joined ? 'Lisa is sharing her air'
      : run.air < 0.3 ? 'Air is getting low' : 'Air';
  }

  /* --------------------------------------------------------------- screens */

  function show(name) {
    state = name;
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== name; });
    var inGame = name === 'play';
    overlay.hidden = inGame;
    hud.hidden = name === 'load';
    hud.classList.toggle('menu', !inGame);
    app.classList.toggle('playing', inGame);
    if (!inGame) hideCoachSafe();
  }

  function hideCoachSafe() { $('coach').hidden = true; }

  function startRun() {
    Sound.init();
    Sound.play('click');
    lastMetres = -1;
    run = newRun();
    fillCreatures();
    show('play');
    Sound.loop('ambience', true);
    Sound.loop('music', true);
    teach('start', 'Hold right to swim. Watch Bob\'s air.', true);
    last = performance.now();
  }

  function diveOver() {
    Sound.stopAll();
    Sound.play('gameover', 1, 0.4);
    var m = Math.floor(run.scrollX / PX_PER_M);
    var record = m > save.best;
    if (record) { save.best = m; persist(); }
    $('finalScore').textContent = m;
    $('overKicker').textContent = run.symb > 0
      ? 'You surfaced together, and you found symbiosis'
      : 'Air ran low, so up you went';
    var fb = $('finalBest');
    fb.textContent = record ? 'A new deepest dive!' : 'Your best is ' + save.best + ' m';
    fb.classList.toggle('record', record);
    $('tallyGoby').textContent = run.goby;
    $('tallyShrimp').textContent = run.shrimp;
    $('tallySymb').textContent = run.symb;
    $('best').textContent = save.best;
    $('meter').classList.remove('up');
    show('over');
  }

  function toMenu() {
    Sound.stopAll();
    run = null;
    show('title');
    refreshTitle();
  }

  function refreshTitle() {
    var tb = $('titleBest');
    if (save.best > 0) {
      tb.hidden = false;
      tb.querySelector('strong').textContent = save.best;
    } else {
      tb.hidden = true;
    }
    $('titleHint').textContent = touchMode
      ? 'Drag on the left to swim. Hold the button on the right to hold hands.'
      : 'Arrow keys to swim. Hold Space to hold hands.';
    $('best').textContent = save.best;
  }

  function togglePause() {
    if (state === 'play') {
      show('pause');
      Sound.loop('music', false);
      Sound.loop('ambience', false);
    } else if (state === 'pause') {
      show('play');
      Sound.loop('music', true);
      Sound.loop('ambience', true);
      last = performance.now();
    }
  }

  function toggleMute() {
    muted = !muted;
    persist();
    $('btnSound').setAttribute('aria-pressed', muted ? 'true' : 'false');
    $('btnSound').setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound');
    Sound.remute();
    toast(muted ? 'Sound off' : 'Sound on');
  }

  function toggleFull() {
    var d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      (app.requestFullscreen || app.webkitRequestFullscreen || function () {}).call(app);
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
    }
  }

  var toastTimer = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1500);
  }

  /* -------------------------------------------------------------- gallery */

  /* Franjo painted these and until now you only ever saw them blurred behind a
     menu. Both are already loaded and in the offline cache, so the gallery
     costs nothing and works on a plane. */
  var PICTURES = [
    { src: 'assets/img/splash.webp',
      title: 'A Deep Dive into Friendship',
      note: 'Bob and Lisa in the heart of the reef, with the Goby Fish and the Candy Cane Shrimp keeping house below them.' },
    { src: 'assets/img/sunset.webp',
      title: 'After the dive',
      note: 'The two of them back above the water, at the end of the story.' }
  ];
  var picAt = 0;
  var galDots = $('galDots');

  PICTURES.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gal-dot';
    b.setAttribute('aria-label', 'Picture ' + (i + 1) + ': ' + p.title);
    b.addEventListener('click', function () { showPicture(i); });
    galDots.appendChild(b);
  });

  function showPicture(i) {
    picAt = (i % PICTURES.length + PICTURES.length) % PICTURES.length;
    var p = PICTURES[picAt];
    var img = $('galleryImg');
    img.src = p.src;
    img.alt = p.title;
    $('galTitle').textContent = p.title;
    $('galNote').textContent = p.note;
    for (var k = 0; k < galDots.children.length; k++) {
      galDots.children[k].classList.toggle('on', k === picAt);
    }
  }

  /* Swipe. A short flick counts; a slow drag down the page does not. */
  var swipeFrom = null;
  var gal = $('gallery');
  gal.addEventListener('pointerdown', function (e) { swipeFrom = e.clientX; });
  gal.addEventListener('pointercancel', function () { swipeFrom = null; });
  gal.addEventListener('pointerup', function (e) {
    if (swipeFrom === null) return;
    var dx = e.clientX - swipeFrom;
    swipeFrom = null;
    if (Math.abs(dx) > 40) showPicture(picAt + (dx < 0 ? 1 : -1));
  });

  /* ---------------------------------------------------------------- wiring */

  $('btnPlay').addEventListener('click', startRun);
  $('btnHowPlay').addEventListener('click', startRun);
  $('btnAgain').addEventListener('click', startRun);
  $('btnHow').addEventListener('click', function () { Sound.init(); Sound.play('click'); show('how'); });
  $('btnHowBack').addEventListener('click', function () { Sound.play('click'); show('title'); });
  $('btnCredits').addEventListener('click', function () { Sound.init(); Sound.play('click'); show('credits'); });
  $('btnCreditsBack').addEventListener('click', function () { Sound.play('click'); show('title'); });
  $('btnDedication').addEventListener('click', function () { Sound.init(); Sound.play('click'); show('dedication'); });
  $('btnDedBack').addEventListener('click', function () { Sound.play('click'); show('title'); });
  $('btnPictures').addEventListener('click', function () {
    Sound.init(); Sound.play('click'); showPicture(0); show('pictures');
  });
  $('btnPicBack').addEventListener('click', function () { Sound.play('click'); show('title'); });
  $('btnPicPrev').addEventListener('click', function () { Sound.play('click'); showPicture(picAt - 1); });
  $('btnPicNext').addEventListener('click', function () { Sound.play('click'); showPicture(picAt + 1); });
  $('btnResume').addEventListener('click', togglePause);
  $('btnQuit').addEventListener('click', toMenu);
  $('btnMenu').addEventListener('click', toMenu);
  $('btnPause').addEventListener('click', togglePause);
  $('btnSound').addEventListener('click', toggleMute);
  $('btnFull').addEventListener('click', toggleFull);

  function copyPanel(line) {
    $('shareText').value = line + ' ' + GAMES_URL;
    show('share');
  }

  /* The share sheet is the nice version, but it is not always allowed to open.
     Embedded in a page, the browser only grants it if that page's iframe says
     allow="web-share", and a rejected share used to be swallowed by an empty
     catch, so the button looked broken. Anything other than the reader closing
     the sheet themselves now falls back to the box they can copy from. */
  $('btnShare').addEventListener('click', function () {
    var m = $('finalScore').textContent;
    var line = 'I dived ' + m + ' m with Big Head Bob and Long Neck Lisa.';
    var handled = false;
    if (navigator.share) {
      try {
        navigator.share({ title: 'Deep Dive', text: line, url: GAMES_URL })
          .then(null, function (err) {
            if (!err || err.name !== 'AbortError') copyPanel(line);
          });
        handled = true;
      } catch (e) { handled = false; }
    }
    if (!handled) copyPanel(line);
  });
  $('btnShareBack').addEventListener('click', function () { show('over'); });
  /* Same story for the clipboard: navigator.clipboard is blocked inside an
     iframe unless the page allows it, and the old code neither noticed nor said
     so. Fall back to the ancient execCommand, which iframes still permit, and
     if even that fails at least tell the reader to copy it by hand. */
  $('btnShareCopy').addEventListener('click', function () {
    var box = $('shareText');
    box.removeAttribute('readonly');        // iOS will not select a readonly field
    box.focus();
    box.setSelectionRange(0, box.value.length);

    function legacy() {
      try { return document.execCommand('copy'); } catch (e) { return false; }
    }
    function done(ok) {
      box.setAttribute('readonly', 'readonly');
      toast(ok ? 'Copied' : 'Select the text above to copy it');
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(box.value).then(
        function () { done(true); },
        function () { done(legacy()); }
      );
    } else {
      done(legacy());
    }
  });

  /* --------------------------------------------------------------- the loop */

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    /* The water keeps moving on the menus too, so the game never looks frozen
       behind a panel. Only the dive itself stops when you pause. */
    World.t += dt;
    if (state === 'play' && run) update(dt);
    draw();
  }

  /* ------------------------------------------------------------------ boot */

  resize();
  if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) goTouch();

  $('btnSound').setAttribute('aria-pressed', muted ? 'true' : 'false');

  World.reset();
  A.load(function (p) { $('loadBar').style.width = Math.round(p * 100) + '%'; }).then(function () {
    toMenu();
    last = performance.now();
    requestAnimationFrame(frame);
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

}());
