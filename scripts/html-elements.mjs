import { parse } from "parse5";

// Read the HTML element tree, including template contents. Script text is never
// interpreted as markup and no source is rewritten or used as sanitized HTML.
export function elementIds(html) {
  const ids = [];
  function visit(node) {
    const id = node.attrs?.find((attribute) => attribute.name === "id");
    if (id) ids.push(id.value);
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  }
  visit(parse(html));
  return ids;
}
