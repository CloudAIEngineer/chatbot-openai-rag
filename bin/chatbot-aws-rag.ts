#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ChatbotAwsRagStack } from "../lib/chatbot-aws-rag-stack";

const app = new cdk.App();
new ChatbotAwsRagStack(app, "ChatbotAwsRagStack", {});
