// src/scripts/modules/greekProcessHelpers.js

export function moveAngleTag(text, tags, angle) {
  const pattern = /<[^>]*>/g;
  let newTags = tags;
  let newAngle = angle;
  let newText = text;

  const matches = text.match(pattern);
  if (matches) {
    newTags += "<009>";
    newAngle += matches.join(" ");
    newText = newText.replace(pattern, "");
  }

  return { text: newText, tags: newTags, angle: newAngle };
}

//============================================//
export function stripMinusesTag(text, tags, minuses) {
  const pattern = /---\s*'{0,2}|--\+/g;
  let newTags = tags;
  let newMinuses = minuses;

  const match = text.match(pattern);
  if (match) {
    newTags += "<010>";
    newMinuses += match[0];
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags, minuses: newMinuses };
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
export function moveCurlyTag(text, tags, curly) {
  const pattern = /\{.*?(?:\}|$)/g;
  let newTags = tags;
  let newCurly = curly;

  const matches = text.match(pattern);
  if (matches) {
    newTags += "<008>";
    newCurly += matches.join(" ");
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags, curly: newCurly };
}

//============================================//
export function removeWhiteSpace(text) {
  if (!text) return { text: "" };
  let newText = text.replace(/^ +| +$/g, "");
  newText = newText.replace(/ {2,}/g, " ");
  return { text: newText };
}
//============================================//
