import AsyncStorage from "@react-native-async-storage/async-storage";
import { createEmbeddedGateway } from "./embeddedGatewayCore";

export const embeddedGateway = createEmbeddedGateway(AsyncStorage);

