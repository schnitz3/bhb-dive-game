# Deep Dive with Big Head Bob and Long Neck Lisa

Bob's air runs out fast and Lisa can share hers. Hold hands to breathe together,
follow the Goby Fish and the Candy Cane Shrimp, and see how far the two of you
get. Works on phones in either orientation, on tablets and on desktop, installs
as an app, and plays offline once it has loaded.

**Nobody gets far down there alone.**

---

## Where the rules come from

This is book two, *A Deep Dive into Friendship*, turned into a game. Every rule
is a page from the story rather than a mechanic bolted on afterwards.

| In the book | In the game |
|---|---|
| Bob's air warning goes off and Lisa shares hers | The air bar drains three times slower while you hold hands |
| The Goby Fish has perfect eyesight | Catching one refills a fifth of your air |
| The Candy Cane Shrimp is nearly blind but strong | Catching one gives a burst that smashes through anything |
| The two of them live in symbiosis | Catch one of each within five seconds for the big bonus |
| Lisa gets tangled in the seaweed and Bob helps | Seaweed only holds whoever is swimming alone |

A player who never touches the join button lasts around forty seconds. A player
who holds hands lasts two to three times as long and gets two to three times as
far. That gap is the whole point, and it is the number the game is tuned around.

---

## Putting it on GitHub Pages

There is nothing to build. The folder is the site.

1. On GitHub, create a new empty **public** repository called `bhb-dive-game`.
   Do not add a README or a licence, or the first push will be rejected.
2. Open GitHub Desktop, add this folder, and publish it to that repository.
3. In the new repository go to **Settings > Pages**, set **Source** to
   *Deploy from a branch*, choose branch `main` and folder `/ (root)`, and save.
4. Give it a minute. The game is then live at:

```
https://schnitz3.github.io/bhb-dive-game/
```

Every path in here is relative and this has been checked from a subfolder, so
the project-site URL works as-is.

### Putting it on the Shopify site

bigheadbob.com runs on Shopify, whose page editor keeps `<iframe>` but strips
`<style>` blocks, so the styling has to sit inline on the element itself. Add a
page, open the body's HTML view with the `<>` button, and paste this in:

```html
<iframe src="https://schnitz3.github.io/bhb-dive-game/"
        title="Deep Dive with Big Head Bob and Long Neck Lisa"
        allow="fullscreen; autoplay"
        allowfullscreen
        style="display:block; width:100%; height:78vh; min-height:520px; border:0; border-radius:16px; background:#0b2a72; margin:0 auto; max-width:1100px;"></iframe>
```

`allowfullscreen` is what makes the full-screen button work. Without it the game
still plays, that one button just does nothing.

If a visitor would rather play it full-bleed, link them straight to
`https://schnitz3.github.io/bhb-dive-game/`.

### Shipping a change

Edit, commit, push. One thing to remember: the service worker caches the art and
audio, so if you **rename, add or delete** a file in `assets/`, bump the version
string at the top of `sw.js` (`bhb-dive-v1` becomes `bhb-dive-v2`, and so on) in
the same commit. Changes to HTML, CSS and JavaScript reach players without that,
because those are fetched from the network first.

If you ever move the game to a different URL, update `og:url` and `og:image` in
`index.html` too, since a share card needs an absolute address.

---

## Controls

- **Touch**: drag anywhere on the left of the screen to swim, hold anywhere on
  the right to hold hands. The pad and the button are drawn where a thumb
  naturally falls, but there is nothing to aim at: wherever you press becomes
  the middle of the pad.
- **Keyboard**: arrow keys or `W` `A` `S` `D` to swim, hold `Space` to hold
  hands. `P` pauses, `M` mutes, `F` goes full screen.

## Tuning

Everything sits in the block at the top of `js/game.js`.

