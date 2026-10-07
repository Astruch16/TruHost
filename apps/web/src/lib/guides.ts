/**
 * The three guide characters, ported from docs/design/Mascots.dc.html (the waving pose and its idle animation) and
 * docs/design/Poses.dc.html (pointing, celebrating, thinking, sleeping). Every path, colour, gradient and timing is
 * copied from those boards unchanged. Don't redraw or simplify here; change the boards first.
 *
 * Each character has one base drawing. It is stored in four segments so both boards' layer orders come out exactly:
 *
 *   Mascots (waving):  back → wave arm → front → rest arm → body → eyes + sparkles → face
 *   Poses (the rest):  back → front → body → face → arms → paws → eyes or eye arcs
 */

export const GUIDE_CHARACTERS = ['sage', 'juniper', 'pip'] as const;
export type GuideCharacter = (typeof GUIDE_CHARACTERS)[number];

export const GUIDE_POSES = ['waving', 'pointing', 'celebrating', 'thinking', 'sleeping'] as const;
export type GuidePose = (typeof GUIDE_POSES)[number];

/**
 * One SVG element. `url(#vol)`, `url(#limb)` and `url(#gnd)` fills are per-instance gradients; the component rewrites
 * them to unique ids. A `clip` group is clipped to the character's body outline, as in the boards.
 */
export type GuideShape =
  | { el: 'path' | 'circle' | 'ellipse' | 'rect'; a: Record<string, string | number> }
  | { el: 'clip'; opacity?: number; children: GuideShape[] };

type Attrs = Record<string, string | number>;
const path = (d: string, fill: string, a: Attrs = {}): GuideShape => ({ el: 'path', a: { d, fill, ...a } });
const circle = (cx: number, cy: number, r: number, fill: string, a: Attrs = {}): GuideShape => ({
  el: 'circle',
  a: { cx, cy, r, fill, ...a },
});
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, a: Attrs = {}): GuideShape => ({
  el: 'ellipse',
  a: { cx, cy, rx, ry, fill, ...a },
});
const line = (d: string, stroke: string, strokeWidth: number): GuideShape =>
  path(d, 'none', { stroke, strokeWidth, strokeLinecap: 'round' });
const clip = (children: GuideShape[], opacity?: number): GuideShape => ({ el: 'clip', opacity, children });
const VOLUME: GuideShape = { el: 'rect', a: { width: 200, height: 200, fill: 'url(#vol)' } };
const WHITE = '#FFFFFF';
const INK = '#1A1D21';
const GOLD = '#D9AE3C';
const BLUSH = '#E79AA8';
const SMILE = '#173F3A';
const CREAM = '#F3E7C4';

/** The gold TruHost key every guide wears; `y` is the ring's centre. */
const key = (y: number): GuideShape[] => [
  circle(100, y, 5, 'none', { stroke: GOLD, strokeWidth: 3 }),
  line(`M100 ${y + 5} V${y + 16} M100 ${y + 11} H105 M100 ${y + 15.5} H104`, GOLD, 3),
];

/** `dot()` from Poses.dc.html: Juniper's small round paw. */
const dot = (x: number, y: number) => 'M' + (x - 4) + ' ' + y + ' a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 ';

export interface GuideDefinition {
  key: GuideCharacter;
  name: string;
  /** Short kind, as in the Onboarding picker. */
  kind: string;
  /** Full species, as on the Mascots board. */
  species: string;
  /** Kind colour on the Mascots board. */
  speciesColor: string;
  description: string;
  /** Background tint behind the character. */
  tint: string;
  /** Text alternative for the waving pose (Mascots.dc.html). */
  wavingLabel: string;
  /** Body outline the volume gradient is clipped to. */
  clipPath: string;
  /** The `vol` radial gradient (userSpaceOnUse): centre, radius, stops as [offset, colour, opacity]. */
  volume: { cx: number; cy: number; r: number; stops: [number, string, number][] };
  base: {
    /** Behind the waving arm: Juniper's tail (which sways while waving) and Pip's tail. */
    back: GuideShape[];
    backSways: boolean;
    /** Between the waving arm and the resting arm. */
    front: GuideShape[];
    /** Between the resting arm and the eyes. */
    body: GuideShape[];
    /** Over the eyes. */
    face: GuideShape[];
  };
  eyes: GuideShape[];
  /** The small second highlight each eye has in the waving pose only. */
  eyeSparkles: GuideShape[];
  armFill: string;
  arms: { restL: string; restR: string; upL: string; upR: string; pointR: string; thinkR: string };
  paws: { up: string; point: string; think: string };
  eyeArcs: { happy: string; sleep: string };
  /** The waving arm (Mascots.dc.html): path, fill, and anything that moves with it (Juniper's paw). */
  wave: { d: string; fill: string; extra: GuideShape[] };
  /** Ground shadow under the waving pose. The other poses share one (POSE_GROUND). */
  wavingGround: { cx: number; cy: number; rx: number };
  /** Animation offsets in the waving pose, so the three never move in step. */
  delays: { bob?: string; wave?: string; blink?: string };
}

