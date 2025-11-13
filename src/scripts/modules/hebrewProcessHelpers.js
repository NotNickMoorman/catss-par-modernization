// src/scripts/modules/hebrewProcessHelpers.js
export function writeTags() {}
export function deDuplicateTags() {}

export function stripAramaicTag(text, tags) {
  const pattern = /,,a/g;
  let newTags = tags;

  // check if pattern exists
  if (pattern.test(text)) {
    newTags += "<001>";
  }

  // remove the pattern
  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags };
}

export function stripDashTag() {}
export function stripQuestionTag() {}
export function stripCarrots() {}

export function stripRetroversion() {}

export function stripQere() {}
export function stripCurly() {}

export function removeWhitespace() {}
export function writeHebrew() {}
