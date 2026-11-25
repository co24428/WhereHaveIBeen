import { expect, it } from "vitest";
import en from "./en.json";
import ko from "./ko.json";

function keys(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

it("en and ko have the same message keys", () => {
  expect(keys(ko).sort()).toEqual(keys(en).sort());
});
