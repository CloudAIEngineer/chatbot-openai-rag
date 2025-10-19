# Data Format for Universal RAG Chatbot

This document defines the input data structure for all datasets used by the RAG chatbot.  
Every dataset must follow this format to ensure compatibility with embedding and retrieval pipelines.

## JSON Schema

```json
{
  "id": "faq-001",
  "question": "How can I return a product?",
  "answer": "You can return a product within 14 days with a receipt.",
  "context": "Store X return policy. Exceptions: underwear and cosmetics."
}
```

| Field      | Type   | Required | Description                                                                         |
| ---------- | ------ | -------- | ----------------------------------------------------------------------------------- |
| `id`       | string | yes      | Unique identifier for the record (e.g., `faq-001`, `qa-12345`).                     |
| `question` | string | yes      | The user-facing question to be matched in retrieval. Keep it concise (≤ 200 chars). |
| `answer`   | string | yes      | The response text shown to the user. Should be self-contained and factual.          |
| `context`  | string | optional | Extra background text or explanation (≤ 500 chars). Improves embedding relevance.   |

## Guidelines

One record = one Q&A pair.
Avoid overlapping questions or duplicates.
Language: UTF-8 text, consistent within each dataset.
File format: newline-delimited JSON (.jsonl) or plain JSON array.
Recommended size per record: 1–2 KB before embedding.

##Example File

{"id":"faq-001","question":"How can I return a product?","answer":"You can return a product within 14 days with a receipt.","context":"Store X return policy."}
{"id":"faq-002","question":"What are the opening hours of the dental clinic?","answer":"The clinic is open from 8:00 to 18:00 on weekdays.","context":"City Dental Clinic #5."}
