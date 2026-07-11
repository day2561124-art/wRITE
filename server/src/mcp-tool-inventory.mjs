const definitionsMarker = "const toolDefinitions = [";
const registryMarker = "const toolRegistry = new Map";

function isIdentifierCharacter(character) {
  return /[A-Za-z0-9_$]/u.test(character ?? "");
}

function readQuotedString(source, start) {
  const quote = source[start];
  let value = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      const next = source[index + 1];
      if (next === undefined) return null;
      value += next;
      index += 1;
      continue;
    }
    if (character === quote) return { value, end: index + 1 };
    value += character;
  }
  return null;
}

function skipWhitespace(source, start) {
  let index = start;
  while (/\s/u.test(source[index] ?? "")) index += 1;
  return index;
}

export function extractDirectMcpToolNames(source) {
  const start = source.indexOf(definitionsMarker);
  const end = source.indexOf(registryMarker, start);
  if (start < 0 || end < 0) return null;

  const inventorySource = source.slice(
    start + definitionsMarker.length - 1,
    end,
  );
  const names = [];
  let squareDepth = 0;
  let braceDepth = 0;
  let state = "code";
  let stringQuote = null;

  for (let index = 0; index < inventorySource.length; index += 1) {
    const character = inventorySource[index];
    const next = inventorySource[index + 1];

    if (state === "line-comment") {
      if (character === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state === "string" || state === "template") {
      if (character === "\\") {
        index += 1;
        continue;
      }
      if (
        (state === "string" && character === stringQuote)
        || (state === "template" && character === "`")
      ) {
        state = "code";
        stringQuote = null;
      }
      continue;
    }

    if (character === "/" && next === "/") {
      state = "line-comment";
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      state = "block-comment";
      index += 1;
      continue;
    }
    if (character === "'" || character === '"') {
      state = "string";
      stringQuote = character;
      continue;
    }
    if (character === "`") {
      state = "template";
      continue;
    }

    if (character === "[") squareDepth += 1;
    else if (character === "]") squareDepth -= 1;
    else if (character === "{") braceDepth += 1;
    else if (character === "}") braceDepth -= 1;

    if (
      squareDepth !== 1
      || braceDepth !== 1
      || !inventorySource.startsWith("name", index)
      || isIdentifierCharacter(inventorySource[index - 1])
      || isIdentifierCharacter(inventorySource[index + 4])
    ) continue;

    let cursor = skipWhitespace(inventorySource, index + 4);
    if (inventorySource[cursor] !== ":") continue;
    cursor = skipWhitespace(inventorySource, cursor + 1);
    if (inventorySource[cursor] !== '"' && inventorySource[cursor] !== "'") {
      continue;
    }
    const parsed = readQuotedString(inventorySource, cursor);
    if (!parsed) return null;
    names.push(parsed.value);
    index = parsed.end - 1;
  }

  return names;
}
