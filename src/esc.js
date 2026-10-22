/* Escapowanie tekstu przed wstawieniem do HTML — bez zależności, żeby moduły czystej logiki
 * (ulubione, pogoda) dało się testować w Node bez klienta Supabase. */

/** Escapowanie tekstu przed wstawieniem do HTML (treść oraz atrybuty w cudzysłowie lub apostrofie). */
export function esc(value) {
  return (value == null ? '' : String(value)).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
