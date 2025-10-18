# Chatbot AWS RAG

This project implements an AWS-based Retrieval-Augmented Generation (RAG) pipeline using **TypeScript** and **AWS CDK**.

## Current Goal

Build a scalable architecture for document ingestion and retrieval using AWS native services (S3, Lambda, OpenSearch, and ECS).

## Current Components

- **S3 Bucket (Documents)** — stores uploaded source documents.
- **Lambda: create-embeddings** — triggered on file upload; generates mock embeddings and stores them in OpenSearch.
- **OpenSearch** — stores vectorized documents for semantic retrieval.
- **IAM Roles** — grant Lambdas access to S3 and OpenSearch.
- **CDK Stack** — defines and deploys all infrastructure.

## Planned Next Steps

1. **Lambda API input** — add an API Gateway endpoint with an authorizer to receive user queries.
2. **ECS endpoint** — deploy a containerized inference service (LLM or retrieval logic) in ECS Fargate.
3. **Integration** — connect Lambda input → ECS endpoint → OpenSearch query → LLM response.
4. **Evaluation** — add RAGAS-based or custom evaluation of retrieval quality.
5. **Frontend** — simple Streamlit or web UI for testing and demo.

## Deployment

```bash
npm install
npm run build
npm run deploy
```
