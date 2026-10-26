export type AiHistoryChange = {
  label: string;
  before: string;
  after: string;
};

export type AiHistoryPayload = {
  input?: unknown;
  output?: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function slotLabel(id: string): string {
  const field = id.split(":").pop()?.split(".").pop() ?? id;
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function parseSlots(value: unknown): Array<{ id: string; text: string }> {
  let slots: unknown = value;
  if (typeof value === "string") {
    try {
      slots = (JSON.parse(value) as { slots?: unknown }).slots;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(slots)) return [];
  return slots
    .map((slot) => record(slot))
    .filter((slot) => typeof slot.id === "string")
    .map((slot) => ({ id: String(slot.id), text: text(slot.text) }));
}

function blockSummary(value: unknown): string {
  const blocks = Array.isArray(value) ? value : [];
  return blocks
    .map((block) => {
      const props = record(record(block).props);
      const heading = text(props.heading) || text(props.title) || text(props.text);
      return heading ? heading : text(record(block).type);
    })
    .filter(Boolean)
    .join(" · ");
}

export function templateFillSlots(value: unknown): Array<{ id: string; text: string }> {
  return parseSlots(value);
}

export function historyChanges(
  task: string,
  payload: AiHistoryPayload,
): AiHistoryChange[] {
  const input = record(payload.input);
  const output = record(payload.output);

  if (task === "template.fill") {
    const before = parseSlots(input.existingText);
    const after = parseSlots(record(output.data).slots ?? output.data);
    const afterById = new Map(after.map((slot) => [slot.id, slot.text]));
    return before.map((slot) => ({
      label: slotLabel(slot.id),
      before: slot.text,
      after: afterById.get(slot.id) ?? "",
    }));
  }

  if (
    task === "text.write" ||
    task === "text.improve" ||
    task === "list.expand" ||
    task === "seo.write" ||
    task === "profile.write" ||
    task === "design.suggest" ||
    task === "tips.fix" ||
    task === "alt.describe"
  ) {
    return [
      {
        label: task === "alt.describe" ? "Picture description" : "Text",
        before: text(input.existingText),
        after: text(output.text),
      },
    ];
  }

  if (task === "page.generate" || task === "section.generate") {
    return [
      {
        label: "Sections",
        before: text(input.existingText) || "New content",
        after: blockSummary(record(output.data).blocks ?? output.data),
      },
    ];
  }

  if (task === "image.generate") {
    return [{ label: "Picture", before: "No picture", after: "Picture created" }];
  }

  if (task === "template.generate") {
    return [
      {
        label: "Template",
        before: "New template",
        after: text(record(output.data).name) || "Template created",
      },
    ];
  }

  return [];
}

export function isUndoableTask(task: string): boolean {
  return task === "template.fill";
}

export function wasUndone(steps: unknown): boolean {
  return Array.isArray(steps)
    ? steps.some((step) => record(step).type === "undo")
    : false;
}
