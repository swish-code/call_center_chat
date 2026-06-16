'use strict';
// The strict RAG prompt. The model must answer ONLY from CONTEXT.

const NO_DATA = { ar: 'لا توجد بيانات متاحة', en: 'No data available' };

function noDataMessage(lang) {
  return lang === 'ar' ? NO_DATA.ar : NO_DATA.en;
}

function buildRagPrompt({ context, question, lang, replyTo }) {
  const refusal = noDataMessage(lang);
  const noneAr = 'لا يوجد فرع أو عنصر يطابق هذا الشرط';
  const noneEn = 'No branch/item matches this condition';
  const none = lang === 'ar' ? noneAr : noneEn;
  return `You are an assistant for call center agents. Answer ONLY using the
CONTEXT provided below. Never use your own knowledge. Never guess.
Reply in the same language as the QUESTION (this question is ${lang === 'ar' ? 'Arabic' : 'English'}).
Do not mention the word "CONTEXT" in your answer.

Two distinct cases — do NOT confuse them:
1. The relevant information is simply absent from the CONTEXT → reply exactly: "${refusal}".
2. The relevant information IS present but NO item satisfies the question
   (e.g. the question asks which branches offer a service, and every listed
   branch shows that service = No) → do NOT say "${refusal}". Instead state
   clearly that none match, e.g.: "${none}". This is a valid, complete answer.

CONTEXT:
${context || '(empty)'}
${replyTo ? `\nThe user is replying to / following up on this earlier message:\n"${replyTo}"\nUse it to resolve references in the QUESTION (e.g. "it", "that branch", "its price").\n` : ''}
QUESTION:
${question}`;
}

module.exports = { buildRagPrompt, noDataMessage };
