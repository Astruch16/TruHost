/**
 * The three guide characters: Sage the owl, Juniper the pine marten and Pip the chickadee. Each is a 3D figure waving
 * hello, served from public/mascots: a transparent WebM (5 s, square, the guide in the middle of the frame) and its
 * last frame as a transparent still. The guide picker plays the wave (GuideWave); everywhere else shows the still
 * (Guide).
 */

export const GUIDE_CHARACTERS = ['sage', 'juniper', 'pip'] as const;
export type GuideCharacter = (typeof GUIDE_CHARACTERS)[number];

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
  /** Text alternative for the figure. */
  label: string;
  /** The 3D waving-hello animation and its last frame. */
  wave: { video: string; still: string };
}

export const GUIDES: Record<GuideCharacter, GuideDefinition> = {
  sage: {
    key: 'sage',
    name: 'Sage',
    kind: 'Owl',
    species: 'Northern saw-whet owl',
    speciesColor: '#23442F',
    description: 'Calm and watchful. The steady one who keeps an eye on the place while you are away.',
    tint: '#DDEBDF',
    label: 'Sage, a small green owl with golden eyes, waving a wing and wearing a gold key',
    wave: { video: '/mascots/owl-wave.webm', still: '/mascots/owl-wave-still.webp' },
  },
  juniper: {
    key: 'juniper',
    name: 'Juniper',
    kind: 'Pine marten',
    species: 'Pine marten',
    speciesColor: '#3F3470',
    description: 'Curious and quick. The playful one who has already found the shortcut you were looking for.',
    tint: '#E6E0F5',
    label: 'Juniper, a brown pine marten with a cream bib, waving a paw and wearing a gold key',
    wave: { video: '/mascots/juniper-wave.webm', still: '/mascots/juniper-wave-still.webp' },
  },
  pip: {
    key: 'pip',
    name: 'Pip',
    kind: 'Chickadee',
    species: 'Black-capped chickadee',
    speciesColor: '#24456B',
    description: 'Small and cheerful. The friendly one who is happy about every booking, however short.',
    tint: '#DCE8F5',
    label: 'Pip, a round chickadee with a black cap and bib, waving a wing and wearing a gold key',
    wave: { video: '/mascots/chickadee-wave.webm', still: '/mascots/chickadee-wave-still.webp' },
  },
};

/** The text alternative for a character. */
export function guideLabel(character: GuideCharacter): string {
  return GUIDES[character].label;
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
