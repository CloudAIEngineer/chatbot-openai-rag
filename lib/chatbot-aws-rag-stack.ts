import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

export class ChatbotAwsRagStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === 1. S3 bucket for uploads ===
    const ingestionBucket = new s3.Bucket(this, "RagDocsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // === 2. Lambda for embeddings ===
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

    // === 3. Lambda to create OpenSearch index ===
    const createIndexLambda = new lambda.Function(this, "CreateIndexLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "create-index.handler",
      code: lambda.Code.fromAsset("handlers"),
      timeout: cdk.Duration.seconds(30),
      environment: {
        OPENSEARCH_ENDPOINT: "https://your-opensearch-domain.eu-central-1.es.amazonaws.com",
      },
    });

    createIndexLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["es:ESHttpPut"],
        resources: ["*"],
      })
    );

    new cdk.CustomResource(this, "CreateVectorIndex", {
      serviceToken: createIndexLambda.functionArn,
    });

    // === 4. ECS cluster on EC2 Spot Instances ===
    const vpc = new ec2.Vpc(this, "ChatbotVpc", { maxAzs: 2 });

    const cluster = new ecs.Cluster(this, "ChatbotCluster", { vpc });

    cluster.addCapacity("SpotFleet", {
      instanceType: new ec2.InstanceType("t3.micro"),
      desiredCapacity: 2,
      spotPrice: "0.004", // about $3–5/month
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // === 5. ECS Task Definition for mock chatbot ===
    const taskDef = new ecs.Ec2TaskDefinition(this, "ChatbotTaskDef");

    taskDef.addContainer("ChatbotContainer", {
      image: ecs.ContainerImage.fromAsset("src"), // build from ./src/Dockerfile
      memoryLimitMiB: 256,
      portMappings: [{ containerPort: 8080 }],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "Chatbot" }),
    });

    // === 6. ECS Service ===
    const service = new ecs.Ec2Service(this, "ChatbotService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 2,
    });

    // === 7. Application Load Balancer ===
    const lb = new elbv2.ApplicationLoadBalancer(this, "ChatbotALB", {
      vpc,
      internetFacing: true,
    });

    const listener = lb.addListener("Listener", { port: 80, open: true });
    listener.addTargets("ECS", {
      port: 8080,
      targets: [service],
      healthCheck: { path: "/", interval: cdk.Duration.seconds(30) },
    });

    new cdk.CfnOutput(this, "ChatbotURL", {
      value: `http://${lb.loadBalancerDnsName}`,
    });
  }
}
