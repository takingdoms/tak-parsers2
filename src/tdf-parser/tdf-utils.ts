import { Json } from "../common";
import { TdfSection } from "./tdf-types";

export interface TdfJsonConfig {
  useBracketsOnSectionNames: boolean;
}

export const DEFAULT_TDF_JSON_CONFIG: TdfJsonConfig = {
  useBracketsOnSectionNames: true,
};

function _toJson(tdf: TdfSection, config: TdfJsonConfig): Json {
  const result: Json = {};

  for (const [fieldKey, fieldValue] of Object.entries(tdf.fields)) {
    result[fieldKey] = fieldValue;
  }

  for (const [sectionName, subSection] of Object.entries(tdf.sections)) {
    const key = config.useBracketsOnSectionNames
      ? `[${sectionName}]`
      : sectionName;

    if (key in result) {
      throw new Error(`Current section already has a key named "${key}".`);
    }

    result[key] = _toJson(subSection, config);
  }

  return result;
}

function toJson(tdf: TdfSection, config?: Partial<TdfJsonConfig>): Json {
  const actualConfig = {
    ...DEFAULT_TDF_JSON_CONFIG,
    ...config,
  };

  return _toJson(tdf, actualConfig);
}

function fromJson(json: Json): TdfSection {
  console.log(json);
  throw 'TODO';
}

export const TdfJsonUtils = {
  toJson,
  fromJson,
};
