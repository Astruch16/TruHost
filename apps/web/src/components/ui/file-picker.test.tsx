import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatBytes, splitName } from '../../lib/format';
import { Field } from './field';
import { FilePicker } from './file-picker';

function Picker() {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Field label="Receipt" hint="PDF or photo, up to 20 MB.">
      <FilePicker file={file} onChange={setFile} accept="application/pdf" />
    </Field>
  );
}

describe('FilePicker', () => {
  it('shows a separate button and "No file chosen", and is labelled by its field', () => {
    render(<Picker />);
    expect(screen.getByText('Choose file')).toBeInTheDocument();
    expect(screen.getByText('No file chosen')).toBeInTheDocument();
    const input = screen.getByLabelText('Receipt');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'application/pdf');
    expect(input).toHaveAccessibleDescription('PDF or photo, up to 20 MB.');
  });

  it('shows the chosen file’s name and size, and can remove it', async () => {
    const u = userEvent.setup();
    render(<Picker />);
    const pdf = new File([new Uint8Array(48 * 1024)], 'costco-receipt.pdf', { type: 'application/pdf' });
    await u.upload(screen.getByLabelText('Receipt'), pdf);
    expect(screen.getByTitle('costco-receipt.pdf')).toHaveTextContent('costco-receipt.pdf');
    expect(screen.getByText('48 KB')).toBeInTheDocument();
    expect(screen.getByText('Change')).toBeInTheDocument();
    expect(screen.queryByText('No file chosen')).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Remove costco-receipt.pdf' }));
    expect(screen.getByText('No file chosen')).toBeInTheDocument();
    expect((screen.getByLabelText('Receipt') as HTMLInputElement).value).toBe('');
  });
});

describe('formatBytes', () => {
  it.each([
    [820, '820 B'],
    [1024, '1 KB'],
    [49_152, '48 KB'],
    [3.4 * 1024 * 1024, '3.4 MB'],
    [20 * 1024 * 1024, '20 MB'],
  ])('%d → %s', (bytes, text) => expect(formatBytes(bytes)).toBe(text));
});

describe('splitName', () => {
  it.each([
    ['costco-receipt.pdf', ['costco-receipt', '.pdf']],
    ['IMG_2041.HEIC', ['IMG_2041', '.HEIC']],
    ['no-extension', ['no-extension', '']],
    ['.hidden', ['.hidden', '']],
    ['archive.tar.backup-copy', ['archive.tar.backup-copy', '']],
  ] as const)('%s', (name, parts) => expect(splitName(name)).toEqual(parts));
});
