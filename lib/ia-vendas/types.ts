export type Data = Record<string, any>;
export type Operation = {
  entity: string;
  kind: "create" | "update" | "delete";
  id: string;
  values: Data;
  before: Data | null;
  after?: Data | null;
  label: string;
};
export type Action = {
  id: string;
  restaurant_id: string;
  conversation_id: string;
  message_id?: string;
  title: string;
  reason: string;
  status: string;
  operations: Operation[];
  attempts: number;
  claimed_at?: string;
  error?: string;
  image?: Data;
  image_jobs?: Data[];
  generated_actions?: string[];
  created_at: string;
  applied_at?: string;
  undone_at?: string;
  baseline?: Data;
};
export type Message = {
  id: string;
  role: string;
  content: string;
  cards: Data[];
  attachments?: Data[];
  created_at: string;
};
export class SalesError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function object(value: unknown): Data {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SalesError("Dados inválidos.");
  return value as Data;
}
export function stable(v: any): string {
  return JSON.stringify(
    v instanceof Date
      ? v.toISOString()
      : Array.isArray(v)
        ? v.map((x) => JSON.parse(stable(x)))
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.keys(v)
                .sort()
                .map((k) => [k, JSON.parse(stable(v[k]))]),
            )
          : (v ?? null),
  );
}
export const same = (a: any, b: any) => stable(a) === stable(b);
