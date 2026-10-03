const fs = require("fs");

const validFiles = ["config.sample.json", "published-config.json", "config.json"].filter(fs.existsSync);

for (const file of validFiles) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data.version) throw new Error(`${file}: version is required`);
  if (!Number.isInteger(data.updateIntervalMinutes) || data.updateIntervalMinutes < 1) {
    throw new Error(`${file}: updateIntervalMinutes must be >= 1`);
  }
  if (!Number.isInteger(data.slideDurationSeconds) || data.slideDurationSeconds < 3) {
    throw new Error(`${file}: slideDurationSeconds must be >= 3`);
  }
  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    throw new Error(`${file}: slides must not be empty`);
  }
  for (const slide of data.slides) {
    if (!Number.isInteger(slide.order)) throw new Error(`${file}: slide.order is required`);
    if (!slide.fileName || !/\.(png|jpe?g|webp)$/i.test(slide.fileName)) {
      throw new Error(`${file}: slide.fileName must have valid image extension (.png, .jpg, .jpeg, .webp), got: ${slide.fileName}`);
    }
    if (!slide.url || !slide.url.startsWith("https://")) {
      throw new Error(`${file}: slide.url must be https`);
    }
    if (slide.durationSeconds !== undefined && (!Number.isInteger(slide.durationSeconds) || slide.durationSeconds < 1)) {
      throw new Error(`${file}: slide.durationSeconds must be a positive integer if specified`);
    }
  }
  console.log(`✅ ${file}: ok (${data.slides.length} slides, version: ${data.version})`);
}
