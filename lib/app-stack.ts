import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { join } from "path";

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- S3 bucket ---
    const ingestionBucket = new s3.Bucket(this, "RagDocsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- Embedding Lambda ---
    const embeddingLambda = new NodejsFunction(this, "EmbeddingLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: join(__dirname, "../../handlers/create-embeddings.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(60),
      environment: {
        BUCKET_NAME: ingestionBucket.bucketName,
        OPENSEARCH_ENDPOINT: "https://your-opensearch-domain.eu-central-1.es.amazonaws.com",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
      },
    });

    ingestionBucket.grantRead(embeddingLambda);

    embeddingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["es:ESHttpPost", "es:ESHttpPut", "es:ESHttpGet"],
        resources: ["*"],
      })
    );

    ingestionBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(embeddingLambda)
    );
  }
}