const SAGE_OUTLINE =
  'M100 44 C62 44 46 78 46 112 C46 152 70 180 100 180 C130 180 154 152 154 112 C154 78 138 44 100 44Z';
const JUNIPER_BODY =
  'M100 92 C76 92 64 118 64 146 C64 168 78 182 100 182 C122 182 136 168 136 146 C136 118 124 92 100 92Z';
const JUNIPER_HEAD =
  'M100 30 C72 30 58 48 58 68 C58 76 54 80 50 84 C58 86 62 92 70 98 C80 104 90 106 100 106 C110 106 120 104 130 98 C138 92 142 86 150 84 C146 80 142 76 142 68 C142 48 128 30 100 30Z';
const PIP_OUTLINE =
  'M100 40 C62 40 44 72 44 110 C44 150 68 178 100 178 C132 178 156 150 156 110 C156 72 138 40 100 40Z';

export const GUIDES: Record<GuideCharacter, GuideDefinition> = {
  sage: {
    key: 'sage',
    name: 'Sage',
    kind: 'Owl',
    species: 'Northern saw-whet owl',
    speciesColor: '#23442F',
    description: 'Calm and watchful. The steady one who keeps an eye on the place while you are away.',
    tint: '#DDEBDF',
    wavingLabel: 'Sage, a small green owl with yellow eyes, waving a wing and wearing a gold key',
    clipPath: SAGE_OUTLINE,
    volume: {
      cx: 76,
      cy: 80,
      r: 125,
      stops: [
        [0, WHITE, 0.42],
        [0.3, WHITE, 0],
        [0.55, '#101412', 0],
        [1, '#101412', 0.42],
      ],
    },
    base: {
      back: [],
      backSways: false,
      front: [
        path(
          'M58 78 C52 60 52 46 58 32 C68 40 80 46 90 50Z M142 78 C148 60 148 46 142 32 C132 40 120 46 110 50Z',
          '#3E6B56',
        ),
        path(SAGE_OUTLINE, '#4F7A63'),
        clip([VOLUME, ellipse(66, 68, 30, 20, WHITE, { fillOpacity: 0.1 })]),
      ],
      body: [
        path(
          'M100 106 C78 106 68 128 68 146 C68 166 82 177 100 177 C118 177 132 166 132 146 C132 128 122 106 100 106Z',
          '#F1F5EE',
        ),
        line(
          'M76 154 q6 6 12 0 M94 154 q6 6 12 0 M112 154 q6 6 12 0 M85 166 q6 6 12 0 M103 166 q6 6 12 0',
          '#B9D2BF',
          2.4,
        ),
        clip([VOLUME], 0.5),
        circle(79, 90, 25, '#F6F6F3'),
        circle(121, 90, 25, '#F6F6F3'),
      ],
      face: [
        path('M100 100 C94 100 93 105 100 115 C107 105 106 100 100 100Z', GOLD),
        ellipse(60, 110, 7, 4.5, BLUSH, { fillOpacity: 0.6 }),
        ellipse(140, 110, 7, 4.5, BLUSH, { fillOpacity: 0.6 }),
        line('M76 116 Q100 132 124 116', SMILE, 2),
        ...key(131),
        ellipse(86, 181, 8, 4.5, GOLD),
        ellipse(114, 181, 8, 4.5, GOLD),
      ],
    },
    eyes: [
      circle(81, 91, 13, '#E2C15A'),
      circle(119, 91, 13, '#E2C15A'),
      circle(81, 91, 9, INK),
      circle(119, 91, 9, INK),
      circle(84.5, 87.5, 3.2, WHITE),
      circle(122.5, 87.5, 3.2, WHITE),
    ],
    eyeSparkles: [circle(78, 94.5, 1.4, WHITE), circle(116, 94.5, 1.4, WHITE)],
    armFill: '#2F5548',
    arms: {
      restL: 'M48 108 C40 128 44 152 58 166 C61 146 59 124 55 106Z',
      restR: 'M152 108 C160 128 156 152 142 166 C139 146 141 124 145 106Z',
      upL: 'M50 106 C34 98 23 82 25 62 C38 68 50 80 57 96Z',
      upR: 'M150 106 C166 98 177 82 175 62 C162 68 150 80 143 96Z',
      pointR: 'M146 104 C162 100 178 100 192 105 C178 113 162 117 146 119Z',
      thinkR:
        'M150 106 C160 124 154 142 138 144 C122 146 110 134 106 120 C112 115 119 118 125 125 C131 130 139 126 141 112Z',
    },
    paws: { up: '', point: '', think: '' },
    eyeArcs: {
      happy: 'M70 94 Q81 82 92 94 M108 94 Q119 82 130 94',
      sleep: 'M70 89 Q81 99 92 89 M108 89 Q119 99 130 89',
    },
    wave: { d: 'M150 106 C166 98 177 82 175 62 C162 68 150 80 143 96Z', fill: '#2F5548', extra: [] },
    wavingGround: { cx: 102, cy: 188, rx: 58 },
    delays: {},
  },

  juniper: {
    key: 'juniper',
    name: 'Juniper',
    kind: 'Pine marten',
    species: 'Pine marten',
    speciesColor: '#3F3470',
    description: 'Curious and quick. The playful one who has already found the shortcut you were looking for.',
    tint: '#E6E0F5',
    wavingLabel: 'Juniper, a brown pine marten with a cream bib, waving a paw and wearing a gold key',
    clipPath: `${JUNIPER_BODY} ${JUNIPER_HEAD}`,
    volume: {
      cx: 82,
      cy: 56,
      r: 150,
      stops: [
        [0, WHITE, 0.38],
        [0.28, WHITE, 0],
        [0.5, '#101412', 0],
        [1, '#101412', 0.44],
      ],
    },
    base: {
      back: [
        path(
          'M126 170 C160 176 186 152 182 118 C180 100 166 92 157 101 C168 113 164 135 146 143 C134 148 126 154 126 170Z',
          '#553B30',
        ),
        path('M176 108 C172 100 164 96 157 101 C162 106 165 113 166 120 C171 118 175 114 176 108Z', CREAM),
      ],
      backSways: true,
      front: [
        path(JUNIPER_BODY, '#6B4E3D'),
        path(
          'M100 100 C86 100 80 114 82 128 C84 142 92 152 100 152 C108 152 116 142 118 128 C120 114 114 100 100 100Z',
          CREAM,
        ),
        ellipse(100, 106, 34, 9, '#101412', { fillOpacity: 0.16 }),
      ],
      body: [
        circle(70, 41, 13, '#6B4E3D'),
        circle(130, 41, 13, '#6B4E3D'),
        circle(70, 42, 7, CREAM),
        circle(130, 42, 7, CREAM),
        path(JUNIPER_HEAD, '#6B4E3D'),
        clip([VOLUME, ellipse(78, 44, 26, 14, WHITE, { fillOpacity: 0.1 })]),
        ellipse(100, 84, 23, 16, CREAM),
      ],
      face: [
        path('M93 76 Q100 72 107 76 Q105 84 100 84 Q95 84 93 76Z', INK),
        line('M100 84 V88 M100 88 Q94 95 88 90 M100 88 Q106 95 112 90', INK, 2),
        ellipse(70, 82, 7, 4.5, BLUSH, { fillOpacity: 0.6 }),
        ellipse(130, 82, 7, 4.5, BLUSH, { fillOpacity: 0.6 }),
        line('M84 114 Q100 126 116 114', SMILE, 2),
        ...key(126),
        ellipse(84, 182, 14, 7, '#553B30'),
        ellipse(116, 182, 14, 7, '#553B30'),
      ],
    },
    eyes: [
      circle(82, 66, 8, INK),
      circle(118, 66, 8, INK),
      circle(84.8, 63.2, 2.8, WHITE),
      circle(120.8, 63.2, 2.8, WHITE),
    ],
    eyeSparkles: [circle(79.5, 69, 1.3, WHITE), circle(115.5, 69, 1.3, WHITE)],
    armFill: '#553B30',
    arms: {
      restL: 'M70 122 C60 132 60 148 68 156 C74 148 77 134 77 124Z',
      restR: 'M130 122 C140 132 140 148 132 156 C126 148 123 134 123 124Z',
      upL: 'M70 120 C56 112 47 98 49 82 C60 86 69 98 75 111Z',
      upR: 'M130 120 C144 112 153 98 151 82 C140 86 131 98 125 111Z',
      pointR: 'M74 114 C58 108 40 106 20 110 C36 120 56 126 74 128Z',
      thinkR:
        'M126 114 C140 124 140 142 126 147 C112 150 104 134 103 110 C109 105 114 109 116 119 C118 127 122 125 121 116Z',
    },
    paws: { up: dot(52, 87) + dot(148, 87), point: dot(24, 111), think: dot(108, 109) },
    eyeArcs: {
      happy: 'M74 69 Q82 60 90 69 M110 69 Q118 60 126 69',
      sleep: 'M74 64 Q82 72 90 64 M110 64 Q118 72 126 64',
    },
    wave: {
      d: 'M130 120 C144 112 153 98 151 82 C140 86 131 98 125 111Z',
      fill: '#553B30',
      extra: [circle(148, 87, 4, CREAM)],
    },
    wavingGround: { cx: 108, cy: 188, rx: 64 },
    delays: { bob: '-1.1s', wave: '-1.2s', blink: '-2s' },
  },

  pip: {
    key: 'pip',
    name: 'Pip',
    kind: 'Chickadee',
    species: 'Black-capped chickadee',
    speciesColor: '#24456B',
    description: 'Small and cheerful. The friendly one who is happy about every booking, however short.',
    tint: '#DCE8F5',
    wavingLabel: 'Pip, a round chickadee with a black cap and bib, waving a wing and wearing a gold key',
    clipPath: PIP_OUTLINE,
    volume: {
      cx: 76,
      cy: 72,
      r: 125,
      stops: [
        [0, WHITE, 0.4],
        [0.3, WHITE, 0],
        [0.55, '#101412', 0],
        [1, '#101412', 0.34],
      ],
    },
    base: {
      back: [path('M126 162 L162 186 L141 191 L116 172Z', '#5F6975')],
      backSways: false,
      front: [
        line('M88 174 V186 M112 174 V186 M81 186 H95 M105 186 H119', '#3A3F47', 3.5),
        path(PIP_OUTLINE, '#F4EDE0'),
        clip([
          ellipse(60, 154, 13, 18, '#EBDDC3', { fillOpacity: 0.75 }),
          ellipse(140, 154, 13, 18, '#EBDDC3', { fillOpacity: 0.75 }),
          ellipse(100, 96, 56, 27, WHITE),
          path('M40 100 C40 60 66 36 100 36 C134 36 160 60 160 100 C142 84 124 77 100 77 C76 77 58 84 40 100Z', INK),
          VOLUME,
        ]),
      ],
      body: [
        path('M87 120 C93 116 107 116 113 120 C112 130 106 134 100 134 C94 134 88 130 87 120Z', INK),
        path('M93 103 H107 L100 115Z', GOLD),
      ],
      face: [
        ellipse(64, 104, 7, 4.5, BLUSH, { fillOpacity: 0.6 }),
        ellipse(136, 104, 7, 4.5, BLUSH, { fillOpacity: 0.6 }),
        line('M80 140 Q100 154 120 140', SMILE, 2),
        ...key(153),
      ],
    },
    eyes: [
      circle(78, 92, 7.5, INK),
      circle(122, 92, 7.5, INK),
      circle(80.6, 89.4, 2.6, WHITE),
      circle(124.6, 89.4, 2.6, WHITE),
    ],
    eyeSparkles: [circle(75.8, 94.8, 1.2, WHITE), circle(119.8, 94.8, 1.2, WHITE)],
    armFill: '#7C8794',
    arms: {
      restL: 'M46 102 C38 126 46 154 64 168 C61 146 60 122 58 100Z',
      restR: 'M154 102 C162 126 154 154 136 168 C139 146 140 122 142 100Z',
      upL: 'M50 100 C32 92 21 76 23 58 C36 62 48 74 55 90Z',
      upR: 'M150 100 C168 92 179 76 177 58 C164 62 152 74 145 90Z',
      pointR: 'M150 108 C166 104 180 104 194 109 C180 117 166 121 150 123Z',
      thinkR:
        'M152 104 C164 124 158 144 140 146 C124 148 112 136 108 124 C114 119 121 122 127 129 C133 134 141 130 143 114Z',
    },
    paws: { up: '', point: '', think: '' },
    eyeArcs: {
      happy: 'M71 96 Q78 87 85 96 M115 96 Q122 87 129 96',
      sleep: 'M71 90 Q78 98 85 90 M115 90 Q122 98 129 90',
    },
    wave: { d: 'M150 100 C168 92 179 76 177 58 C164 62 152 74 145 90Z', fill: '#6B7684', extra: [] },
    wavingGround: { cx: 102, cy: 190, rx: 58 },
    delays: { bob: '-2.1s', wave: '-2.3s', blink: '-3.4s' },
  },
};

