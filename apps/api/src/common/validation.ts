import type { ValidationError } from "class-validator";

export function errorsByField(
  errors: ValidationError[],
  parent = "",
): Record<string, string[]> {
  return errors.reduce<Record<string, string[]>>((result, error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    if (messages.length) result[field] = messages;
    Object.assign(result, errorsByField(error.children ?? [], field));
    return result;
  }, {});
}
