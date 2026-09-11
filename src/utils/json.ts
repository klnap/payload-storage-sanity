import * as v from 'valibot'

export type JsonPrimitive = string | number | boolean | null
export type JsonArray = JsonValue[]
export type JsonObject = { [key: string]: JsonValue | undefined }
export type JsonValue = JsonPrimitive | JsonArray | JsonObject

export function asJsonObject(value: JsonValue | undefined): JsonObject | null {
  if (
    value != null &&
    !Array.isArray(value) &&
    !v.is(v.string(), value) &&
    !v.is(v.number(), value) &&
    !v.is(v.boolean(), value)
  ) {
    // SAFETY: value is a non-null, non-array, non-primitive JSON value conforming to JsonObject
    return value as JsonObject
  }
  return null
}

export function parseJsonText(text: string): JsonValue | null {
  try {
    // SAFETY: JSON.parse output matches JsonValue union
    return JSON.parse(text) as JsonValue
  } catch {
    return null
  }
}
