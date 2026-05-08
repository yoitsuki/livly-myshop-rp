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

/** "YYYY-MM-DD" string for <input type="date"> ( v0.27.17 ) 。
 *  時間不明モードの確認日時で使う。 datetime-local string の冒頭 10 文字
 *  と同じなので toLocalInput(ms).slice(0, 10) と等価だが、 読み手のため
 *  に名前を付けている。 */
export function toLocalDateInput(ms: number): string {
  return toLocalInput(ms).slice(0, 10);
}

/** "YYYY-MM-DD" → 当日のローカル 00:00 の epoch ms ( v0.27.17 ) 。
 *  `new Date("YYYY-MM-DD")` は ECMAScript 仕様で UTC midnight として
 *  parse されるので、 時刻 portion を `T00:00` 付けて local parse に
 *  寄せる。 */
export function fromLocalDateInput(value: string): number {
  return new Date(`${value}T00:00`).getTime();
}
