import { test, expect } from "bun:test";
import register from "./index.js";

test("register is a function", () => {
  expect(typeof register).toBe("function");
});
