import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";

const s3 = new S3Client({});

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event));
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  // === 1. Read file from S3 ===
  const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await streamToString(data.Body);
  console.log("File content length:", body.length);

  // === 2. Generate embeddings via OpenAI ===
  const embeddingResp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: body.substring(0, 8000),
    }),
  });

  const embeddingJson = await embeddingResp.json() as { data: { embedding: number[] }[] };
  const vector = embeddingJson.data?.[0]?.embedding;
  if (!vector) throw new Error("Failed to get embedding from OpenAI");

  // === 3. Send vector to OpenSearch ===
  const doc = {
    id: key,
    text: body.substring(0, 200),
    embedding: vector,
  };

  const opensearchUrl = `${process.env.OPENSEARCH_ENDPOINT}/rag-index/_doc/${encodeURIComponent(key)}`;
  const res = await fetch(opensearchUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });

  console.log("OpenSearch response:", await res.text());
  return { statusCode: 200, body: "Embedding stored in OpenSearch" };
};

// Helper: convert stream to string
const streamToString = (stream): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });
