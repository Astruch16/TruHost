import type { Me, Onboarding, OnboardingRole, OnboardingTour } from '@truhost/shared';

/**
 * The welcome tours (docs/spec.md, Phase 4b): what each role's tour shows, step by step. Steps point at real screens:
 * `page` is where the step is shown and `anchor` the element it highlights (its `data-tour` attribute). A step whose
 * element isn't on screen shows centred, without a highlight, unless it is `optional`, when it is passed over (a card
 * that only appears with data, such as Coming up). Content only: the API records progress, and the copy describes
 * only what exists.
 */

export interface TourPage {
  to: string;
  params?: Record<string, string>;
}

export interface TourStep {
  id: string;
  /** Where the step is shown. Null: the step doesn't apply to this person (e.g. no property to show). */
  page?: (me: Me) => TourPage | null;
  anchor?: string;
  optional?: boolean;
  title: string;
  body: string;
}

export interface TourDefinition {
  /** "your owner portal": what the welcome says it will show. */
  portal: string;
  /** What the tour covers, listed on the welcome screen. */
  chapters: { title: string; detail: string }[];
  steps: TourStep[];
}

const at = (to: string) => () => ({ to });

/** The first property this person cleans, for the cleaner tour's property page. */
const cleanerPage = (me: Me): TourPage | null => {
  const m = me.memberships.find((x) => x.role === 'CLEANER');
  return m ? { to: '/cleaner/properties/$propertyId', params: { propertyId: m.property.id } } : null;
};

const help: Omit<TourStep, 'page'> = {
  id: 'help',
  anchor: 'profile-menu',
  title: 'Help is always here',
  body: 'Your profile, settings and guide live in this menu. Open Help from it to replay this tour or find quick answers, any time.',
};

