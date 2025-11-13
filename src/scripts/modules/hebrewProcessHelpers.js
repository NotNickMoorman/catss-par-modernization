// src/scripts/modules/hebrewProcessHelpers.js

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
export function moveQereTag(text, tags, qere) {
  let tagCheck = false;
  let complete = 0;
  let newTags = tags;
  let newQere = qere;
  let newText = text;

  const patterns = [/\{\*{1,2}\}/g, /\*\*[^*\s]+/g, /\*[^*\s]+/g];

  patterns.forEach((pattern, i) => {
    const matches = newText.match(pattern);
    if (matches) {
      matches.forEach((m) => {
        newQere += `[ ${m} ]`;
        if (i === 2) {
          // Remove only the leading * for pattern 3
          newText = newText.replace("*", "");
        }
      });

      if (i !== 2) {
        // Remove the full match for patterns 0 and 1
        newText = newText.replace(pattern, "");
      }

      tagCheck = true;
      complete += 1;
    }
  });

  if (tagCheck) {
    newTags += "<006>";
    if (complete !== 3) {
      newTags += "<007>";
    }
  }

  return { text: newText, tags: newTags, qere: newQere };
}

//============================================//
export function moveCurlyTag(text, tags, curly) {
  const pattern = /\{.*?(?:\}|$)/;
  let newTags = tags;
  let newCurly = curly;

  const match = text.match(pattern);
  if (match) {
    newTags += "<008>";
    newCurly += match[0];
  }

  const newText = text.replace(pattern, "");

  return { text: newText, tags: newTags, curly: newCurly };
}

//============================================//

//============================================//
export function removeWhiteSpace(text) {
  if (!text) return text;
  // Remove leading/trailing spaces
  let newText = text.replace(/^ +| +$/g, "");
  // Reduce multiple spaces between words to one
  newText = newText.replace(/ {2,}/g, " ");
  return { text: newText };
}
//============================================//
