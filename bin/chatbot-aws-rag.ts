#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
import { ComputeStack } from "../lib/compute-stack";
import { AppStack } from "../lib/app-stack";

const app = new cdk.App();

const vpcStack = new VpcStack(app, "VpcStack");

new ComputeStack(app, "ComputeStack", {
  vpc: vpcStack.vpc,
});

new AppStack(app, "AppStack");