export const TOURS: Record<OnboardingRole, TourDefinition> = {
  ADMIN: {
    portal: 'TruHost',
    chapters: [
      { title: 'Your dashboard', detail: 'The month across every property, and what needs attention' },
      { title: 'Properties and bookings', detail: 'Rooms, plans, stays and payouts' },
      { title: 'Expenses and statements', detail: 'Receipts, and each owner’s monthly statement' },
      { title: 'Your team', detail: 'Inviting owners, cleaners and other admins' },
    ],
    steps: [
      {
        id: 'dashboard',
        page: at('/admin'),
        anchor: 'dashboard-month',
        title: 'Your dashboard',
        body: 'The month across every property: gross revenue, TruPlan fees earned, nights booked and average nightly earnings. Use the arrows to look at other months.',
      },
      {
        id: 'switcher',
        page: at('/admin'),
        anchor: 'property-switcher',
        title: 'One property, or all of them',
        body: 'The switcher narrows the admin pages to one property. Choose “All properties” to see the whole portfolio again.',
      },
      {
        id: 'quick-actions',
        page: at('/admin'),
        anchor: 'quick-actions',
        optional: true,
        title: 'Quick actions',
        body: 'Add a booking, an expense or a receipt straight from the dashboard.',
      },
      {
        id: 'attention',
        page: at('/admin'),
        anchor: 'needs-attention',
        optional: true,
        title: 'Needs attention',
        body: 'Stays waiting on a payout, expenses missing a receipt, properties without a plan and invites not yet accepted. Each one takes you to where it’s fixed.',
      },
      {
        id: 'calendar',
        page: at('/admin/calendar'),
        anchor: 'page-header',
        title: 'Calendar',
        body: 'Every stay across your properties, month by month, coloured by where the guest booked.',
      },
      {
        id: 'properties',
        page: at('/admin/properties'),
        anchor: 'page-header',
        title: 'Properties',
        body: 'Each property’s details and photos, its rooms, its management plan, and its default cleaner and fees. The rooms set the order of the cleaner’s photo checklist.',
      },
      {
        id: 'bookings',
        page: at('/admin/bookings'),
        anchor: 'page-header',
        title: 'Bookings',
        body: 'Enter each stay with its payout and cleaning fee. Nights, the owner’s gross and the TruPlan fee are always worked out for you, so you never type a total.',
      },
      {
        id: 'expenses',
        page: at('/admin/expenses'),
        anchor: 'page-header',
        title: 'Expenses and receipts',
        body: 'Record what was spent, whether the owner or TruHost pays it, and attach the receipt.',
      },
      {
        id: 'statements',
        page: at('/admin/statements'),
        anchor: 'page-header',
        title: 'Owner statements',
        body: 'One statement per property each month. Review the draft, finalize it to lock that month, then release it when the payout is sent. Owners see it once it’s released.',
      },
      {
        id: 'supplies',
        page: at('/admin/supplies'),
        anchor: 'page-header',
        title: 'Supplies',
        body: 'Stock levels at each property, as the cleaners report them, and what needs restocking.',
      },
      {
        id: 'damage',
        page: at('/admin/damage'),
        anchor: 'page-header',
        title: 'Damage',
        body: 'Reports from cleaners and the team, with photos as evidence, from the first report to the claim.',
      },
      {
        id: 'team',
        page: at('/admin/team'),
        anchor: 'page-header',
        title: 'Your team',
        body: 'Invite owners, cleaners and other admins. Everyone signs in with their own account, sees only what their role allows, and gets this same welcome.',
      },
      {
        id: 'plans',
        page: at('/admin/plans'),
        anchor: 'page-header',
        title: 'Plans',
        body: 'The management plans, their fee rates, and which plan each property is on.',
      },
      { ...help, page: at('/admin') },
    ],
  },
  OWNER: {
    portal: 'your owner portal',
    chapters: [
      { title: 'Your month', detail: 'What you earned and where it went' },
      { title: 'Your home page', detail: 'The year so far, supplies, and what’s coming up' },
      { title: 'Your calendar', detail: 'Every stay, and your share of each' },
      { title: 'Statements', detail: 'The record of each month’s payout' },
      { title: 'Damage and care', detail: 'What happens at your property, with photos' },
    ],
    steps: [
      {
        id: 'month',
        page: at('/owner'),
        anchor: 'owner-month',
        title: 'Your month at a glance',
        body: 'Net to you is what you keep after the management fee and expenses. A released month shows its final statement; the current month is an estimate that firms up as stays are booked and paid. Use the arrows to see other months.',
      },
      {
        id: 'figures',
        page: at('/owner'),
        anchor: 'owner-figures',
        optional: true,
        title: 'Where it comes from',
        body: 'Gross revenue is what guests paid, less their cleaning fees. The TruPlan fee is TruHost’s share of it, and expenses are what was paid from your earnings. Beside them: nights booked, and the change on the month before.',
      },
      {
        id: 'switcher',
        page: (me) => (me.memberships.filter((m) => m.role === 'OWNER').length > 1 ? { to: '/owner' } : null),
        anchor: 'property-switcher',
        title: 'Your properties',
        body: 'Switch between your properties here, or choose “All properties” to see them together. Every page follows your choice.',
      },
      {
        id: 'this-month',
        page: at('/owner'),
        anchor: 'owner-this-month',
        title: 'This month so far',
        body: 'An estimate of this month’s net to you from the stays booked, with the nights already stayed, still to come and still open, and when the statement will be ready.',
      },
      {
        id: 'year',
        page: at('/owner'),
        anchor: 'owner-ytd',
        title: 'The year so far',
        body: 'Your year from released statements, so every figure is final: net to you, nights booked, occupancy and average nightly earnings.',
      },
      {
        id: 'net-by-month',
        page: at('/owner'),
        anchor: 'owner-net-by-month',
        title: 'Net to you by month',
        body: 'Each month side by side: released statements, and this month so far, so you can see how the year is going.',
      },
      {
        id: 'supplies',
        page: at('/owner'),
        anchor: 'owner-supplies',
        title: 'Supplies',
        body: 'How stocked your property is, from the cleaners’ last check. What’s running low is flagged, and TruHost restocks it.',
      },
      {
        id: 'coming-up',
        page: at('/owner'),
        anchor: 'owner-coming-up',
        optional: true,
        title: 'Coming up',
        body: 'The next stays at your property, with their dates and nights, your own stays included.',
      },
      {
        id: 'good-to-know',
        page: at('/owner'),
        anchor: 'owner-good-to-know',
        optional: true,
        title: 'Good to know',
        body: 'What was paid from your earnings lately, and any corrections on your statements, each with its receipt or statement one tap away.',
      },
      {
        id: 'contact',
        page: at('/owner'),
        anchor: 'owner-contact',
        title: 'Questions?',
        body: 'Write to TruHost about anything at your property. Every message is read.',
      },
      {
        id: 'calendar',
        page: at('/owner/calendar'),
        anchor: 'owner-calendar',
        title: 'Your calendar',
        body: 'Every stay of the month, coloured by where the guest booked, with your own stays and blocked dates. Step through months with the arrows, and tap a stay to see its nights and your share of it.',
      },
      {
        id: 'glance',
        page: at('/owner/calendar'),
        anchor: 'owner-glance',
        title: 'The month at a glance',
        body: 'The same stays as a list: each one’s dates, nights, and your share of it this month. Tap one for its details.',
      },
      {
        id: 'statements',
        page: at('/owner/statements'),
        anchor: 'owner-statements',
        title: 'Your statements',
        body: 'Each month’s statement appears here once TruHost releases the payout: net to you, and a PDF for your records. Open one to see every stay, fee and expense behind it.',
      },
      {
        id: 'damage',
        page: at('/owner/damage'),
        anchor: 'owner-damage',
        title: 'Damage reports',
        body: 'Damage found at your property after a stay, with photos, and how each claim with the booking site is going. You’re emailed when something is reported.',
      },
      {
        id: 'care',
        page: at('/owner/care'),
        anchor: 'owner-care',
        title: 'Care',
        body: 'Before-and-after photos from every clean, room by room, once cleans are recorded in TruHost.',
      },
      { ...help, page: at('/owner') },
    ],
  },
  CLEANER: {
    portal: 'TruHost',
    chapters: [
      { title: 'Your schedule', detail: 'Today’s cleans, and your week' },
      { title: 'The photo checklist', detail: 'Every room, before and after' },
      { title: 'Supplies and damage', detail: 'Marking levels, and reporting what you find' },
      { title: 'Your properties', detail: 'Where you clean, and each one’s details' },
    ],
    steps: [
      {
        id: 'schedule',
        page: at('/cleaner'),
        anchor: 'cleaner-schedule',
        title: 'Your schedule',
        body: 'Today’s cleans, with when the place is free and when it must be ready for the next guests. Open one on its day to start it: a checklist takes you through photos of every room as you find it, any damage, a stock count, photos once it’s clean, then finishing, which tells TruHost and the owner. Below is your week, a day to a column: step through the weeks, or narrow it to one property.',
      },
      {
        id: 'calendar',
        page: at('/cleaner'),
        anchor: 'cleaner-calendar',
        optional: true,
        title: 'Your month',
        body: 'Each day you clean is marked, in each property’s colour. Pick a day to jump your week to it.',
      },
      {
        id: 'properties',
        page: at('/properties'),
        anchor: 'page-header',
        title: 'Your properties',
        body: 'These are the properties you clean. Open one to see its supplies, rooms and details.',
      },
      {
        id: 'property',
        page: cleanerPage,
        anchor: 'page-header',
        title: 'A property’s page',
        body: 'Everything you need at this property, in one place.',
      },
      {
        id: 'supplies',
        page: cleanerPage,
        anchor: 'cleaner-supplies',
        title: 'Supplies',
        body: 'Mark how full each supply is as you go. TruHost is told when something runs low, and restocks it.',
      },
      {
        id: 'damage',
        page: cleanerPage,
        anchor: 'cleaner-damage',
        title: 'Report damage',
        body: 'Found something broken or stained? Report it with photos. Each photo is timestamped, so it counts as evidence.',
      },
      {
        id: 'cleans',
        page: cleanerPage,
        anchor: 'cleaner-cleans',
        title: 'Your cleans here',
        body: 'Your next cleans at this property. Each one opens its photo checklist.',
      },
      {
        id: 'rooms',
        page: cleanerPage,
        anchor: 'cleaner-rooms',
        title: 'Rooms',
        body: 'The rooms in the order you’ll photograph them, before and after each clean.',
      },
      { ...help, page: (me) => cleanerPage(me) ?? { to: '/properties' } },
    ],
  },
};

/** The steps that apply to this person (a step whose page is null is left out). */
export function tourSteps(role: OnboardingRole, me: Me): (TourStep & { target: TourPage | null })[] {
  return TOURS[role].steps.flatMap((s): (TourStep & { target: TourPage | null })[] => {
    if (!s.page) return [{ ...s, target: null }];
    const target = s.page(me);
    return target ? [{ ...s, target }] : [];
  });
}

/** The tour to welcome someone to now: the first one still offered (admin, then owner, then cleaner). */
export function offeredTour(onboarding: Onboarding | undefined): OnboardingTour | null {
  return onboarding?.tours.find((t) => t.offer) ?? null;
}

/** "the owner tour", for Help. */
export const tourName = (role: OnboardingRole) =>
  role === 'ADMIN' ? 'the admin tour' : role === 'OWNER' ? 'the owner tour' : 'the cleaner tour';
