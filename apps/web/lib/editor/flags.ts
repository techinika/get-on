/** The v5 editor is opt-in until every screen has moved over. */
export function editorV3Enabled(): boolean {
  return process.env.EDITOR_V3 === "true";
}
