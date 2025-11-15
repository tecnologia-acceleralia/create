const fs = require("fs");
const path = require("path");

const locales = ["es", "ca"];

locales.forEach(locale => {
  const filePath = path.join("frontend", "src", "i18n", "locales", `${locale}.json`);
  let text = fs.readFileSync(filePath, "utf8");
  text = text.replace(/}\s*\r?\n\s*"profile"/m, "},\n  \"profile\"");
  const data = JSON.parse(text);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
});
