import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";

export class ChatbotAwsRagStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === 1. S3 bucket for document uploads ===
    const ingestionBucket = new s3.Bucket(this, "RagDocsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // === 2. Lambda for embedding + OpenSearch upload ===
    const embeddingLambda = new lambda.Function(this, "EmbeddingLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("handlers/create-embeddings"),
      timeout: cdk.Duration.seconds(60),
      environment: {
        BUCKET_NAME: ingestionBucket.bucketName,
        OPENSEARCH_ENDPOINT: "https://your-opensearch-domain.eu-central-1.es.amazonaws.com",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
      },
    });

    // === 3. Grant permissions ===
    ingestionBucket.grantRead(embeddingLambda);
    embeddingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["es:ESHttpPost", "es:ESHttpPut", "es:ESHttpGet"],
        resources: ["*"],
      })
    );

    // === 4. Add trigger from S3 ===
    ingestionBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(embeddingLambda)
    ); 

    // === 5. Lambda для создания индекса ===
    const createIndexLambda = new lambda.Function(this, "CreateIndexLambda", {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "create-index.handler",
        code: lambda.Code.fromAsset("handlers"),
        timeout: cdk.Duration.seconds(30),
        environment: {
        OPENSEARCH_ENDPOINT: "https://your-opensearch-domain.eu-central-1.es.amazonaws.com",
        },
    });
  
    // права на OpenSearch
    createIndexLambda.addToRolePolicy(
        new iam.PolicyStatement({
        actions: ["es:ESHttpPut"],
        resources: ["*"],
        })
    );
    
    // автоматически вызвать при деплое
    new cdk.CustomResource(this, "CreateVectorIndex", {
        serviceToken: createIndexLambda.functionArn,
    });
  }
}
