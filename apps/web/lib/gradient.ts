/** Deterministic gradient per project (spec §5 thumbnail, §6 step 6 mock). */
const GRADIENTS: [string, string][] = [
  ["#F5A524", "#E8743B"],
  ["#0B6B4F", "#3DBE8B"],
  ["#6D5DD3", "#A18BFF"],
  ["#E8743B", "#F5A524"],
];

export function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function gradientFor(id: string): string {
  const [from, to] = GRADIENTS[hashString(id) % GRADIENTS.length]!;
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