/** Ground shadow shared by the four Poses.dc.html poses. */
export const POSE_GROUND = { cx: 102, cy: 189, rx: 58 };

export interface PoseRecipe {
  /** Motion class on the whole figure. */
  motion: string;
  tilt?: string;
  armL: string;
  armR: string;
  armRClass?: string;
  paws: string;
  eyesOpen: boolean;
  eyeArcs?: string;
  eyeShift?: string;
  props?: 'confetti' | 'thought' | 'zzz';
  label: string;
}

/** The four `cells.push(...)` recipes in Poses.dc.html. Waving is drawn separately (see the Guide component). */
export function poseRecipe(g: GuideDefinition, pose: Exclude<GuidePose, 'waving'>): PoseRecipe {
  switch (pose) {
    case 'pointing':
      return {
        motion: 'th-point',
        armL: g.key === 'juniper' ? g.arms.restR : g.arms.restL,
        armR: g.arms.pointR,
        armRClass: 'th-nudge',
        paws: g.paws.point,
        eyesOpen: true,
        label: `${g.name} pointing to one side`,
      };
    case 'celebrating':
      return {
        motion: 'th-celebrate',
        armL: g.arms.upL,
        armR: g.arms.upR,
        paws: g.paws.up,
        eyesOpen: false,
        eyeArcs: g.eyeArcs.happy,
        props: 'confetti',
        label: `${g.name} celebrating with both arms up`,
      };
    case 'thinking':
      return {
        motion: 'th-think',
        armL: g.arms.restL,
        armR: g.arms.thinkR,
        paws: g.paws.think,
        eyesOpen: true,
        eyeShift: 'translate(2 -3)',
        props: 'thought',
        label: `${g.name} thinking`,
      };
    case 'sleeping':
      return {
        motion: 'th-sleep',
        tilt: 'rotate(-5 100 184)',
        armL: g.arms.restL,
        armR: g.arms.restR,
        paws: '',
        eyesOpen: false,
        eyeArcs: g.eyeArcs.sleep,
        props: 'zzz',
        label: `${g.name} asleep`,
      };
  }
}

/** The text alternative for a character in a pose. */
export function guideLabel(character: GuideCharacter, pose: GuidePose): string {
  const g = GUIDES[character];
  return pose === 'waving' ? g.wavingLabel : poseRecipe(g, pose).label;
}

/** API value ("SAGE") → component key ("sage"). Anything unknown falls back to Sage, the default. */
export function guideFromApi(value: string | null | undefined): GuideCharacter {
  const k = (value ?? '').toLowerCase();
  return (GUIDE_CHARACTERS as readonly string[]).includes(k) ? (k as GuideCharacter) : 'sage';
}

/** Component key → API value. */
export function guideToApi(character: GuideCharacter): 'SAGE' | 'JUNIPER' | 'PIP' {
  return character.toUpperCase() as 'SAGE' | 'JUNIPER' | 'PIP';
}
