import { describe, expect, it } from "vitest";
import { embedSnippet, relatedMarkets } from "./related";

describe("related markets and embeds", () => {
  const markets = [
    { slug: "fed", topic: "Economics", question: "Fed", probability: 0.6 },
    { slug: "cpi", topic: "Economics", question: "CPI", probability: 0.4 },
    { slug: "eth", topic: "Crypto", question: "ETH", probability: 0.2 },
    { slug: "spx", topic: "Economics", question: "SPX", probability: 0.5 },
  ];

  it("keeps the same topic and drops the market you are already on", () => {
    expect(relatedMarkets({ slug: "fed", topic: "Economics" }, markets).map((market) => market.slug)).toEqual(["cpi", "spx"]);
  });

  it("builds an iframe that points at the embed route", () => {
    expect(embedSnippet("https://desk.example/", "fed-cuts")).toContain('src="https://desk.example/embed/fed-cuts"');
    expect(embedSnippet("https://desk.example", "a b")).toContain("/embed/a%20b");
  });
});
