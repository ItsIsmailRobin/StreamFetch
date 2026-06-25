import { writeFileSync } from "node:fs";

const TARGET_URL = "https://fifalive.click/play";

function extractStreamUrl(html) {
  const wrapperBlock = html.match(/<div\s+id=["']vjs-wrapper["'][\s\S]*?<\/div>/i)?.[0] ?? html;
  const sourceMatch = wrapperBlock.match(/<source[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  return sourceMatch?.[1]?.trim() ?? "";
}

async function run() {
  const response = await fetch(TARGET_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const streamUrl = extractStreamUrl(html);

  if (!streamUrl) {
    throw new Error("Could not find <source src=\"...\"> URL in response HTML.");
  }

  const checkedAt = new Date().toISOString();

  writeFileSync("Stream.txt", `${streamUrl}\n`, "utf8");
  writeFileSync("stream.txt", `${streamUrl}\n`, "utf8");
  writeFileSync("public/Stream.txt", `${streamUrl}\n`, "utf8");
  writeFileSync("public/stream.txt", `${streamUrl}\n`, "utf8");
  writeFileSync("LastCheck.txt", `${checkedAt}\n`, "utf8");
  writeFileSync("public/LastCheck.txt", `${checkedAt}\n`, "utf8");
  console.log(`Stream URL updated: ${streamUrl}`);
  console.log(`Heartbeat updated: ${checkedAt}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});