import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import { join } from "path";

export class ChatbotAwsRagStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === 1. S3 bucket for uploads ===
    const ingestionBucket = new s3.Bucket(this, "RagDocsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // === 2. Lambda for embeddings (NodejsFunction auto-bundling) ===
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

    // === 3. ECS cluster on EC2 Spot Instances ===
    const vpc = new ec2.Vpc(this, "ChatbotVpc", { maxAzs: 2 });

    const cluster = new ecs.Cluster(this, "ChatbotCluster", { vpc });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      `echo ECS_CLUSTER=${cluster.clusterName} >> /etc/ecs/ecs.config`
    );

    const instanceRole = new iam.Role(this, "SpotInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonEC2ContainerServiceforEC2Role"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });
    
    const lt = new ec2.LaunchTemplate(this, "SpotLt", {
      instanceType: new ec2.InstanceType("t3.micro"),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      spotOptions: {
        maxPrice: 0.004,
      },
      userData,
      role: instanceRole,
    });
    
    const asg = new autoscaling.AutoScalingGroup(this, "SpotAsg", {
      vpc,
      launchTemplate: lt,
      minCapacity: 2,
      maxCapacity: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    
    const cp = new ecs.AsgCapacityProvider(this, "AsgCapacityProvider", {
      autoScalingGroup: asg,
    });
    
    cluster.addAsgCapacityProvider(cp);

    // === 4. ECS Task Definition ===
    const taskDef = new ecs.Ec2TaskDefinition(this, "ChatbotTaskDef");

    taskDef.addContainer("ChatbotContainer", {
      image: ecs.ContainerImage.fromAsset("src"),
      memoryLimitMiB: 256,
      portMappings: [{ containerPort: 8080 }],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "Chatbot" }),
    });

    // === 5. ECS Service ===
    const service = new ecs.Ec2Service(this, "ChatbotService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 2,
    });

    // === 6 Application Load Balancer ===
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
