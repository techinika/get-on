import { beforeEach, describe, expect, it } from "vitest";
import { compileStyles, createNode, defaultSmartProps, emptyPage, findNode } from "@get-on/blocks";
import { useEditorStore } from "../lib/editor/v5-store";

function reset() {
  const content = emptyPage();
  useEditorStore.setState({
    content,
    savedContent: content,
    selectedId: "page",
    past: [],
    future: [],
    saveState: "saved",
    revision: 0,
    leftOpen: true,
    rightOpen: true,
    mode: "edit",
  });
}

describe("editor v5 store", () => {
  beforeEach(reset);

  it("inserts a node at the page and selects it", () => {
    const id = useEditorStore.getState().insert("heading");
    expect(id).toBeTruthy();
    const content = useEditorStore.getState().content;
    expect(content.root.children).toHaveLength(1);
    expect(useEditorStore.getState().selectedId).toBe(id);
    expect(findNode(content.root, id!)?.props?.text).toBe("Your heading");
  });

  it("inserts into an empty container when it is selected", () => {
    const section = useEditorStore.getState().insert("section");
    const heading = useEditorStore.getState().insert("heading");
    const content = useEditorStore.getState().content;
    const sectionNode = findNode(content.root, section!);
    expect(sectionNode?.children?.map((node) => node.id)).toEqual([heading]);
  });

  it("undoes and redoes in one history", () => {
    useEditorStore.getState().insert("text");
    expect(useEditorStore.getState().content.root.children).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().content.root.children).toHaveLength(0);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().content.root.children).toHaveLength(1);
  });

  it("stores styles as data and compiles them", () => {
    const id = useEditorStore.getState().insert("heading")!;
    useEditorStore.getState().updateStyles(id, "base", "color", "{text}");
    useEditorStore.getState().updateStyles(id, "phone", "font-size", "20px");
    const node = findNode(useEditorStore.getState().content.root, id);
    expect(node?.styles?.base?.color).toBe("{text}");
    const compiled = compileStyles(useEditorStore.getState().content.root);
    expect(compiled.css).toContain("color:var(--s-text)");
    expect(compiled.css).toContain("@container site (max-width:639px)");
  });

  it("removes a node and cannot remove the page root", () => {
    const id = useEditorStore.getState().insert("divider")!;
    useEditorStore.getState().remove(id);
    expect(useEditorStore.getState().content.root.children).toHaveLength(0);
    useEditorStore.getState().remove("page");
    expect(useEditorStore.getState().content.root.id).toBe("page");
  });

  it("moves siblings up and down", () => {
    const first = useEditorStore.getState().insert("heading")!;
    const second = useEditorStore.getState().insert("text")!;
    useEditorStore.getState().moveSibling(first, 1);
    expect(useEditorStore.getState().content.root.children?.map((node) => node.id)).toEqual([second, first]);
  });

  it("duplicates a subtree with fresh ids", () => {
    const section = useEditorStore.getState().insert("section")!;
    useEditorStore.getState().insert("heading");
    useEditorStore.getState().duplicate(section);
    const children = useEditorStore.getState().content.root.children ?? [];
    expect(children).toHaveLength(2);
    expect(children[0].id).not.toBe(children[1].id);
    expect(children[1].children?.[0].id).not.toBe(children[0].children?.[0].id);
  });

  it("inserts a whole pattern as one undo step", () => {
    const nodes = ["hero", "features", "cta"].map((kind) => createNode("smart", defaultSmartProps(kind)));
    useEditorStore.getState().insertNodesAt(nodes);
    expect(useEditorStore.getState().content.root.children?.map((node) => node.props?.kind)).toEqual([
      "hero",
      "features",
      "cta",
    ]);
    expect(useEditorStore.getState().past).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().content.root.children).toHaveLength(0);
  });

  it("adds a smart section from the registry defaults", () => {
    useEditorStore.getState().insertSmart("hero");
    const node = useEditorStore.getState().content.root.children?.[0];
    expect(node?.type).toBe("smart");
    expect(node?.props?.kind).toBe("hero");
  });
});
