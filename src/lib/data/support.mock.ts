import type { FaqEntry } from "./types";

const faq: FaqEntry[] = [
  { id: "f1", questionKey: "account", answerKey: "accountAnswer" },
  { id: "f2", questionKey: "cancel", answerKey: "cancelAnswer" },
  { id: "f3", questionKey: "tools", answerKey: "toolsAnswer" },
  { id: "f4", questionKey: "privacy", answerKey: "privacyAnswer" },
  { id: "f5", questionKey: "billing", answerKey: "billingAnswer" },
];

export const supportRepository = {
  async getFaq(): Promise<FaqEntry[]> {
    return faq;
  },
};
