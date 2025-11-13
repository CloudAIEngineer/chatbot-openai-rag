import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // --- ECS Cluster ---
    this.cluster = new ecs.Cluster(this, "ChatbotCluster", { vpc });

    // --- EC2 Launch Template ---
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      `echo ECS_CLUSTER=${this.cluster.clusterName} >> /etc/ecs/ecs.config`
    );

    const instanceRole = new iam.Role(this, "SpotInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonEC2ContainerServiceforEC2Role"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    const lt = new ec2.LaunchTemplate(this, "SpotLt", {
      instanceType: new ec2.InstanceType("t3.micro"),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      userData,
      role: instanceRole,
      spotOptions: { maxPrice: 0.004 },
    });

    // --- ASG ---
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

    this.cluster.addAsgCapacityProvider(cp);

    // --- Task Definition ---
    const taskDef = new ecs.Ec2TaskDefinition(this, "ChatbotTaskDef");

    taskDef.addContainer("ChatbotContainer", {
      image: ecs.ContainerImage.fromAsset("src"),
      memoryLimitMiB: 256,
      portMappings: [
        {
          containerPort: 8080,
          hostPort: 8080,
          protocol: ecs.Protocol.TCP
        }
      ],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "Chatbot" }),
    });

    // --- ECS Service ---
    const service = new ecs.Ec2Service(this, "ChatbotService", {
      cluster: this.cluster,
      taskDefinition: taskDef,
      desiredCount: 2,
    });

    // --- ALB + Listener + Target group ---
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
