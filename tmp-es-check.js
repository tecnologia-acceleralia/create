const fs = require('fs');
const text = fs.readFileSync('frontend/src/i18n/locales/es.json', 'utf8');
let depth = 0;
let inString = false;
let escape = false;
const stack = [];
const ops = [];
for (let i = 0; i < text.length; i++) {
  const ch = text[i];
  if (inString) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
    } else if (ch === '"') {
      inString = false;
    }
  } else {
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      stack.push(i);
      depth++;
      ops.push({ type: 'open', pos: i, depth });
    } else if (ch === '}') {
      if (stack.length === 0) {
        ops.push({ type: 'unexpected-close', pos: i, depth });
      } else {
        const openPos = stack.pop();
        depth--;
        ops.push({ type: 'close', pos: i, depth, openPos });
      }
    }
  }
}
console.log('Final depth', depth);
console.log('Remaining stack', stack);
console.log('Last operations:', ops.slice(-10));
