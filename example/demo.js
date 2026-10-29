const byId = id => document.getElementById(id);
const scene = document.querySelector('a-scene');

const GREY = '#888';
const GREEN = '#3c3';
const WHITE = '#fff';
const LABEL_WIDTH = 1.6;
const LABEL_PADDING = 0.08;
const SPHERE_GAP = 0.2;
const WALL_MARGIN = 0.05;
const SMALL = 0.4;

// Wall meshes the labels must stay in front of; refreshed after every build.
let walls = [];
scene.addEventListener('room-building-complete', () => {
  walls = [...document.querySelectorAll('.collidable')].flatMap(el => Object.values(el.object3DMap).filter(o => o.isMesh));
});

// Faces the camera and keeps its label on whichever side of the sphere has room before the nearest wall,
// shrinking it when neither side does. Unpinned labels stay small until their sphere is hovered.
AFRAME.registerComponent('check-marker', {
  schema: { label: { type: 'string' }, pinned: { default: false } },

  init () {
    this.hovered = false;
    this.scale = this.data.pinned ? 1 : SMALL;
    this.ray = new THREE.Raycaster();
    this.origin = new THREE.Vector3();
    this.right = new THREE.Vector3();

    // The text's own plane is hidden and only measures the wrapped text; the background is a padded
    // plane behind it, stretched to that height every frame. The plane's mesh is hidden rather than
    // its material: until the font loads its height is NaN, and the renderer would still cull it.
    this.pivot = document.createElement('a-entity');
    this.plane = document.createElement('a-entity');
    this.plane.setAttribute('position', `${LABEL_WIDTH / 2} 0 0`);
    this.text = document.createElement('a-entity');
    this.text.setAttribute('geometry', `primitive: plane; width: ${LABEL_WIDTH - 2 * LABEL_PADDING}; height: auto`);
    this.text.addEventListener('loaded', () => {
      this.text.getObject3D('mesh').visible = false;
    });
    this.background = document.createElement('a-entity');
    this.background.setAttribute('position', '0 0 -0.002');
    this.background.setAttribute('geometry', `primitive: plane; width: ${LABEL_WIDTH}; height: 1`);
    this.background.setAttribute('material', 'color: #000; opacity: 0.75; transparent: true; shader: flat');
    this.plane.append(this.background, this.text);
    this.pivot.appendChild(this.plane);
    this.el.appendChild(this.pivot);
  },

  update () {
    this.text.setAttribute('text', {
      value: this.data.label, color: WHITE, width: LABEL_WIDTH - 2 * LABEL_PADDING, wrapCount: 26, align: 'left'
    });
  },

  freeDistance (direction) {
    this.ray.set(this.origin, direction);
    const hit = this.ray.intersectObjects(walls, false)[0];
    if (!hit) return Infinity;
    return hit.distance - WALL_MARGIN;
  },

  fitBackground () {
    const textHeight = this.text.getObject3D('mesh')?.geometry.parameters.height ?? 0;
    this.background.object3D.scale.y = textHeight + 2 * LABEL_PADDING;
  },

  tick (time, delta) {
    const object = this.el.object3D;
    this.el.sceneEl.camera.getWorldQuaternion(object.quaternion);
    object.getWorldPosition(this.origin);
    this.right.set(1, 0, 0).applyQuaternion(object.quaternion);

    const target = this.hovered || this.data.pinned ? 1 : SMALL;
    this.scale += (target - this.scale) * Math.min(1, delta * 0.015);

    const rightRoom = this.freeDistance(this.right);
    const leftRoom = this.freeDistance(this.right.negate());
    const side = rightRoom >= leftRoom ? 1 : -1;
    const room = Math.max(rightRoom, leftRoom) - SPHERE_GAP;
    const scale = Math.max(0.1, Math.min(this.scale, room / LABEL_WIDTH));

    this.pivot.object3D.position.x = side * SPHERE_GAP;
    this.pivot.object3D.scale.set(side * scale, scale, scale);
    // Mirroring the pivot would mirror the text, so flip the plane back.
    this.plane.object3D.scale.x = side;
    this.fitBackground();
  }
});

