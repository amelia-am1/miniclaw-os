import { describe, it, expect } from "vitest";
import { htmlToText } from "./client.js";

describe("htmlToText", () => {
  it("extracts readable text from HTML-only email body", () => {
    const html =
      "<html><body><h1>Welcome</h1><p>This is an <b>HTML-only</b> email.</p></body></html>";
    const result = htmlToText(html);
    expect(result).toBeTruthy();
    expect(result).toContain("Welcome");
    expect(result).toContain("HTML-only");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("decodes HTML entities", () => {
    const html = "<p>A &amp; B &lt; C &gt; D &quot;E&quot; F&#39;s &nbsp; end</p>";
    const result = htmlToText(html);
    expect(result).toContain("A & B");
    expect(result).toContain("< C >");
    expect(result).toContain('"E"');
    expect(result).toContain("F's");
  });

  it("strips style blocks before tag removal", () => {
    const html = [
      "<html><head><style>body { color: red; font-family: Arial; }</style></head>",
      "<body><p>Visible content only</p></body></html>",
    ].join("");
    const result = htmlToText(html);
    expect(result).toContain("Visible content");
    expect(result).not.toContain("color: red");
    expect(result).not.toContain("font-family");
  });

  it("strips script blocks", () => {
    const html =
      '<body><script>alert("xss")</script><p>Safe text</p></body>';
    const result = htmlToText(html);
    expect(result).toContain("Safe text");
    expect(result).not.toContain("alert");
  });

  it("handles complex multipart HTML with CSS and entities", () => {
    const html = `
      <html>
      <head>
        <style>
          .header { background: #f0f0f0; padding: 20px; }
          .content { font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header"><h1>Newsletter</h1></div>
        <div class="content">
          <p>Hello &amp; welcome to our Q1 update.</p>
          <p>Revenue grew &gt; 20% &mdash; a great result.</p>
          <p>&copy; 2026 Acme Corp&trade;</p>
        </div>
        <script>trackOpen();</script>
      </body>
      </html>
    `;
    const result = htmlToText(html);
    expect(result).toContain("Newsletter");
    expect(result).toContain("Hello & welcome");
    expect(result).toContain("> 20%");
    expect(result).toContain("—");
    expect(result).toContain("© 2026 Acme Corp™");
    expect(result).not.toContain("background");
    expect(result).not.toContain("trackOpen");
    expect(result).not.toContain("<");
  });

  it("decodes numeric character references", () => {
    const html = "<p>&#65;&#66;&#67; and &#x41;&#x42;&#x43;</p>";
    const result = htmlToText(html);
    expect(result).toContain("ABC");
  });

  it("returns empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });
});
