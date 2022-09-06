import { DMMF } from '@prisma/generator-helper';

export interface Model {
  fields: Record<string, string | null>;
  name?: string | null;
  hasMap: boolean;
}

export interface Models {
  [key: string]: Model;
}

export interface Element {
  name: string;
  arrayArg?: string[];
  params?: Record<string, unknown>;
}

export interface ExtendedField extends DMMF.Field {
  columnName?: string;
}

export interface ExtendedModel extends DMMF.Model {
  elements?: Element[];
}
