// Mengemas pglite.data menjadi modul JS (base64), karena hosting artifact tidak menyajikan file .data.
import fs from "node:fs";
const src = new URL("../node_modules/@electric-sql/pglite/dist/pglite.data", import.meta.url);
const out = new URL("./generated/pglite-data.js", import.meta.url);
fs.mkdirSync(new URL("./generated/", import.meta.url), { recursive: true });
fs.writeFileSync(out, `export default "${fs.readFileSync(src).toString("base64")}";\n`);
console.log("pglite-data.js ditulis");
