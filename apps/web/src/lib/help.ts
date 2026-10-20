import type { OnboardingRole } from '@truhost/shared';

/** Short "How do I…" answers in Help, per role (static for now; docs/spec.md, Phase 4b). */
export const HELP_ANSWERS: Record<OnboardingRole, { q: string; a: string }[]> = {
  ADMIN: [
    {
      q: 'How do I add a property?',
      a: 'Go to Properties and choose New property. Then add its rooms, put it on a plan, and set its default cleaner and fees.',
    },
    {
      q: 'How do I enter a booking?',
      a: 'Choose Add booking on the dashboard or the Bookings page. Enter the dates, where the guest booked, the payout and the cleaning fee. Nights and every total are worked out for you.',
    },
    {
      q: 'How do I invite an owner, a cleaner or a teammate?',
      a: 'Go to Team, fill in “Invite someone” and choose Send invite. They get an email, create their account with that address, and are welcomed with their own tour.',
    },
    {
      q: 'How do I send an owner their statement?',
      a: 'Open Statements and review the month’s draft. Finalize statement locks the month; Release payout, once the money is sent, makes it visible to the owner with a PDF.',
    },
  ],
  OWNER: [
    {
      q: 'What is “net to you”?',
      a: 'Gross revenue (what guests paid, less their cleaning fees), minus TruHost’s management fee and any expenses paid from your earnings.',
    },
    {
      q: 'When does my statement arrive?',
      a: 'Early the following month, once TruHost has released the payout. It appears under Statements, with a PDF for your records.',
    },
    {
      q: 'How do I see a receipt?',
      a: 'Expenses on your home page and on your statements have a View receipt link.',
    },
    {
      q: 'How do I change my details or notifications?',
      a: 'Open Settings from the menu: Profile for your name and phone number, Notifications for what TruHost tells you about.',
    },
  ],
  CLEANER: [
    {
      q: 'How do I update supplies?',
      a: 'Open the property and, under Supplies, mark how full each one is. TruHost is told when something runs low.',
    },
    {
      q: 'How do I report damage?',
      a: 'Open the property and choose Report damage. Add photos and a short description of what you found.',
    },
    {
      q: 'Where is my cleaning schedule?',
      a: 'Your cleans and the room-by-room photo checklist will appear on each property’s page.',
    },
    {
      q: 'How do I add my phone number?',
      a: 'Open Settings from the menu, then Profile.',
    },
  ],
};
