import type { ProfileConfig } from './contracts';

export interface TemplateReference {
  id: string;
  version: string;
}
export interface DossierTemplate extends TemplateReference {
  schema_id: string;
  domain: 'LEGAL' | 'PHARMA';
  pack_id: string;
  pack_version: string;
  context_schema_id: string;
  title: string;
  description: string;
  sector: string;
  goal: string;
  context_fields: { key: string; label: string }[];
  questions: string[];
  selected_at?: string;
}
export interface TemplateState {
  available: boolean;
  saved: boolean;
  selection: DossierTemplate | null;
}
export interface TemplateCatalogue {
  domain: string;
  items: DossierTemplate[];
}
export const templateKey = (value: TemplateReference | null | undefined) =>
  value ? `${value.id}@${value.version}` : '';
export const templateReference = (
  value: TemplateReference | null,
): TemplateReference | null =>
  value ? { id: value.id, version: value.version } : null;

/** A deliberate starter action fills empty fields only; preserve all user input. */
export function templateStarter(
  config: ProfileConfig,
  template: DossierTemplate,
): ProfileConfig {
  return {
    ...config,
    sector: config.sector.trim() ? config.sector : template.sector,
    goal: config.goal.trim() ? config.goal : template.goal,
  };
}
