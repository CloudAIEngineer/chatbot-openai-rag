import fetch from "node-fetch";

export const handler = async () => {
  const endpoint = process.env.OPENSEARCH_ENDPOINT!;
  const indexName = "rag-index";

  const body = {
    settings: {
      index: {
        knn: true,
      },
    },
    mappings: {
      properties: {
        embedding: {
          type: "knn_vector",
          dimension: 1536,
        },
        text: { type: "text" },
        id: { type: "keyword" },
      },
    },
  };

  try {
    const res = await fetch(`${endpoint}/${indexName}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log("Index creation response:", text);
    return { statusCode: res.status, body: text };
  } catch (err) {
    console.error("Failed to create index:", err);
    return { statusCode: 500, body: JSON.stringify(err) };
  }
};
