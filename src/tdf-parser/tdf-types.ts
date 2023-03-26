export interface TdfSection {
  // name: string;
  fields: Record<string, string>;
  sections: Record<string, TdfSection>;
}

export interface TdfParser<TSource> {
  parseTree: (source: TSource) => TdfSection | TdfParserError;
}

export interface TdfParserError {
  reason: string;
  row: number;
  col: number;
  pos: number;
}

export function isTdfParserError(result: TdfSection | TdfParserError): result is TdfParserError {
  return 'reason' in result;
}
