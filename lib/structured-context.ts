export interface ContextField {
  key: string;
  label: string;
  kind: 'list' | 'text' | 'dates';
  hint: string;
}

export interface StructuredContext {
  domain: 'LEGAL' | 'PHARMA';
  pack_id: string;
  pack_version: string;
  schema_id: string;
  revision: number;
  saved: boolean;
  updated_at: string | null;
  fields: ContextField[];
  values: Record<string, string | string[]>;
}

export interface ContextSnapshot {
  schema_id: string;
  domain: 'LEGAL' | 'PHARMA';
  pack_id: string;
  pack_version: string;
  updated_at: string;
  values: Record<string, string | string[]>;
}

export function contextDraft(value: StructuredContext) {
  return Object.fromEntries(
    value.fields.map((field) => {
      const saved = value.values[field.key];
      return [field.key, Array.isArray(saved) ? saved.join('\n') : saved || ''];
    }),
  );
}

export function contextValues(
  fields: ContextField[],
  draft: Record<string, string>,
) {
  const result: Record<string, string | string[]> = Object.fromEntries(
    fields.map((field) => {
      const text = (draft[field.key] || '').trim();
      if (field.kind === 'text') {
        if (text.length > 240)
          throw new Error(`${field.label}: use at most 240 characters.`);
        return [field.key, text];
      }
      const values = [
        ...new Set(
          text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
        ),
      ];
      if (values.length > 30 || values.some((item) => item.length > 240))
        throw new Error(
          `${field.label}: use up to 30 lines, 240 characters each.`,
        );
      if (
        field.kind === 'dates' &&
        values.some((item) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(item) || item.startsWith('0000'))
            return true;
          const date = new Date(item + 'T00:00:00Z');
          return (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== item
          );
        })
      )
        throw new Error(`${field.label}: use real dates in YYYY-MM-DD format.`);
      return [field.key, values];
    }),
  );
  if (
    Object.values(result)
      .flat()
      .reduce((total, item) => total + item.length, 0) > 12000
  )
    throw new Error(
      'Keep the combined dossier subject details within 12,000 characters.',
    );
  return result;
}
