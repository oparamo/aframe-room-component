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

// Collidable meshes the labels must stay in front of; refreshed after every build.
let walls = [];
scene.addEventListener('room-building-complete', () => {
  walls = scene.systems['room-collision'].meshes();
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

// A sphere with a label, placed in the lot with this id; its position is measured from the lot's center.
const addMarker = ({ lot, position, label, color, pinned = false }) => {
  const marker = document.createElement('a-entity');
  marker.setAttribute('position', position);
  marker.setAttribute('check-marker', { label, pinned });
  const sphere = document.createElement('a-sphere');
  sphere.setAttribute('radius', '0.12');
  sphere.setAttribute('color', color);
  marker.appendChild(sphere);
  byId(lot).appendChild(marker);
  return { marker, sphere };
};

// A grey sphere the cursor can click; its label grows while hovered.
const addClickable = ({ lot, position, label, color }) => {
  const { marker, sphere } = addMarker({ lot, position, label, color });
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
const addToggle = ({ lot, position, label, onLabel = label, action, on = false }) => {
  const labelFor = state => state ? onLabel : label;
  const colorFor = state => state ? GREEN : GREY;
  const { marker, sphere } = addClickable({ lot, position, label: labelFor(on), color: colorFor(on) });
  sphere.addEventListener('click', () => {
    on = !on;
    action(on);
    sphere.setAttribute('color', colorFor(on));
    marker.setAttribute('check-marker', 'label', labelFor(on));
  });
};

// Runs a one-off action on click and flashes green.
const addAction = ({ lot, position, label, action }) => {
  const { sphere } = addClickable({ lot, position, label, color: GREY });
  sphere.addEventListener('click', () => {
    action();
    sphere.setAttribute('color', GREEN);
    setTimeout(() => {
      sphere.setAttribute('color', GREY);
    }, 600);
  });
};

// A white sphere whose full-size label says what to look at.
const addInfo = ({ lot, position, label }) => addMarker({ lot, position, label, color: WHITE, pinned: true });

// The ground: grass with a line every meter, painted on a canvas. Each lot is a lighter square of it,
// leaving a strip of plain grass between neighbors.
const GRASS = '#43A047';
const LOT_GRASS = '#4CAF50';
const GRID_LINE = '#81C784';
const GROUND_SIZE = 160;
const LOT_SIZE = 22;
const TILE_PIXELS = 64;

// One tile per square meter; neighboring tiles' edges meet to draw each grid line. A-Frame caches
// textures by their source's id, so each canvas needs its own.
const paintGridTile = ({ id, color }) => {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.width = TILE_PIXELS;
  canvas.height = TILE_PIXELS;
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  context.fillRect(0, 0, TILE_PIXELS, TILE_PIXELS);
  context.strokeStyle = GRID_LINE;
  context.lineWidth = 4;
  context.strokeRect(0, 0, TILE_PIXELS, TILE_PIXELS);
  return canvas;
};

// Unlit, so the grass keeps its painted color and doesn't catch a glare from the lights.
byId('ground').setAttribute('material', {
  shader: 'flat', src: paintGridTile({ id: 'gridTexture', color: GRASS }), repeat: `${GROUND_SIZE} ${GROUND_SIZE}`
});

// Between the ground and the floors, so it fights neither. Lots sit on whole meters, so its grid lines
// fall on the ground's.
const lotTile = paintGridTile({ id: 'lotTexture', color: LOT_GRASS });
for (const lotEl of document.querySelectorAll('.lot')) {
  const square = document.createElement('a-plane');
  square.setAttribute('rotation', '-90 0 0');
  square.setAttribute('position', '0 -0.005 0');
  square.setAttribute('width', LOT_SIZE);
  square.setAttribute('height', LOT_SIZE);
  square.setAttribute('material', { shader: 'flat', src: lotTile, repeat: `${LOT_SIZE} ${LOT_SIZE}` });
  lotEl.appendChild(square);
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
  lot: 'centerLot',
  position: '-0.4 1.2 0.4',
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
  lot: 'redLot',
  position: '6 2 7.8',
  label: '<a-room outside="true">: the walls face out, so the room is the outside of a building.'
});
addInfo({
  lot: 'redLot',
  position: '-3 2.6 7.6',
  label: '<a-portal> joins two <a-opening>s. This one is a 2m deep door lined with <a-floor>, '
    + '<a-ceiling> and <a-sides>.'
});
addInfo({
  lot: 'redLot',
  position: '3 2.3 7.6',
  label: '<a-portal floor-height="0.9"> makes a window. The wall under its sill stops you.'
});

// Yellow room.
addInfo({
  lot: 'redLot',
  position: '-4.2 2.4 4.4',
  label: '<a-wall position>: each wall starts at its corner and runs to the next wall\'s corner.'
});
addToggle({
  lot: 'redLot',
  position: '-1.5 2.2 0.6',
  label: 'Push back wall 2m',
  action: (on) => {
    for (const id of ['yellowBackWall', 'yellowRightWall']) byId(id).object3D.position.z = on ? -2 : 0;
  }
});
addToggle({
  lot: 'redLot',
  position: '-5.4 1.2 0.6',
  label: 'Raise corner 1m',
  action: (on) => {
    const height = on ? 4 : 0;
    byId('yellowBackWall').setAttribute('wall', 'height', height);
  }
});
addToggle({
  lot: 'redLot',
  position: '-3 0.35 2.5',
  label: 'Halve floor tiles',
  action: (on) => {
    const uvScale = on ? 2 : 1;
    byId('yellowFloor').setAttribute('floor', 'uvScale', uvScale);
  }
});
// The wall starts without a material of its own and takes the room's. Painting gives it one; removing
// that one should bring the room's back.
addToggle({
  lot: 'redLot',
  position: '-5.4 1.6 2.5',
  label: 'Paint the left wall orange',
  action: (on) => {
    if (on) byId('yellowLeftWall').setAttribute('material', 'color', '#F77F00');
    else byId('yellowLeftWall').removeAttribute('material');
  }
});
addToggle({
  lot: 'redLot',
  position: '-0.6 1.4 2.5',
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
    portal.setAttribute('position', '0.5 0 2.5');
    portal.setAttribute('width', '1.2');
    portal.setAttribute('height', '2.2');
    portal.innerHTML = '<a-floor mixin="floorPaint"></a-floor><a-ceiling material="color:#FCBF49"></a-ceiling>'
      + '<a-sides material="color:#FCBF49"></a-sides>';
    byId('redLot').appendChild(portal);
  }
});

// Blue and green rooms.
addInfo({
  lot: 'redLot',
  position: '4 1.6 4.4',
  label: 'An <a-opening> with a floor-height keeps the wall under its sill solid.'
});
addInfo({
  lot: 'redLot',
  position: '1.8 1.6 0.5',
  label: 'These rooms share one wall plane. An <a-portal> with no children makes a doorway with no depth.'
});
addInfo({
  lot: 'redLot',
  position: '3.5 0.9 -4.4',
  label: 'Children of <a-wall> move with it: these boxes are placed in the wall\'s own space.'
});
addInfo({
  lot: 'redLot',
  position: '1.6 1.2 -2',
  label: 'uv-scale="1" tiles a texture once per meter; material repeat 0.5 stretches it to 2m here.'
});

// Lime room.
addInfo({
  lot: 'limeLot',
  position: '0 1 0',
  label: '<a-ceiling> on an outside room is a roof: it faces up, so you see it from above.'
});
addInfo({
  lot: 'limeLot',
  position: '2.2 1 0',
  label: 'These 0.6m walls stop you though your torso clears them: room-collision also looks just above '
    + 'its stepHeight, 0.3m. The roof is out of step reach.'
});

// Gold building.
addInfo({
  lot: 'goldLot',
  position: '-5.4 2.4 0',
  label: '<a-portal floor-height="0.2">: a sill no higher than room-collision\'s stepHeight is a step, '
    + 'so you walk in.'
});
addInfo({
  lot: 'goldLot',
  position: '0 2.2 3.8',
  label: 'A window of any size stops you: the wall under a sill above stepHeight blocks the way.'
});
addInfo({
  lot: 'goldLot',
  position: '2 1.6 -1',
  label: 'room-collision keeps you its radius, 0.4m, from every wall: walk into a corner, or along a wall '
    + 'at a shallow angle.'
});

// Cyan room.
addInfo({
  lot: 'cyanLot',
  position: '0 2.7 2.1',
  label: 'An inside room with no shell: its walls face in, yet stop you from outside too.'
});
addInfo({
  lot: 'cyanLot',
  position: '-2.6 1.6 0',
  label: '<a-wall visible="false"> is hidden but still stops you.'
});
addInfo({
  lot: 'cyanLot',
  position: '2.6 1.6 0',
  label: '<a-wall visible="false" collidable="false"> is hidden, and you walk through it.'
});
addInfo({
  lot: 'cyanLot',
  position: '0 1.6 -2.1',
  label: '<a-wall collidable="false"> shows, and you walk through it.'
});
addToggle({
  lot: 'cyanLot',
  position: '0 1.2 2.7',
  label: 'Turn off collision for the cyan room',
  action: (on) => {
    byId('cyanRoom').setAttribute('collidable', !on);
  }
});

// Brown building.
addInfo({
  lot: 'brownLot',
  position: '1.6 2 3.6',
  label: '<a-room width length>: four <a-wall>s with no positions; the room places them. Each wall '
    + 'inside has its own shade.'
});
addAction({
  lot: 'brownLot',
  position: '-1.4 1.4 3.6',
  label: 'Rebuild the brown room and its shell. Nothing should change.',
  action: () => { for (const id of ['brownShell', 'brownRoom']) byId(id).components.room.rebuild(); }
});

// Navy building.
addInfo({
  lot: 'navyLot',
  position: '-0.05 2.2 5.35',
  label: 'Rooms move, rotate and scale like any entity. Each <a-opening> follows its <a-portal>, and a door '
    + 'scales with its rooms.'
});
addToggle({
  lot: 'navyLot',
  position: '-2.15 1.4 4.75',
  label: 'Grow the navy building 1.5x',
  action: (on) => {
    const scale = on ? '1.5 1 1.5' : '1 1 1';
    for (const id of ['navyRoom', 'navyShell']) byId(id).setAttribute('scale', scale);
  }
});

// Magenta building.
addInfo({
  lot: 'magentaLot',
  position: '0 1.8 3.5',
  label: 'A concave outside room leaves this courtyard open. Its door is a 1m deep textured <a-portal>.'
});
addInfo({
  lot: 'magentaLot',
  position: '-3 1.6 -2',
  label: 'Concave <a-room>: <a-floor> and <a-ceiling> cover only the U, with nothing across the notch.'
});

// Purple building.
addToggle({
  lot: 'purpleLot',
  position: '-4.3 1.4 2.5',
  label: 'Remove the pink room\'s back-left wall',
  action: (on) => {
    if (on) {
      byId('pinkCorner').remove();
      return;
    }
    const wall = document.createElement('a-wall');
    wall.id = 'pinkCorner';
    wall.setAttribute('position', '-6.5 0 -1.5');
    byId('pinkRoom').prepend(wall);
  }
});
addInfo({
  lot: 'purpleLot',
  position: '-4.3 2.4 2.5',
  label: 'Removing an <a-wall> rebuilds its room without it: the pink room becomes a triangle, and comes '
    + 'back square when the wall returns.'
});
const ORANGE_DOOR = {
  pink: { from: '#orangeWest', to: '#pinkEast', position: '-2.5 0 0' },
  teal: { from: '#orangeEast', to: '#tealWest', position: '2.5 0 0' }
};
addToggle({
  lot: 'purpleLot',
  position: '0.7 1.4 2.5',
  label: 'Move the orange room\'s door to the teal room',
  action: (on) => {
    const placement = on ? ORANGE_DOOR.teal : ORANGE_DOOR.pink;
    for (const [attr, value] of Object.entries(placement)) byId('orangeDoor').setAttribute(attr, value);
  }
});
addInfo({
  lot: 'purpleLot',
  position: '0.7 2.4 2.5',
  label: 'Changing an <a-portal>\'s from and to moves the tunnel, and the walls it left fill back in.'
});

// White room.
addInfo({
  lot: 'whiteLot',
  position: '4 2.2 1',
  label: '#whiteRoom, the empty lot here, has visible="false". Rebuilds leave it hidden; the show toggle '
    + 'puts a building there.'
});
addAction({
  lot: 'whiteLot',
  position: '3.3 1.4 1',
  label: 'Rebuild the hidden white room. It should stay hidden.',
  action: () => byId('whiteRoom').components.room.rebuild()
});
addToggle({
  lot: 'whiteLot',
  position: '4.7 1.4 1',
  label: 'Show the hidden white room',
  action: on => byId('whiteRoom').setAttribute('visible', on)
});

// The broken room, by the spawn.
addInfo({
  lot: 'centerLot',
  position: '5 1.6 0',
  label: '#brokenRoom has two walls and #typoPortal selects nothing. Both log a console error and are '
    + 'skipped; everything else builds.'
});
