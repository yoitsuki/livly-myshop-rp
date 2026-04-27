export function formatDate(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day} ${hh}:${mm}`;
}

/** "YYYY-MM-DDTHH:MM" string for <input type="datetime-local"> */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(ms - tzOffset).toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): number {
  return new Date(value).getTime();
}
