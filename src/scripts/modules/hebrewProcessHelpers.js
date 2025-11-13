// src/scripts/modules/hebrewProcessHelpers.js
//============================================//
export function writeTags() {}

//============================================//
export function deDuplicateTags() {}

//============================================//
export function stripAramaicTag(text, tags) {
  const pattern = /,,a/g;
  let newTags = tags;

  const match = text.match(pattern);
  if (match) {
    newTags += "<001>";
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags };
}
//============================================//
export function stripPlusesTag(text, tags, pluses) {
  const pattern = /--(?:[-+]+|=(?=\s|$))?(?:\s*'{0,2})?/g;
  let newTags = tags;
  let newPluses = pluses;

  const match = text.match(pattern);
  if (match) {
    newTags += "<002>";
    newPluses += match[0];
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags, pluses: newPluses };
}

//============================================//
export function stripQuestionTag(text, tags) {
  const pattern = /\?/g;
  let newTags = tags;

  const match = text.match(pattern);
  if (match) {
    newTags += "<003>";
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags };
}

//============================================//
export function stripCarrotsTag(text, tags) {
  const pattern = /\^/g;
  let newTags = tags;

  const match = text.match(pattern);
  if (match) {
    newTags += "<004>";
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags };
}

//============================================//
export function moveRetroversionTag(text, tags, retroversion) {
  const pattern = /=.*/;
  let newTags = tags;
  let newRetroversion = retroversion;

  const match = text.match(pattern);
  if (match) {
    newTags += "<005>";
    newRetroversion += match[0];
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags, retroversion: newRetroversion };
}

//============================================//
export function moveQereTag() {}

//============================================//
export function moveCurlyTag(text, tags, curly) {
  const pattern = /\{.*?(?:\}|$)/;
  let newTags = tags;
  let newCurly = curly;

  const match = text.match(pattern);
  if (match) {
    newTags += "<007>";
    newCurly += match[0];
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags, curly: newCurly };
}

//============================================//
export function removeWhitespace() {}

//============================================//
export function writeHebrew() {}
