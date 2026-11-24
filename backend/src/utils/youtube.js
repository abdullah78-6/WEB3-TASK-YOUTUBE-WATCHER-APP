const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extracts an 11-character YouTube video ID from a URL or raw ID.
 * Returns null if the input is not a valid YouTube link or ID.
 */
function extractYouTubeVideoId(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(normalized);
    const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && VIDEO_ID_REGEX.test(id) ? id : null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com") {
      const vParam = url.searchParams.get("v");
      if (vParam && VIDEO_ID_REGEX.test(vParam)) return vParam;

      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length >= 2 && ["embed", "shorts", "live", "v"].includes(segments[0])) {
        return VIDEO_ID_REGEX.test(segments[1]) ? segments[1] : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

module.exports = { extractYouTubeVideoId };
