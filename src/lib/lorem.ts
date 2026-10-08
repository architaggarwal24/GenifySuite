const WORDS = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor " +
  "incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud " +
  "exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute " +
  "irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur " +
  "excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt " +
  "mollit anim id est laborum"
).split(" ");

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function buildSentence(): string {
  const length = 6 + Math.floor(Math.random() * 10);
  const words: string[] = [];
  for (let i = 0; i < length; i++) words.push(pick(WORDS));
  let sentence = words.join(" ");
  // occasional comma clause for natural rhythm
  if (length > 10) {
    const commaPos = 3 + Math.floor(Math.random() * (length - 6));
    const parts = sentence.split(" ");
    parts[commaPos] += ",";
    sentence = parts.join(" ");
  }
  return capitalize(sentence) + ".";
}

function buildParagraph(sentenceCount: number): string {
  const sentences: string[] = [];
  for (let i = 0; i < sentenceCount; i++) sentences.push(buildSentence());
  return sentences.join(" ");
}

export type LoremUnit = "words" | "sentences" | "paragraphs";

export function generateLorem(unit: LoremUnit, count: number, startClassic: boolean): string {
  const n = Math.max(1, Math.min(count, unit === "words" ? 500 : unit === "sentences" ? 60 : 20));

  if (unit === "words") {
    const words: string[] = [];
    if (startClassic) words.push("Lorem", "ipsum", "dolor", "sit", "amet,");
    while (words.length < n) words.push(pick(WORDS));
    return capitalize(words.slice(0, n).join(" ")).replace(/[,;:.]+$/, "") + ".";
  }

  if (unit === "sentences") {
    const sentences: string[] = [];
    if (startClassic) sentences.push("Lorem ipsum dolor sit amet, consectetur adipiscing elit.");
    while (sentences.length < n) sentences.push(buildSentence());
    return sentences.slice(0, n).join(" ");
  }

  // paragraphs
  const paragraphs: string[] = [];
  for (let i = 0; i < n; i++) {
    const sentenceCount = 4 + Math.floor(Math.random() * 4);
    let paragraph = buildParagraph(sentenceCount);
    if (i === 0 && startClassic) {
      paragraph = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + paragraph;
    }
    paragraphs.push(paragraph);
  }
  return paragraphs.join("\n\n");
}
