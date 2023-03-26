import { TdfParser, TdfParserError, TdfSection } from "./tdf-types";

export interface TdfStringParserConfig {
  allowRootFields: boolean;
  autoTrimValueString: boolean;
  allowNameOverrides: boolean;
}

export const DEFAULT_TDF_STRING_PARSER_CONFIG: TdfStringParserConfig = {
  allowRootFields: false,
  autoTrimValueString: true,
  allowNameOverrides: false,
};

enum ParserContext {
  /** in root or inside { } */
  Body,
  /** inside [ ] */
  SectionNameStart,
  /** after ] but before { */
  SectionNameEnd,
  /** name of field started */
  FieldKeyStart,
  /**
   * name of field ended aka whitespace detected. can be completely skipped if there's no
   * whitespace between the key name and the =
   */
  FieldKeyEnd,
  /** characters after = but before ; */
  FieldValueStart,
  /** after the ; */
  // FieldValueEnd,
}

const SECTION_NAME_REGEX = /^[A-Za-z0-9_]*$/;
const KEY_NAME_REGEX = /^[A-Za-z0-9_]*$/;

function _parseTree(source: string, config: TdfStringParserConfig): TdfSection | TdfParserError {
  const rootSection: TdfSection = { fields: {}, sections: {} };

  let row = -1, col = -1;
  let nextRow = 1, nextCol = 1;

  let ctx: ParserContext = ParserContext.Body;
  let isInComment = false;
  let sectionStack: TdfSection[] = [rootSection];
  let currentSectionName = '';
  let currentField: { key: string; value: string; } | undefined;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const nextChar = i < source.length - 1 ? source[i + 1] : null;
    const isWhitespace = /\s/.test(char);
    const isLineBreak = char === '\n';
    const isCommentStarter = char === '/' && nextChar === '/';

    const currentSection = sectionStack[sectionStack.length - 1];
    const isInRoot = sectionStack.length === 1;

    row = nextRow;
    col = nextCol;

    if (isLineBreak) {
      nextCol = 1;
      nextRow = row + 1;

      if (isInComment) {
        isInComment = false;
        continue;
      }
    } else {
      nextCol = col + 1;
    }

    if (isInComment) {
      continue;
    }

    if (isCommentStarter) {
      isInComment = true;
    }

    if (ctx === ParserContext.Body) {
      if (isWhitespace || isCommentStarter) {
        continue;
      }

      if (char === '[') {
        currentSectionName = '';

        ctx = ParserContext.SectionNameStart;
        continue;
      }

      if (char === '}') {
        if (isInRoot) {
          return { row, col, pos: i, reason: `Nothing to close: ${char}` };
        }

        sectionStack.pop();
        continue;
      }

      if (KEY_NAME_REGEX.test(char)) {
        if (isInRoot && !config.allowRootFields) {
          return { row, col, pos: i, reason: `Can't add fields to the root.` };
        }

        currentField = { key: char, value: '' };
        ctx = ParserContext.FieldKeyStart;
        continue;
      }

      return { row, col, pos: i, reason: `Unexpected character: ${char}` };
    }
    else if (ctx === ParserContext.SectionNameStart) {
      if (isCommentStarter) {
        return { row, col, pos: i, reason: `Cannot start a comment here.` };
      }

      if (isWhitespace) {
        if (currentSectionName !== '') {
          return { row, col, pos: i, reason: `Cannot have whitespace inside section header name.` };
        }

        continue;
      }

      if (SECTION_NAME_REGEX.test(char)) {
        currentSectionName += char;
        continue;
      }

      if (char === ']') {
        if (!config.allowNameOverrides) {
          const alreadyExists = currentSectionName in currentSection.sections;
          if (alreadyExists) {
            return { row, col, pos: i, reason: `A section with name "${currentSectionName}"` +
              ` already exists inside the current parent.` };
          }
        }

        const newSection: TdfSection = { fields: {}, sections: {} };
        currentSection.sections[currentSectionName] = newSection;
        sectionStack.push(newSection);

        ctx = ParserContext.SectionNameEnd;
        continue;
      }

      return { row, col, pos: i, reason: `Unexpected character: ${char}` };
    }
    else if (ctx === ParserContext.SectionNameEnd) {
      if (isWhitespace || isCommentStarter) {
        continue;
      }

      if (char === '{') {
        ctx = ParserContext.Body;
        continue;
      }

      return { row, col, pos: i, reason: `Unexpected character: ${char}` };
    }
    else if (ctx === ParserContext.FieldKeyStart) {
      if (isCommentStarter) {
        return { row, col, pos: i, reason: `Cannot start a comment here.` };
      }

      if (isWhitespace) {
        ctx = ParserContext.FieldKeyEnd;
        continue;
      }

      if (!currentField) {
        return { row, col, pos: i, reason: `Unknown error.` };
      }

      if (char === '=') {
        ctx = ParserContext.FieldValueStart;
        continue;
      }

      if (KEY_NAME_REGEX.test(char)) {
        currentField.key += char;
        continue;
      }

      return { row, col, pos: i, reason: `Unexpected character: ${char}` };
    }
    else if (ctx === ParserContext.FieldKeyEnd) {
      if (isCommentStarter) {
        return { row, col, pos: i, reason: `Cannot start a comment here.` };
      }

      if (isWhitespace) {
        continue;
      }

      if (char === '=') {
        ctx = ParserContext.FieldValueStart;
        continue;
      }

      if (KEY_NAME_REGEX.test(char)) {
        return { row, col, pos: i, reason: `Field keys cannot have whitespace.` +
          ` Trying to add char after whitespace: ${char}` };
      }

      return { row, col, pos: i, reason: `Unexpected character: ${char}` };
    }
    else if (ctx === ParserContext.FieldValueStart) {
      if (isCommentStarter) {
        return { row, col, pos: i, reason: `Cannot start a comment here.` };
      }

      if (!currentField) {
        return { row, col, pos: i, reason: `Unknown error.` };
      }

      if (char === ';') {
        if (config.autoTrimValueString) {
          currentField.value = currentField.value.trim();
        }

        if (!config.allowNameOverrides) {
          const alredyExists = currentField.key in currentSection.fields;
          if (alredyExists) {
            return { row, col, pos: i, reason: `A key with name "${currentField.key}"` +
              ` already exists inside the current section.` };
          }
        }

        currentSection.fields[currentField.key] = currentField.value;
        currentField = undefined;

        // ctx = ParserContext.FieldValueEnd;
        ctx = ParserContext.Body;
        continue;
      }

      if (isLineBreak) {
        return { row, col, pos: i, reason: `Missing ";" before line end.` };
      }

      currentField.value += char;
      continue;
    }
    /*else if (ctx === ParserContext.FieldValueEnd) {
      if (isWhitespace || isCommentStarter) {
        continue;
      }

      if (isLineBreak) {
        ctx = ParserContext.Body;
        continue;
      }

      return { row, col, pos: i, reason: `Unexpected character: ${char}` };
    }*/

    return { row, col, pos: i, reason: `Unknown error.` };
  }

  return rootSection;
}

function parseTree(source: string, config?: Partial<TdfStringParserConfig>):
  TdfSection | TdfParserError
{
  const actualConfig = {
    ...DEFAULT_TDF_STRING_PARSER_CONFIG,
    ...config,
  };

  return _parseTree(source, actualConfig);
}

export const TdfStringParser = {
  parseTree,
};
