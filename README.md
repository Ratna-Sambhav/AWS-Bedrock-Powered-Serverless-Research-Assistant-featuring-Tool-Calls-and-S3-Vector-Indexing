# AWS Serverless Bedrock Research Discovery & QA Platform

This project is an end-to-end, serverless research discovery system built on AWS. It ingests scientific research papers, stores structured metadata and vector embeddings, and exposes an interactive question-answering interface powered by Amazon Bedrock. The platform supports tool calling via AWS Lambda, enabling dynamic retrieval from a knowledge base and on-demand PDF text extraction. User authentication is managed through Amazon Cognito, with a React frontend for interaction.

---

## Features

### Research Data Pipeline
- Collects well-known AI/ML research papers from multiple sources.
- Extracts abstracts and metadata (title, authors, links, etc.).
- Stores all documents and metadata in Amazon S3.

### Knowledge Base & Embeddings
- Creates an Amazon Bedrock Knowledge Base using:
  - S3 data source for raw documents and metadata
  - Embedding model for vector generation
  - S3 vector store for embedding persistence
- Runs ingestion jobs to keep indexes updated.

### Tool-Calling Architecture
- AWS Lambda (Node.js) functions act as tools invoked by Bedrock models:
  - **Knowledge Base Query Tool**: Retrieves the most relevant papers and context.
  - **PDF Extraction Tool**: Fetches PDFs from URLs and extracts text for processing.
- A single Lambda endpoint receives chat history, model configuration, and invokes Bedrock with tool calling.

### Serverless Backend
- All compute handled by AWS Lambda.
- Storage entirely in S3.
- Bedrock provides language model inference and vector search.
- No servers to manage or scale manually.

### Authentication & Frontend
- Amazon Cognito User Pool and Identity Pool for secure, scalable auth.
- React frontend where authenticated users can chat with the research assistant.

---

## Architecture Overview

**Core Components**
- **Amazon S3**: Document storage, metadata storage, vector store.
- **Amazon Bedrock**: Foundation model inference, embeddings, knowledge base.
- **AWS Lambda (Node.js)**: Tool-calling orchestration, KB query, PDF text extraction.
- **Amazon Cognito**: Authentication and identity management.
- **React**: Client-side application enabling user interaction.

**Flow Summary**
1. Papers and metadata are placed in S3.
2. Bedrock Knowledge Base ingests and embeds documents.
3. Users authenticate through Cognito.
4. Frontend sends conversation data to a Lambda endpoint.
5. Bedrock calls tools (also Lambda functions) to fetch relevant content.
6. The user receives grounded, paper-backed answers.

---

## Getting Started

### Prerequisites
- AWS account with access to Bedrock.
- Node.js (for Lambda dev).
- React (for frontend modifications).
- IAM permissions for S3, Bedrock, Lambda, Cognito, and CloudFormation if deploying via IaC.

### Setup Steps (High-Level)
1. Upload research papers and metadata to S3.
2. Create a Bedrock Knowledge Base and connect it to the S3 source.
3. Create a vector index bucket and configure embedding dimensions.
4. Deploy Lambda functions:
   - Bedrock chat orchestrator with tool-calling handlers.
   - PDF extraction utility.
5. Configure Cognito User Pool + Identity Pool.
6. Update React environment variables with Cognito + API Gateway details.
7. Start the React application and authenticate to begin querying.

---

## Folder Structure (Suggested)
