import { DMMF } from '@prisma/generator-helper';

export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export enum IgnoreType {
  Fields = 'fields',
  Model = 'model'
}

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
  rawParams?: string[];
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

export interface ExtendedField extends DeepWriteable<DMMF.Field> {
  columnName?: string;
}

export interface ExtendedModel extends DeepWriteable<DMMF.Model> {
  elementsParent?: Elements;
}

export interface ExtendedEnum extends DeepWriteable<DMMF.DatamodelEnum> {
  elementsParent?: Elements;
}
