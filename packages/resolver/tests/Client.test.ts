import { describe, test, expect } from "vitest";
import { resolve } from "../src/index";

describe("Client Private Key Configuration Tests", () => {
  test("resolve address", async () => {
    const address = await resolve("vitalik.eth");
    expect(address?.address?.toLowerCase()).toBe(
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045".toLowerCase(),
    );
  }, 25000); // Added 15 second timeout
});
