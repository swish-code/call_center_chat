'use strict';
// The strict RAG prompt. The model must answer ONLY from CONTEXT.

const NO_DATA = { ar: 'لا توجد بيانات متاحة', en: 'No data available' };

function noDataMessage(lang) {
  return lang === 'ar' ? NO_DATA.ar : NO_DATA.en;
}

function buildRagPrompt({ context, question, lang }) {
  const refusal = noDataMessage(lang);
  return `You are an assistant for call center agents. Answer ONLY using the
CONTEXT provided below. If the answer is not in the CONTEXT, reply
exactly: "${refusal}". Never use your own knowledge. Never guess.
Reply in the same language as the QUESTION (this question is ${lang === 'ar' ? 'Arabic' : 'English'}).
Do not mention the word "CONTEXT" in your answer.

CONTEXT:
${context || '(empty)'}

QUESTION:
${question}`;
}

module.exports = { buildRagPrompt, noDataMessage };
