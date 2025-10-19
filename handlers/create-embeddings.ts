import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";

const s3 = new S3Client({});
const useMock = process.env.USE_MOCK_EMBEDDINGS === "true";

export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  // === 1. Read file from S3 ===
  const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await streamToString(data.Body);
  const lines = body.trim().split("\n").filter(Boolean);

  // === 2. Process each JSONL record ===
  for (const line of lines) {
    const item = JSON.parse(line);
    const text = `${item.question}\n${item.answer}\n${item.context ?? ""}`;
    const vector = useMock ? mockEmbedding(text) : await realEmbedding(text);

    const doc = {
      id: item.id,
      question: item.question,
      answer: item.answer,
      context: item.context,
      embedding: vector,
    };

    const res = await fetch(`${process.env.OPENSEARCH_ENDPOINT}/rag-index/_doc/${encodeURIComponent(item.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    });

    console.log(`Indexed ${item.id}: ${res.status}`);
  }

  return { statusCode: 200, body: "All records processed" };
};

// === Real embedding ===
async function realEmbedding(text: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  const j = await r.json() as { data: { embedding: number[] }[] };
  return j.data?.[0]?.embedding ?? [];
}

// === Mock embedding ===
function mockEmbedding(text: string): number[] {
  const length = 1536;
  const seed = text.length % 97;
  return Array.from({ length }, (_, i) => Math.sin((i + seed) * 0.1));
}

// === Stream helper ===
const streamToString = (stream): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });
