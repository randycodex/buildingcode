export function notebookReferenceBlocks(reference, passages = []) {
  return [
    { type: "paragraph", content: [{ type: "permitextReference", props: { ...reference } }] },
    ...(Array.isArray(passages) ? passages : []).flatMap(passage => {
      const text = String(passage?.exact || "").trim();
      return text ? [{ type: "paragraph", content: [{ type: "text", text, styles: {} }] }] : [];
    })
  ];
}
