import { DatabaseManager } from '../models/database';
import { DEFAULT_MCP_SERVICES } from './default-mcp-services';

export async function seedDefaultServicesIfEmpty(db: DatabaseManager): Promise<number> {
  if (db.hasAnyServices()) {
    return 0;
  }

  for (const preset of DEFAULT_MCP_SERVICES) {
    await db.createService(preset);
  }

  return DEFAULT_MCP_SERVICES.length;
}
