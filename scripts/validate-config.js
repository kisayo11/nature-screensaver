const fs = require("fs");

for (const file of ["config.sample.json", "published-config.json"].filter(fs.existsSync)) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data.version) throw new Error(`${file}: version is required`);
  if (!Number.isInteger(data.updateIntervalMinutes) || data.updateIntervalMinutes < 5) {
    throw new Error(`${file}: updateIntervalMinutes must be >= 5`);
  }
  if (!Number.isInteger(data.slideDurationSeconds) || data.slideDurationSeconds < 5) {
    throw new Error(`${file}: slideDurationSeconds must be >= 5`);
  }
  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    throw new Error(`${file}: slides must not be empty`);
  }
  for (const slide of data.slides) {
    if (!Number.isInteger(slide.order)) throw new Error(`${file}: slide.order is required`);
    if (!slide.fileName || !slide.fileName.endsWith(".png")) throw new Error(`${file}: slide.fileName must be .png`);
    if (!slide.url || !slide.url.startsWith("https://")) throw new Error(`${file}: slide.url must be https`);
  }
  console.log(`${file}: ok`);
}
