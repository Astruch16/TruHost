import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@truhost/api-client';
import { Button } from './button';
import { ConfirmDialog } from './dialog';
import { Field } from './field';
import { Input } from './input';
import { Select } from './select';
import { TableState } from './table';

describe('Field', () => {
  it('labels its control and announces the error', () => {
    render(
      <Field label="Postal code" error="Expected a Canadian postal code" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Postal code/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Expected a Canadian postal code');
  });

  it('uses the hint as the description when there is no error', () => {
    render(
      <Field label="Role" hint="What they can do">
        <Select value="CLEANER" onValueChange={() => undefined} options={[{ value: 'CLEANER', label: 'Cleaner' }]} />
      </Field>,
    );
    const select = screen.getByLabelText('Role');
    expect(select).toHaveRole('combobox');
    expect(select).not.toHaveAttribute('aria-invalid');
    expect(select).toHaveAccessibleDescription('What they can do');
  });
});

describe('Select', () => {
  const options = [
    { value: 'CLEANER', label: 'Cleaner' },
    { value: 'OWNER', label: 'Owner' },
    { value: 'ADMIN', label: 'Admin', disabled: true },
  ];

  it('opens a styled listbox and reports the chosen value', async () => {
    const onValueChange = vi.fn();
    render(<Select aria-label="Role" value="CLEANER" onValueChange={onValueChange} options={options} />);
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveTextContent('Cleaner');
    await userEvent.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    expect(listbox.closest('.rounded-inner')).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Cleaner' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Admin' })).toHaveAttribute('data-disabled');
    await userEvent.click(screen.getByRole('option', { name: 'Owner' }));
    expect(onValueChange).toHaveBeenCalledWith('OWNER');
  });

  it('works from the keyboard', async () => {
    const onValueChange = vi.fn();
    render(<Select aria-label="Role" value="CLEANER" onValueChange={onValueChange} options={options} />);
    screen.getByRole('combobox').focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('OWNER');
  });

  it('shows the placeholder until something is chosen', () => {
    render(
      <Select
        aria-label="Plan"
        value=""
        onValueChange={() => undefined}
        options={options}
        placeholder="Choose a plan"
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Choose a plan');
  });

  it('supports an empty option such as "No default"', async () => {
    const onValueChange = vi.fn();
    render(
      <Select
        aria-label="Default cleaner"
        value=""
        onValueChange={onValueChange}
        options={[{ value: '', label: 'No default' }, ...options]}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('No default');
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Owner' }));
    expect(onValueChange).toHaveBeenCalledWith('OWNER');
  });
});

describe('Button', () => {
  it('blocks clicks and reports busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('ConfirmDialog', () => {
  const error = new ApiError(409, {
    type: 'about:blank',
    title: 'Conflict',
    status: 409,
    code: 'X',
    detail: 'Could not archive',
  });

  it('is an accessible modal that confirms, cancels and shows errors', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Archive Cedar Suite?"
        description="It will be hidden."
        confirmLabel="Archive"
        destructive
        pending={false}
        error={error}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Archive Cedar Suite?' })).toHaveAccessibleDescription(
      'It will be hidden.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not archive');
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cannot be dismissed while the action is running', async () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Archive?"
        description="d"
        confirmLabel="Archive"
        pending
        error={null}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('TableState', () => {
  const wrap = (ui: React.ReactNode) =>
    render(
      <table>
        <tbody>{ui}</tbody>
      </table>,
    );

  it('renders loading, error and empty rows, and nothing once there is data', () => {
    const { rerender } = wrap(<TableState columns={2} loading error={null} empty={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    rerender(
      <table>
        <tbody>
          <TableState columns={2} loading={false} error={new Error('x')} empty={false} />
        </tbody>
      </table>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(
      <table>
        <tbody>
          <TableState columns={2} loading={false} error={null} empty emptyMessage="None" />
        </tbody>
      </table>,
    );
    expect(screen.getByText('None')).toBeInTheDocument();
    rerender(
      <table>
        <tbody>
          <TableState columns={2} loading={false} error={null} empty={false} />
        </tbody>
      </table>,
    );
    expect(screen.queryByRole('row')).toBeNull();
  });
});

describe('ErrorAlert and LoadError', () => {
  const problem = (status: number, detail: string) =>
    new ApiError(status, { type: 'about:blank', title: 'x', status, code: 'X', detail });

  it('shows actionable problem details and user-facing upload errors', async () => {
    const { ErrorAlert } = await import('./alert');
    const { UploadError } = await import('../../lib/upload');
    const { rerender } = render(<ErrorAlert error={problem(409, 'These dates overlap another booking')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('These dates overlap another booking');
    rerender(<ErrorAlert error={new UploadError('Files can be at most 20 MB.')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Files can be at most 20 MB.');
  });

  it('never shows server or framework text for other failures', async () => {
    const { ErrorAlert } = await import('./alert');
    const { rerender } = render(<ErrorAlert error={problem(404, 'Cannot GET /v1/dashboard?month=2026-10')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Cannot GET');
    rerender(<ErrorAlert error={problem(500, 'TypeError: x is undefined')} />);
    expect(screen.getByRole('alert')).not.toHaveTextContent('TypeError');
    rerender(<ErrorAlert error={new TypeError('Failed to fetch')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    rerender(<ErrorAlert error={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers a retry for failed loads', async () => {
    const { LoadError } = await import('./alert');
    const onRetry = vi.fn();
    render(<LoadError what="the dashboard" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load the dashboard.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
