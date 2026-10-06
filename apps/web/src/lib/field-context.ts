import { createContext, useContext } from 'react';

/** Lets <Input>/<Select>/<Textarea> inside a <Field> pick up its id, description and error wiring. */
export interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export const useFieldContext = () => useContext(FieldContext);
