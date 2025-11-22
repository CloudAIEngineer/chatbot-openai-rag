import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { join } from "path";

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ingestionBucket = new s3.Bucket(this, "RagDocsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const embeddingLambda = new NodejsFunction(this, "EmbeddingLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: join(__dirname, "../../handlers/create-embeddings.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(120),
      environment: {
        BUCKET_NAME: ingestionBucket.bucketName,
        PINECONE_API_KEY: process.env.PINECONE_API_KEY ?? "",
        PINECONE_INDEX_HOST: process.env.PINECONE_INDEX_HOST ?? "",
        PINECONE_NAMESPACE: process.env.PINECONE_NAMESPACE ?? "__default__",
      },
    });

    ingestionBucket.grantRead(embeddingLambda);

    ingestionBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(embeddingLambda)
    );
  }
}
