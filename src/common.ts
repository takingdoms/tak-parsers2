type JsonValue = Json | string | number | boolean | null;

export type Json = {[key: string]: JsonValue | JsonValue[]};
