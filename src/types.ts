import { DMMF } from '@prisma/generator-helper';

export interface Model {
  relationFields?: Record<string, string | null>;
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
  isField?: string; // for fields
  stringParams?: string; // for fields
}

export interface FieldMeta {
  dbTypes: string[];
  relationOnUpdate?: string;
}

export interface Elements {
  elements: Element[];
  fields: Record<string, FieldMeta>;
}

export interface ExtendedField extends DMMF.Field {
  columnName?: string;
}

export interface ExtendedModel extends DMMF.Model {
  elementsParent?: Elements;
}
