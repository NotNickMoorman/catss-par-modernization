// src/scripts/modules/hebrewProcessHelpers.js
//============================================//
export function writeTags() {}

//============================================//
export function deDuplicateTags() {}

//============================================//
export function stripAramaicTag(text, tags) {
  const pattern = /,,a/g;
  let newTags = tags;

  if (pattern.test(text)) {
    newTags += "<001>";
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags };
}
//============================================//
export function stripDashTag() {}

//============================================//
export function stripQuestionTag(text, tags) {
  const pattern = /\?/g;
  let newTags = tags;

  if (pattern.test(text)) {
    newTags += "<003>";
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags };
}

//============================================//
export function stripCarrotsTag(text, tags) {
  const pattern = /\^/g;
  let newTags = tags;

  if (pattern.test(text)) {
    newTags += "<004>";
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags };
}

//============================================//
export function stripRetroversion() {}

//============================================//
export function stripQere() {}

//============================================//
export function stripCurly() {}

//============================================//
export function removeWhitespace() {}

//============================================//
export function writeHebrew() {}
