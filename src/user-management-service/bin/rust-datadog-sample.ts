#!/usr/bin/env node
import {App, Tags} from "aws-cdk-lib";
import {UserManagementStack} from "../lib/user-management-api/user-management-stack";

const app = new App();
 
const apiStack = new UserManagementStack(app, "UserManagementApi", {
    stackName: `UserManagementApi-${process.env.ENV ?? "dev"}`,
});