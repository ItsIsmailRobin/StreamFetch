import { writeFileSync } from "node:fs";

const TARGET_URL = "https://fifalive.click/play";
const REQUEST_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "cache-control": "no-cache",
  pragma: "no-cache",
};

function extractStreamUrl(html) {
  const wrapperBlock = html.match(/<div\s+id=["']vjs-wrapper["'][\s\S]*?<\/div>/i)?.[0] ?? html;
  const sourceMatch = wrapperBlock.match(/<source[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  return sourceMatch?.[1]?.trim() ?? "";
}

function toAbsolutePlaylist(playlistContent, playlistUrl) {
  return playlistContent
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return trimmed;
      }
      return new URL(trimmed, playlistUrl).toString();
    })
    .join("\n")
    .concat("\n");
}

function resolveFirstVariantUrl(masterPlaylistContent, masterPlaylistUrl) {
  const lines = masterPlaylistContent.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;

    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next || next.startsWith("#")) continue;
      return new URL(next, masterPlaylistUrl).toString();
    }
  }
  return "";
}

async function buildCompatiblePlaylist(streamUrl) {
  const response = await fetch(streamUrl, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch source m3u8: ${response.status} ${response.statusText}`);
  }

  const firstPlaylist = await response.text();
  const hasVariants = /#EXT-X-STREAM-INF/i.test(firstPlaylist);

  if (!hasVariants) {
    return toAbsolutePlaylist(firstPlaylist, streamUrl);
  }

  const variantUrl = resolveFirstVariantUrl(firstPlaylist, streamUrl);
  if (!variantUrl) {
    throw new Error("Source master m3u8 has no variant URL.");
  }

  const variantResponse = await fetch(variantUrl, { headers: REQUEST_HEADERS });
  if (!variantResponse.ok) {
    throw new Error(`Failed to fetch variant m3u8: ${variantResponse.status} ${variantResponse.statusText}`);
  }

  const variantPlaylist = await variantResponse.text();
  return toAbsolutePlaylist(variantPlaylist, variantUrl);
}

async function run() {
  const response = await fetch(TARGET_URL, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const streamUrl = extractStreamUrl(html);

  if (!streamUrl) {
    throw new Error("Could not find <source src=\"...\"> URL in response HTML.");
  }

  const checkedAt = new Date().toISOString();
  const m3u8Content = await buildCompatiblePlaylist(streamUrl);

  writeFileSync("Stream.txt", `${streamUrl}\n`, "utf8");
  writeFileSync("stream.txt", `${streamUrl}\n`, "utf8");
  writeFileSync("public/Stream.txt", `${streamUrl}\n`, "utf8");
  writeFileSync("public/stream.txt", `${streamUrl}\n`, "utf8");
  writeFileSync("stream.m3u8", m3u8Content, "utf8");
  writeFileSync("public/stream.m3u8", m3u8Content, "utf8");
  writeFileSync("LastCheck.txt", `${checkedAt}\n`, "utf8");
  writeFileSync("public/LastCheck.txt", `${checkedAt}\n`, "utf8");
  console.log(`Stream URL updated: ${streamUrl}`);
  console.log("Generated compatible media playlist for stream.m3u8");
  console.log(`Heartbeat updated: ${checkedAt}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});