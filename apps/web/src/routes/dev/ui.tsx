import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { Building2, Plus } from 'lucide-react';
import { ApiError } from '@truhost/api-client';
import { AppShell } from '../../components/shell/app-shell';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { Input, Select, Textarea } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { Pill } from '../../components/ui/pill';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../../components/ui/table';
import { navItems } from '../../lib/nav';

/**
 * Dev-only style guide: the shell with sample data and every component in every state. Not served in production
 * builds. Sample names here are placeholders, not real data.
 */
export const Route = createFileRoute('/dev/ui')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: StyleGuide,
});

const sampleProperties = [
  { id: 'a', name: 'Cedar Suite', city: 'Chilliwack', province: 'BC' },
  { id: 'b', name: 'Lakeview Cabin', city: 'Cultus Lake', province: 'BC' },
  { id: 'c', name: 'Garden Loft', city: 'Chilliwack', province: 'BC' },
];

const sampleError = new ApiError(409, {
  type: 'about:blank',
  title: 'Conflict',
  status: 409,
  code: 'PLAN_RATE_LOCKED',
  detail: 'This plan is in use; create a new plan to change the rate',
});

function StyleGuide() {
  const [selected, setSelected] = useState('a');
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const nav = navItems({ staffRole: 'ADMIN', memberships: [{}] }).map((item, i) =>
    i === 1 ? { ...item, badge: 2 } : item,
  );

  return (
    <AppShell
      nav={nav}
      user={{ name: 'Sample Admin', initials: 'SA', role: 'Admin', email: 'admin@example.test' }}
      properties={sampleProperties}
      selectedPropertyId={selected}
      onSelectProperty={setSelected}
      unreadNotifications={1}
      onSignOut={() => undefined}
      onManageSignIn={() => undefined}
    >
      <PageHeader
        eyebrow="Style guide"
        title="Components"
        description="Every core component and state, built from the design tokens."
        actions={
          <Button>
            <Plus aria-hidden className="size-4" /> Primary action
          </Button>
        }
      />
      <div className="flex flex-col gap-5">
        <Card title="Buttons" description="Primary, secondary, quiet and danger; default, disabled and loading.">
          <div className="flex flex-col gap-3">
            {(['primary', 'secondary', 'quiet', 'danger'] as const).map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-2">
                <Button variant={variant}>{variant[0]!.toUpperCase() + variant.slice(1)}</Button>
                <Button variant={variant} disabled>
                  Disabled
                </Button>
                <Button variant={variant} loading>
                  Saving
                </Button>
                <Button variant={variant} size="sm">
                  Small
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Pills">
          <div className="flex flex-wrap gap-2">
            <Pill tone="dark">Out</Pill>
            <Pill tone="lavender">Low</Pill>
            <Pill tone="sage">Stocked</Pill>
            <Pill tone="blue">Open</Pill>
            <Pill tone="neutral">Archived</Pill>
            <Pill tone="danger">Overdue</Pill>
          </div>
        </Card>

        <Card title="Form fields">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Property name" hint="Internal nickname" required>
              <Input placeholder="e.g. Cedar Suite" />
            </Field>
            <Field label="Postal code" error="Expected a Canadian postal code" required>
              <Input defaultValue="12345" />
            </Field>
            <Field label="Role">
              <Select defaultValue="CLEANER">
                <option value="CLEANER">Cleaner</option>
                <option value="OWNER">Owner</option>
              </Select>
            </Field>
            <Field label="Disabled">
              <Input value="adam@example.test" disabled readOnly />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea placeholder="Parking and building entry" />
            </Field>
          </div>
        </Card>

        <Card title="Table" description="Rows highlight on hover; loading, error and empty states below.">
          <Table>
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Vendor</Th>
                <Th>Category</Th>
                <Th align="right">Amount</Th>
              </tr>
            </THead>
            <TBody>
              <Tr interactive>
                <Td>Oct 2</Td>
                <Td>Sample Wholesale</Td>
                <Td>
                  <Pill tone="lavender">Supplies</Pill>
                </Td>
                <Td align="right">$41.99</Td>
              </Tr>
              <Tr interactive>
                <Td>Oct 4</Td>
                <Td>Sample Hardware</Td>
                <Td>
                  <Pill tone="blue">Repairs</Pill>
                </Td>
                <Td align="right">$22.19</Td>
              </Tr>
            </TBody>
          </Table>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {[
              { label: 'Loading', props: { loading: true, error: null, empty: false } },
              { label: 'Error', props: { loading: false, error: sampleError, empty: false } },
              { label: 'Empty', props: { loading: false, error: null, empty: true } },
            ].map(({ label, props }) => (
              <Card key={label} inner title={label}>
                <Table>
                  <TBody>
                    <TableState columns={1} {...props} />
                  </TBody>
                </Table>
              </Card>
            ))}
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Empty state">
            <EmptyState icon={Building2} title="No properties yet" action={<Button>New property</Button>}>
              Add the first property to start tracking bookings and cleans.
            </EmptyState>
          </Card>
          <Card title="Dialogs and errors">
            <div className="flex flex-col gap-3">
              <ErrorAlert error={sampleError} />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setDialog(true)}>
                  Open dialog
                </Button>
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  Confirm dialog
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Edit room"
        description="Rooms appear in the cleaner’s photo checklist."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialog(false)}>Save</Button>
          </>
        }
      >
        <Field label="Room name">
          <Input defaultValue="Primary bedroom" />
        </Field>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Archive Cedar Suite?"
        description="It will be hidden from lists. Owners keep access to its history."
        confirmLabel="Archive property"
        destructive
        pending={false}
        error={sampleError}
        onConfirm={() => setConfirm(false)}
      />
    </AppShell>
  );
}
