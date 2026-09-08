import assert from "node:assert/strict";
import { test } from "node:test";
import { elementIds } from "./html-elements.mjs";

test("script text is not markup and valid spaced end tags resume parsing", () => {
  assert.deepEqual(elementIds('<script id="loader">const x = \'<div id="fake">\';</script ><main id="real"></main>'), ["loader", "real"]);
});

test("HTML entity and attribute syntax variations preserve duplicate identifiers", () => {
  assert.deepEqual(elementIds('<div id="a&amp;b"></div><span ID=\'a&b\'></span><!-- <i id="fake"> -->'), ["a&b", "a&b"]);
});
