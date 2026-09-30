/**
 * Serialize structured data safely inside an HTML <script> element.
 * JSON.stringify alone leaves `</script>` unescaped, which lets stored content
 * terminate the script tag when a user-controlled value reaches JSON-LD.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
