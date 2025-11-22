import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";

const s3 = new S3Client({});
const BATCH_SIZE = 50;
const PINECONE_API_VERSION = "2025-10";
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE ?? "__default__";
const PINECONE_INDEX_HOST = process.env.PINECONE_INDEX_HOST;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;

if (!PINECONE_INDEX_HOST || !PINECONE_API_KEY) {
  throw new Error(
    "PINECONE_INDEX_HOST and PINECONE_API_KEY must be configured for ingestion."
  );
}

type QaMetadata = {
  question: string;
  answer: string;
  context?: string;
};

type ParsedInput = {
  id: string;
  text: string;
  metadata: QaMetadata;
};

export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await streamToString(data.Body);
  const lines = body.trim().split("\n").filter(Boolean);

  const items: ParsedInput[] = lines.map((line, index) => {
    const item = JSON.parse(line);
    return {
      id: String(item.id ?? `record-${index}`),
      text: buildTextPayload(item),
      metadata: buildMetadata(item),
    };
  });

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    try {
      await upsertBatch(batch);
      console.log(`Batch ${i / BATCH_SIZE + 1} inserted → ${batch.length}`);
    } catch (err) {
      console.error("Pinecone error:", err);
    }
  }

  return { statusCode: 200, body: "All records processed" };
};

// --- utils ---
const streamToString = (stream): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });

const buildTextPayload = (item: Record<string, any>): string =>
  `${item.question ?? ""}\n${item.answer ?? ""}\n${item.context ?? ""}`.trim();

const buildMetadata = (item: Record<string, any>): QaMetadata => {
  const metadata: QaMetadata = {
    question: item.question ?? "",
    answer: item.answer ?? "",
  };

  if (item.context) {
    metadata.context = item.context;
  }

  return metadata;
};

const buildRecordPayload = (item: ParsedInput) => {
  const payload: Record<string, string> = {
    _id: item.id,
    text: item.text,
    question: item.metadata.question,
    answer: item.metadata.answer,
  };

  if (item.metadata.context) {
    payload.context = item.metadata.context;
  }

  return payload;
};

const upsertBatch = async (batch: ParsedInput[]) => {
  const url = `${PINECONE_INDEX_HOST}/records/namespaces/${encodeURIComponent(
    PINECONE_NAMESPACE
  )}/upsert`;

  const payload = batch.map((item) => JSON.stringify(buildRecordPayload(item))).join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-ndjson",
      "Api-Key": PINECONE_API_KEY!,
      "X-Pinecone-Api-Version": PINECONE_API_VERSION,
    },
    body: payload,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Pinecone upsert failed: ${response.status} ${response.statusText} → ${message}`
    );
  }
};