const addMarker = ({ position, label, color, pinned = false }) => {
  const marker = document.createElement('a-entity');
  marker.setAttribute('position', position);
  marker.setAttribute('check-marker', { label, pinned });
  const sphere = document.createElement('a-sphere');
  sphere.setAttribute('radius', '0.12');
  sphere.setAttribute('color', color);
  marker.appendChild(sphere);
  scene.appendChild(marker);
  return { marker, sphere };
};

// A grey sphere the cursor can click; its label grows while hovered.
const addClickable = ({ position, label, color }) => {
  const { marker, sphere } = addMarker({ position, label, color });
  sphere.classList.add('check');
  sphere.addEventListener('mouseenter', () => {
    marker.components['check-marker'].hovered = true;
  });
  sphere.addEventListener('mouseleave', () => {
    marker.components['check-marker'].hovered = false;
  });
  return { marker, sphere };
};

// Runs its action on click and stays green while the change is on. onLabel, if given, replaces the label
// while it is on.
const addToggle = ({ position, label, onLabel = label, action, on = false }) => {
  const labelFor = state => state ? onLabel : label;
  const colorFor = state => state ? GREEN : GREY;
  const { marker, sphere } = addClickable({ position, label: labelFor(on), color: colorFor(on) });
  sphere.addEventListener('click', () => {
    on = !on;
    action(on);
    sphere.setAttribute('color', colorFor(on));
    marker.setAttribute('check-marker', 'label', labelFor(on));
  });
};

// Runs a one-off action on click and flashes green.
const addAction = ({ position, label, action }) => {
  const { sphere } = addClickable({ position, label, color: GREY });
  sphere.addEventListener('click', () => {
    action();
    sphere.setAttribute('color', GREEN);
    setTimeout(() => {
      sphere.setAttribute('color', GREY);
    }, 600);
  });
};

// A white sphere whose full-size label says what to look at.
const addInfo = ({ position, label }) => addMarker({ position, label, color: WHITE, pinned: true });

// Scenery: a sky that fades from deep blue overhead to near white at the horizon, grass with a line
// every meter, and a few puffy clouds.
const SKY_TOP = '#1E64C8';
const SKY_HORIZON = '#EAF6FF';
const GRASS = '#43A047';
const GRID_LINE = '#81C784';
const GROUND_SIZE = 100;
const TILE_PIXELS = 64;

// A-Frame caches textures by their source's id, so each canvas needs its own.
const paint = ({ id, width, height, draw }) => {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'));
  return canvas;
};

// The texture wraps the sky sphere top to bottom, so its upper half runs from the zenith to the horizon.
const skyTexture = paint({
  id: 'skyTexture',
  width: 4,
  height: 256,
  draw: (context) => {
    const gradient = context.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, SKY_TOP);
    gradient.addColorStop(1, SKY_HORIZON);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 128);
    context.fillStyle = SKY_HORIZON;
    context.fillRect(0, 128, 4, 128);
  }
});
byId('sky').setAttribute('material', { shader: 'flat', src: skyTexture });

// One tile per square meter; neighboring tiles' edges meet to draw each grid line.
const gridTexture = paint({
  id: 'gridTexture',
  width: TILE_PIXELS,
  height: TILE_PIXELS,
  draw: (context) => {
    context.fillStyle = GRASS;
    context.fillRect(0, 0, TILE_PIXELS, TILE_PIXELS);
    context.strokeStyle = GRID_LINE;
    context.lineWidth = 4;
    context.strokeRect(0, 0, TILE_PIXELS, TILE_PIXELS);
  }
});
// Unlit, so the grass keeps its painted color and doesn't catch a glare from the lights.
byId('ground').setAttribute('material', { shader: 'flat', src: gridTexture, repeat: `${GROUND_SIZE} ${GROUND_SIZE}` });

// Each cloud is a few low-poly spheres squashed into a puff.
const CLOUDS = [
  { position: '-35 24 -45', scale: 4 },
  { position: '10 28 -55', scale: 5 },
  { position: '45 22 -20', scale: 3.5 },
  { position: '40 26 35', scale: 4.5 },
  { position: '-45 20 25', scale: 4 },
  { position: '-10 30 50', scale: 3 }
];
const PUFFS = [
  { offset: '0 0 0', radius: 1 },
  { offset: '1.2 -0.2 0.3', radius: 0.8 },
  { offset: '-1.1 -0.25 -0.2', radius: 0.75 },
  { offset: '0.4 0.5 -0.3', radius: 0.7 }
];
for (const { position, scale } of CLOUDS) {
  const cloud = document.createElement('a-entity');
  cloud.setAttribute('position', position);
  cloud.setAttribute('scale', `${scale} ${scale * 0.6} ${scale}`);
  for (const { offset, radius } of PUFFS) {
    const puff = document.createElement('a-sphere');
    puff.setAttribute('position', offset);
    puff.setAttribute('radius', radius);
    puff.setAttribute('segments-width', 10);
    puff.setAttribute('segments-height', 8);
    // Mostly self-lit, so the undersides stay bright instead of turning grey.
    puff.setAttribute('material', { color: WHITE, emissive: WHITE, emissiveIntensity: 0.7 });
    cloud.appendChild(puff);
  }
  scene.appendChild(cloud);
}

const signText = value => ({ value, color: WHITE, width: 1.75, wrapCount: 42, align: 'left' });
byId('signAbout').setAttribute('text', signText([
  'aframe-room-component',
  '',
  'Build rooms and buildings in A-Frame by writing HTML. Place the walls, cut doors and windows, '
  + 'and connect rooms to each other. Floors, ceilings and passages are generated for you and '
  + 'stay in step as the scene changes.',
  '',
  'Everything here is built with it.'
].join('\n')));
byId('signHelp').setAttribute('text', signText([
  'Using this page',
  '',
  'Walk with WASD or the arrow keys, click and drag to look.',
  'Grey sphere: click to make the change it names. It turns green; click again to undo.',
  'White sphere: read about what is in front of you.',
  '',
  'Inspector (Ctrl+Alt+I): select #yellowBackWall, the yellow room\'s back wall, and drag it. '
  + 'The room should rebuild as you drag.'
].join('\n')));

addToggle({
  position: '-0.4 1.2 10.4',
  label: 'Enable wall collision',
  onLabel: 'Disable wall collision',
  on: true,
  action: (on) => {
    if (on) byId('player').setAttribute('room-collision', '');
    else byId('player').removeAttribute('room-collision');
  }
});

// Red building, outside.
addInfo({
  position: '6 2 0.8',
  label: '<a-room outside="true">: the walls face out, so the room is the outside of a building.'
});
addInfo({
  position: '-3 2.6 0.6',
  label: '<a-portal> joins two <a-opening>s. This one is a 2m deep door lined with <a-floor>, '
    + '<a-ceiling> and <a-sides>.'
});
addInfo({
  position: '3 2.3 0.6',
  label: '<a-portal floor-height="0.9"> makes a window. room-collision stops you at torso height.'
});

// Yellow room.
addInfo({
  position: '-4.2 2.4 -2.6',
  label: '<a-wall position>: each wall starts at its corner and runs to the next wall\'s corner.'
});
addToggle({
  position: '-1.5 2.2 -6.4',
  label: 'Push back wall 2m',
  action: (on) => {
    for (const id of ['yellowBackWall', 'yellowRightWall']) byId(id).object3D.position.z = on ? -9 : -7;
  }
});
addToggle({
  position: '-5.4 1.2 -6.4',
  label: 'Raise corner 1m',
  action: (on) => {
    const height = on ? 4 : 0;
    byId('yellowBackWall').setAttribute('wall', 'height', height);
  }
});
addToggle({
  position: '-3 0.35 -4.5',
  label: 'Halve floor tiles',
  action: (on) => {
    const uvScale = on ? 2 : 1;
    byId('yellowFloor').setAttribute('floor', 'uvScale', uvScale);
  }
});
addToggle({
  position: '-0.6 1.4 -4.5',
  label: 'Open doorway to the blue room',
  action: (on) => {
    if (!on) {
      byId('yellowBlueDoorway').remove();
      return;
    }
    const portal = document.createElement('a-portal');
    portal.id = 'yellowBlueDoorway';
    portal.setAttribute('from', '#yellowRight');
    portal.setAttribute('to', '#blueLeft');
    portal.setAttribute('position', '0.5 0 -4.5');
    portal.setAttribute('width', '1.2');
    portal.setAttribute('height', '2.2');
    portal.innerHTML = '<a-floor mixin="floorPaint"></a-floor><a-ceiling material="color:#FCBF49"></a-ceiling>'
      + '<a-sides material="color:#FCBF49"></a-sides>';
    scene.appendChild(portal);
  }
});

// Blue and green rooms.
addInfo({
  position: '4 1.6 -2.6',
  label: 'An <a-opening> with a floor-height keeps the wall under its sill solid.'
});
addInfo({
  position: '1.8 1.6 -6.5',
  label: 'These rooms share one wall plane. An <a-portal> with no children makes a doorway with no depth.'
});
addInfo({
  position: '3.5 0.9 -11.4',
  label: 'Children of <a-wall> move with it: these boxes are placed in the wall\'s own space.'
});
addInfo({
  position: '1.6 1.2 -9',
  label: 'uv-scale="1" tiles a texture once per meter; material repeat 0.5 stretches it to 2m here.'
});

// Around the path.
addInfo({
  position: '-5.5 1 5',
  label: '<a-ceiling> on an outside room is a roof: it faces up, so you see it from above.'
});
addInfo({
  position: '15.6 2 8.6',
  label: '<a-room width length>: four <a-wall>s with no positions; the room places them.'
});
addAction({
  position: '12.6 1.4 8.6',
  label: 'Rebuild the brown room and its shell. Nothing should change.',
  action: () => { for (const id of ['brownShell', 'brownRoom']) byId(id).components.room.rebuild(); }
});
addInfo({
  position: '14.5 2.2 -0.6',
  label: 'Rooms move, rotate and scale like any entity. Each <a-opening> follows its <a-portal>, and a door '
    + 'scales with its rooms.'
});
addToggle({
  position: '12.4 1.4 -1.2',
  label: 'Grow the navy building 1.5x',
  action: (on) => {
    const scale = on ? '1.5 1 1.5' : '1 1 1';
    for (const id of ['navyRoom', 'navyShell']) byId(id).setAttribute('scale', scale);
  }
});
addInfo({
  position: '-18 1.8 -4.5',
  label: 'A concave outside room leaves this courtyard open. Its door is a 1m deep textured <a-portal>.'
});
addInfo({
  position: '-21 1.6 -10',
  label: 'Concave <a-room>: <a-floor> and <a-ceiling> cover only the U, with nothing across the notch.'
});

// Purple building.
addToggle({
  position: '-20.8 1.4 14',
  label: 'Remove the pink room\'s back-left wall',
  action: (on) => {
    if (on) {
      byId('pinkCorner').remove();
      return;
    }
    const wall = document.createElement('a-wall');
    wall.id = 'pinkCorner';
    wall.setAttribute('position', '-23 0 10');
    byId('pinkRoom').prepend(wall);
  }
});
addInfo({
  position: '-20.8 2.4 14',
  label: 'Removing an <a-wall> rebuilds its room without it: the pink room becomes a triangle, and comes '
    + 'back square when the wall returns.'
});
const ORANGE_DOOR = {
  pink: { from: '#orangeWest', to: '#pinkEast', position: '-19 0 11.5' },
  teal: { from: '#orangeEast', to: '#tealWest', position: '-14 0 11.5' }
};
addToggle({
  position: '-15.8 1.4 14',
  label: 'Move the orange room\'s door to the teal room',
  action: (on) => {
    const placement = on ? ORANGE_DOOR.teal : ORANGE_DOOR.pink;
    for (const [attr, value] of Object.entries(placement)) byId('orangeDoor').setAttribute(attr, value);
  }
});
addInfo({
  position: '-15.8 2.4 14',
  label: 'Changing an <a-portal>\'s from and to moves the tunnel, and the walls it left fill back in.'
});
addInfo({
  position: '-12.5 2.2 8',
  label: '#whiteRoom, the empty lot behind the purple building, has visible="false". Rebuilds leave it '
    + 'hidden; the show toggle puts a building there.'
});
addAction({
  position: '-13.2 1.4 8',
  label: 'Rebuild the hidden white room. It should stay hidden.',
  action: () => byId('whiteRoom').components.room.rebuild()
});
addToggle({
  position: '-11.8 1.4 8',
  label: 'Show the hidden white room',
  action: on => byId('whiteRoom').setAttribute('visible', on)
});
addInfo({
  position: '-7 1.6 12',
  label: '#brokenRoom has two walls and #typoPortal selects nothing. Both log a console error and are '
    + 'skipped; everything else builds.'
});
