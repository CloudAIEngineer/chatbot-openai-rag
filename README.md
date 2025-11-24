# Chatbot AWS RAG

An end-to-end Retrieval-Augmented Generation pipeline on AWS. Documents are uploaded to S3, embedded and stored in Pinecone (Records API), and an ECS-hosted Express service performs retrieval + generation using Pinecone and a Hugging Face LLM.

## Stack Overview

- **S3 ingestion bucket** – drop JSONL datasets (sample files under `sample-datasets/`).  
  Each line is `{"id":"…","question":"…","answer":"…","context":"…"}`.
- **Lambda (`handlers/create-embeddings.ts`)** – triggered on `OBJECT_CREATED`, streams the JSONL file, and calls the Pinecone Records API (`/records/namespaces/.../upsert`). Pinecone handles embedding using the model configured on the index (e.g., `llama-text-embed-v2`).
- **ECS EC2 service (`src/server.js`)** – Express app that:
  1. Embeds user questions via Pinecone Inference.
  2. Queries Pinecone for top matches.
  3. Sends the context to Hugging Face’s OpenAI-compatible router (`https://router.huggingface.co/v1/chat/completions`) and returns the LLM reply + references.
- **CDK stacks (`lib/*.ts`)** – VPC, ECS cluster/ALB, and the Lambda stack.

## Required Secrets (SSM Parameter Store)

```bash
aws ssm put-parameter \
  --name "/chatbot/pinecone/api-key" \
  --type "SecureString" \
  --value "your-pinecone-api-key"

aws ssm put-parameter \
  --name "/chatbot/hf/api-token" \
  --type "SecureString" \
  --value "hf_your_huggingface_token"
```

These are consumed by the ECS task via CDK (`lib/compute-stack.ts`).

## Environment Variables

| Variable | Default | Required? | Description |
| --- | --- | --- | --- |
| `PINECONE_API_KEY` | — | **Yes** | Set via SSM/secret; required by Lambda + ECS. |
| `PINECONE_INDEX_NAME` | — | **Yes** | Pinecone index created in your account (e.g., `chatbot`). |
| `PINECONE_INDEX_HOST` | — | **Yes** | Host from Pinecone console (no scheme, e.g., `chatbot-xxxx.svc.region.pinecone.io`). |
| `PINECONE_NAMESPACE` | `__default__` | Optional | Records namespace; `__default__` maps to Pinecone’s default namespace. |
| `PINECONE_TOP_K` | `5` | Optional | Retrieval depth for query. |
| `HF_API_URL` | `https://router.huggingface.co/v1/chat/completions` | Optional | Hugging Face router endpoint. |
| `HF_MODEL_ID` | `meta-llama/Llama-3.1-8B-Instruct` | Optional | Model identifier passed to the router. |
| `HF_API_TOKEN` | — | **Yes** | SSM secret for Hugging Face API token. |
| `PORT` | `8080` | Optional | Express listen port (ECS uses 8080). |

### Where to set them

- **Local testing (`node src/server.js`)** – export the variables in your shell:
  ```bash
  export PINECONE_API_KEY=... # can be fetched via aws ssm get-parameter ... --with-decryption
  export PINECONE_INDEX_NAME=chatbot
  export PINECONE_INDEX_HOST=chatbot-xxxx.svc.aped-4627-b74a.pinecone.io
  export HF_API_TOKEN=hf_...
  # optional overrides: PINECONE_NAMESPACE, HF_MODEL_ID, etc.
  node src/server.js
  ```

- **CDK deployment** – provide values via environment variables or `--context` flags. Example:
  ```bash
  cdk deploy ComputeStack \
    --context pineconeIndexName=chatbot \
    --context pineconeIndexHost=chatbot-xxxx.svc.aped-4627-b74a.pinecone.io \
    --context pineconeNamespace=__default__ \
    --context pineconeTopK=5 \
    --context hfModelId=meta-llama/Llama-3.1-8B-Instruct
  ```

  Secrets (`/chatbot/pinecone/api-key`, `/chatbot/hf/api-token`) are read from SSM automatically.

## Local Testing

1. Install dependencies for both the CDK project and the Express service:
   ```bash
   npm install        # repo root (CDK, Lambda)
   npm run build
   cd src && npm install
   ```

2. Export the env vars (see table above) and start the server:
   ```bash
   node server.js
   ```

3. Test with curl:
   ```bash
   curl -X POST http://localhost:8080/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"Do you offer group bookings?"}'
   ```

   Sample response:
   ```json
   {
     "question": "Do you offer group bookings?",
     "answer": "Yes, group bookings are available for 10+ passengers...",
     "references": [
       { "id": "transport-018", "score": 0.56, "question": "Do you offer group bookings?" }
     ]
   }
   ```

## Deploying with CDK

```bash
npm install
npm run build
cdk bootstrap aws://YOUR_ACCOUNT/eu-central-1
cdk deploy VpcStack
cdk deploy ComputeStack --context pineconeIndexName=chatbot --context pineconeIndexHost=chatbot-xxxx.svc.aped-4627-b74a.pinecone.io
cdk deploy AppStack
```

Upload a JSONL dataset to the ingestion bucket; the Lambda will push records to Pinecone. Use the ALB URL output from `ComputeStack` to access the chat API.
