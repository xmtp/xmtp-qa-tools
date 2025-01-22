import { describe, test, expect } from "vitest";
import { lookup } from "../src/index";

describe("Client Private Key Configuration Tests", () => {
  test("lookup address", async () => {
    //ENS lookup
    let data = await lookup("vitalik.eth");
    expect(data?.address?.toLowerCase()).toBe(
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045".toLowerCase(),
    );

    //ENS reverse lookup
    data = await lookup("0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204");
    expect(data?.ensDomain?.toLowerCase()).toBe("humanagent.eth".toLowerCase());

    //Website lookup
    data = await lookup("https://messagekit.ephemerahq.com/");
    expect(data?.address?.toLowerCase()).toBe(
      "0x93e2fc3e99dfb1238eb9e0ef2580efc5809c7204".toLowerCase(),
    );

    //Converse username lookup
    data = await lookup("@fabri");
    expect(data?.address?.toLowerCase()).toBe(
      "0x93e2fc3e99dfb1238eb9e0ef2580efc5809c7204".toLowerCase(),
    );
  }, 25000); // Added 15 second timeout
});
