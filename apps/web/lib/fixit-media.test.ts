import assert from "node:assert/strict";
import test from "node:test";
import { formatBytes, mediaSlotError, remainingMediaSlots } from "./fixit-media.ts";

test("a file size reads in the unit a person would use", () => {
  assert.equal(formatBytes(0), "0 KB");
  assert.equal(formatBytes(900), "900 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
  assert.equal(formatBytes(1.5 * 1024 * 1024), "1.5 MB");
});

test("a nonsense size never prints NaN at a customer", () => {
  assert.equal(formatBytes(Number.NaN), "0 KB");
  assert.equal(formatBytes(-5), "0 KB");
});

test("the slots run out at eight photos and one video", () => {
  const photos = Array.from({ length: 8 }, () => ({ kind: "photo" as const }));
  assert.deepEqual(remainingMediaSlots([]), { photos: 8, videos: 1 });
  assert.deepEqual(remainingMediaSlots(photos), { photos: 0, videos: 1 });
  assert.deepEqual(remainingMediaSlots([...photos, { kind: "video" as const }]), {
    photos: 0,
    videos: 0,
  });
});

test("adding past a limit is refused with a reason, not silently dropped", () => {
  const full = Array.from({ length: 8 }, () => ({ kind: "photo" as const }));
  assert.equal(mediaSlotError([], { type: "application/pdf" }), "Please choose a photo or a video.");
  assert.match(mediaSlotError(full, { type: "image/png" })!, /photos already/);
  const withVideo = [{ kind: "video" as const }];
  assert.match(mediaSlotError(withVideo, { type: "video/mp4" })!, /One video per job/);
  // A photo is still welcome when only the video slot is used up.
  assert.equal(mediaSlotError(withVideo, { type: "image/png" }), null);
});
