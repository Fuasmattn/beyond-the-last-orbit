import { Container, Graphics } from 'pixi.js';
import { FIELD_W } from '../data/balance';
import type { WorldId } from '../data/worlds';

export interface Backdrop {
  readonly root: Container;
  update(dt: number): void;
}

function drifter(g: Graphics, speed: number, wrap: number): (dt: number) => void {
  return (dt) => {
    g.x += speed * dt;
    if (g.x > wrap) g.x -= wrap + 40;
    if (g.x < -40) g.x += wrap + 40;
  };
}

/** Earth's curve along the bottom with a cyan atmosphere, sunrise rim and drifting satellites. */
function earth(): Backdrop {
  const root = new Container();
  const planet = new Graphics()
    .circle(120, 560, 302)
    .fill(0x4af2ff)
    .circle(120, 560, 300)
    .fill(0x0b2a66)
    .ellipse(70, 280, 34, 8)
    .fill(0x1f6b3a)
    .ellipse(170, 290, 26, 6)
    .fill(0x1f6b3a)
    .ellipse(120, 305, 40, 7)
    .fill(0x1a5c33);
  planet.alpha = 0.85;
  const sunrise = new Graphics()
    .arc(120, 560, 303, Math.PI * 1.3, Math.PI * 1.44)
    .stroke({ color: 0xffa040, width: 2, alpha: 0.8 });
  const satA = new Graphics().rect(0, 0, 5, 1).fill(0x7fa8ff).rect(2, -1, 1, 3).fill(0xc8ccd6);
  satA.position.set(20, 190);
  const satB = new Graphics().rect(0, 0, 3, 1).fill(0x7fa8ff);
  satB.position.set(180, 215);
  root.addChild(planet, sunrise, satA, satB);
  const moveA = drifter(satA, 6, FIELD_W);
  const moveB = drifter(satB, -4, FIELD_W);
  return {
    root,
    update(dt) {
      moveA(dt);
      moveB(dt);
    },
  };
}

/** Cratered lunar surface scrolling below, small Earth in the distance. */
function moon(): Backdrop {
  const root = new Container();
  const earthDot = new Graphics().circle(206, 44, 9).fill(0x1d4fa3).ellipse(203, 42, 4, 2).fill(0x2f8f4e);
  const ground = new Graphics().rect(0, 292, FIELD_W, 28).fill(0x2e3138).rect(0, 292, FIELD_W, 1).fill(0x6b7080);
  const craters = new Container();
  for (let copy = 0; copy < 2; copy++) {
    const g = new Graphics();
    for (const [x, y, r] of [
      [20, 302, 6],
      [70, 310, 4],
      [110, 299, 3],
      [150, 308, 7],
      [205, 301, 4],
    ] as const) {
      g.ellipse(x, y, r, r * 0.45).fill(0x1d1f24);
    }
    g.x = copy * FIELD_W;
    craters.addChild(g);
  }
  root.addChild(earthDot, ground, craters);
  root.alpha = 0.9;
  return {
    root,
    update(dt) {
      craters.x -= 10 * dt;
      if (craters.x <= -FIELD_W) craters.x += FIELD_W;
    },
  };
}

/** Rust-red Mars with drifting dust-storm bands and Phobos passing overhead. */
function mars(): Backdrop {
  const root = new Container();
  const planet = new Graphics().circle(200, 340, 140).fill(0x8a2f1a).circle(200, 340, 140).stroke({ color: 0xff7a3d, width: 1, alpha: 0.6 });
  planet.alpha = 0.8;
  const storms = new Graphics()
    .ellipse(170, 230, 50, 3)
    .fill({ color: 0xb5502a, alpha: 0.6 })
    .ellipse(210, 250, 40, 2)
    .fill({ color: 0xd06a3a, alpha: 0.5 })
    .ellipse(150, 270, 30, 2)
    .fill({ color: 0xb5502a, alpha: 0.5 });
  const phobos = new Graphics().ellipse(0, 0, 5, 3).fill(0x8c8077).ellipse(-1, -1, 1, 1).fill(0x5c524b);
  phobos.position.set(-20, 70);
  root.addChild(planet, storms, phobos);
  const movePhobos = drifter(phobos, 5, FIELD_W);
  let t = 0;
  return {
    root,
    update(dt) {
      t += dt;
      storms.x = Math.sin(t * 0.2) * 12;
      movePhobos(dt);
    },
  };
}

export function createBackdrop(world: WorldId): Backdrop {
  switch (world) {
    case 'earth':
      return earth();
    case 'moon':
      return moon();
    case 'mars':
      return mars();
  }
}