| Constant | What it does |
|---|---|
| `SWIM` / `CURRENT` | how hard you push, and how hard the sea pushes back |
| `RISE` / `ACCEL` | up and down speed, and how quickly you get there |
| `JOIN_SPEED` | how much slower you are while holding hands |
| `BOOST_MULT` / `BOOST_TIME` | the shrimp's push and how long it lasts |
| `AIR_BASE` | air lost a second at the start of a dive |
| `AIR_SQUEEZE` | how fast that rises with distance, which is what ends a dive |
| `AIR_JOIN` | how much less air you use while Lisa is sharing |
| `AIR_GOBY` / `AIR_SHRIMP` / `AIR_SYMB` | what each catch gives back |
| `SYMB_WINDOW` | seconds between the two catches to count as symbiosis |
| `CURTAIN_SLOW` / `CURTAIN_JOIN` | how much bubbles cost you, apart and together |
| `SPAWN_SPREAD` | how far above or below you a creature can appear |
| `PX_PER_M` | world pixels to a metre on the scoreboard |
| `MIN_VIEW_W` | the least world the game will ever show across |

Two of those are load-bearing and easy to break:

- `CURTAIN_SLOW` must stay above about `CURRENT / SWIM`, which is 0.46. Below
  that a bubble curtain pushes you backwards faster than you can swim, and a
  player who has not worked out the join button is pinned against it for ever
  with no way to learn.
- `AIR_SQUEEZE` is the only thing that ends a good player's dive. With the drain
  capped instead of climbing, a player who has understood the game simply never
  runs out and there is nothing to beat.

## How it fits any screen

The reef paintings are 1280 by 720, the shape of the screen the 2021 game was
drawn for. A phone held upright is nothing like that shape. Rather than
letterbox the art into a stripe, the world is stood on the sea floor and the
water carries on upward: gradient, light shafts, drifting plankton, distant
schools of fish, and the surface itself if there is room. That water is not
filler. It is where the up and down dodging happens, and on a tall screen it is
most of the playfield.

Two things follow from that, and both are deliberate:

- The far reef is drawn larger on a tall screen so its pillars climb into the
  open water. It is scenery, so growing it changes nothing you can swim into.
- Creatures appear within a fixed distance of the divers rather than anywhere in
  the column, so the same skill earns the same dive whatever shape the screen
  is. Spread evenly, a phone held upright gave a third of the dive.

## What's in here

```
index.html      shell, menus and HUD (real DOM, so text stays crisp)
styles.css      layout for portrait, landscape, tablet and desktop
js/atlas.js     the sprite sheets and where every frame of them lives
js/world.js     the ocean: water, light, reef, seaweed, bubble curtains
js/game.js      air, movement, input and game flow
sw.js           offline cache
assets/img/     the 2021 art, converted to WebP
assets/audio/   music, ambience and sound effects, converted to AAC
assets/fonts/   OpenDyslexic
```

### Where the art came from

Every drawing is Franjo Setrov's from the 2021 CreateJS build, unchanged. The
sheets were cropped to the frames actually in use and re-encoded as WebP, which
took the art from 10 MB to 1.7 MB, and the audio was re-encoded as AAC, which
took it from 14 MB to 2.2 MB. The whole game is now about 4.5 MB rather than 29,
which on a school tablet is the difference between a few seconds and half a
minute of staring at a loading bar.

Four things from the original are gone because they are now drawn in code, and
look better for it: the eight-file light-shimmer sheet, the bubble-column sheet,
the exhale-bubble sheet, and the button sheet. Between them they were 2.5 MB.

## Running it locally

```bash
python3 tools/serve.py 8830
```

Use that rather than `python3 -m http.server`. The stdlib server sends no cache
headers at all, so browsers fall back to heuristic caching and quietly keep
serving an old copy of the game: edits then look like they did nothing, and
clearing the service worker does not help, because the stale copy is in the
browser's HTTP cache, a different layer.

## Browser support

Any current browser: Safari (iOS 14+), Chrome, Firefox, Edge, Samsung Internet.
The art is WebP, which is where the iOS 14 floor comes from. No build step, no
dependencies, no framework, and nothing loaded from anyone else's server. About
60 KB of code.

## Credits

Story and characters by David Bradley. Art and animation by Franjo Setrov. The
original 2021 dive game by Tim Anderson, whose design this rebuild follows: the
current that pushes back, the join button, and the two creatures are all his.
