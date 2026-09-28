import { describe, expect, it } from "vitest";
import { embedUrl } from "./content";

describe("intégration vidéo", () => {
  it("YouTube et Vimeo, rien d'autre", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=abcDEF12345")).toBe(
      "https://www.youtube-nocookie.com/embed/abcDEF12345",
    );
    expect(embedUrl("https://youtu.be/abcDEF12345")).toBe(
      "https://www.youtube-nocookie.com/embed/abcDEF12345",
    );
    expect(embedUrl("https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
    expect(embedUrl("https://evil.example/watch?v=x")).toBeNull();
    expect(embedUrl("javascript:alert(1)")).toBeNull();
  });
});
