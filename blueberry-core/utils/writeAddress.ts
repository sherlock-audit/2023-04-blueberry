import fs from 'fs';
import { network } from "hardhat";

const deploymentPath = "./deployments";
const deploymentFilePath = `${deploymentPath}/${network.name}.json`;

export const deployment = fs.existsSync(deploymentFilePath)
  ? JSON.parse(fs.readFileSync(deploymentFilePath).toString())
  : {};

export function writeDeployments(deployment: any) {
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deployment, null, 2));
}
