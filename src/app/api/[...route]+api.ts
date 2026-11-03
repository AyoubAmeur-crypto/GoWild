import { getSingletonGateway } from "../../../server/src/gateway.ts";

/**
 * Built-in Expo Server API Gateway (`/api/*`)
 *
 * Automatically mounted by `npx expo start` during development (on LAN, Simulator,
 * Emulator, Tunnel, and Web) and compiled into a deployable serverless production
 * API Gateway when running `npx expo export -p web` or `npx eas deploy`.
 */
async function dispatchToGateway(request: Request): Promise<Response> {
  const gateway = getSingletonGateway();
  return gateway.handleRequest(request, { runtimeLabel: "expo-api-gateway" });
}

export async function GET(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

export async function POST(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

